import { Injectable, OnModuleInit, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { flattenDefaultPermissions } from './permissions.seed';

const MATRIX_ROLES = [
  'ADMIN',
  'CEO',
  'MANAGER',
  'ACCOUNTANT',
  'DRIVER',
  'VIEWER',
  'COLD_STORAGE_OPERATOR',
] as const;

@Injectable()
export class PermissionsService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedPermissionsIfEmpty();
  }

  async getAllPermissions() {
    return this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { role: 'asc' }, { action: 'asc' }],
    });
  }

  async getPermissionMatrix() {
    const permissions = await this.getAllPermissions();
    const modules = [...new Set(permissions.map((p) => p.module))].sort();

    const matrix: Record<
      string,
      Record<string, Record<string, { allowed: boolean; ownOnly: boolean; expiresAt: Date | null }>>
    > = {};

    for (const mod of modules) {
      matrix[mod] = {};
      const modPerms = permissions.filter((p) => p.module === mod);
      const modActions = [...new Set(modPerms.map((p) => p.action))].sort();
      for (const act of modActions) {
        matrix[mod][act] = {};
        for (const role of MATRIX_ROLES) {
          const perm = permissions.find(
            (p) => p.role === role && p.module === mod && p.action === act,
          );
          matrix[mod][act][role] = {
            allowed: perm?.allowed ?? false,
            ownOnly: perm?.ownOnly ?? false,
            expiresAt: perm?.expiresAt ?? null,
          };
        }
      }
    }

    const actions = [...new Set(permissions.map((p) => p.action))].sort();
    return {
      roles: [...MATRIX_ROLES],
      modules,
      actions,
      matrix,
    };
  }

  async hasPermission(role: string, module: string, action: string): Promise<boolean> {
    if (role === 'SUPER_ADMIN' || role === 'ADMIN') return true;

    const perm = await this.prisma.permission.findUnique({
      where: {
        permission_role_module_action_key: {
          role,
          module,
          action,
        },
      },
    });

    if (!perm || !perm.allowed) return false;
    if (perm.expiresAt && new Date() > perm.expiresAt) return false;
    return true;
  }

  async updatePermissions(
    updates: Array<{
      role: string;
      module: string;
      action: string;
      allowed: boolean;
      ownOnly?: boolean;
    }>,
  ) {
    if (updates.some((u) => u.role === 'ADMIN' && !u.allowed)) {
      throw new ForbiddenException('Cannot revoke ADMIN permissions');
    }
    const results = [];
    for (const update of updates) {
      const result = await this.prisma.permission.upsert({
        where: {
          permission_role_module_action_key: {
            role: update.role,
            module: update.module,
            action: update.action,
          },
        },
        update: {
          allowed: update.allowed,
          ownOnly: update.ownOnly ?? false,
        },
        create: {
          role: update.role,
          module: update.module,
          action: update.action,
          allowed: update.allowed,
          ownOnly: update.ownOnly ?? false,
        },
      });
      results.push(result);
    }
    return results;
  }

  async resetToDefaults() {
    await this.prisma.permission.deleteMany({});
    await this.insertDefaultRows();
    return { ok: true, count: (await this.prisma.permission.count()) };
  }

  private async seedPermissionsIfEmpty() {
    const count = await this.prisma.permission.count();
    if (count > 0) return;
    await this.insertDefaultRows();
  }

  private async insertDefaultRows() {
    const rows = flattenDefaultPermissions();
    if (rows.length === 0) return;
    await this.prisma.permission.createMany({
      data: rows.map((r) => ({
        role: r.role,
        module: r.module,
        action: r.action,
        allowed: r.allowed,
        ownOnly: r.ownOnly ?? false,
      })),
      skipDuplicates: true,
    });
  }
}
