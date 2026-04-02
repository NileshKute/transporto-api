import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PermissionsService } from './permissions.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

function assertAdmin(req: { user?: { role?: string } }) {
  const r = req.user?.role;
  if (r !== 'SUPER_ADMIN' && r !== 'ADMIN') {
    throw new ForbiddenException('Admin access required');
  }
}

@ApiTags('Permissions')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly service: PermissionsService) {}

  @Get()
  @RequirePermission('permissions', 'view')
  @ApiOperation({ summary: 'List all permission rows (admin only)' })
  async getAll(@Req() req: { user?: { role?: string } }) {
    assertAdmin(req);
    return this.service.getAllPermissions();
  }

  @Get('matrix')
  @ApiOperation({ summary: 'Permission matrix for UI (admin only)' })
  async getMatrix(@Req() req: { user?: { role?: string } }) {
    assertAdmin(req);
    return this.service.getPermissionMatrix();
  }

  @Put()
  @RequirePermission('permissions', 'edit')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Batch update permissions' })
  async updatePermissions(
    @Body()
    body: {
      permissions: Array<{
        role: string;
        module: string;
        action: string;
        allowed: boolean;
        ownOnly?: boolean;
      }>;
    },
  ) {
    return this.service.updatePermissions(body.permissions ?? []);
  }

  @Post('reset')
  @RequirePermission('permissions', 'edit')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Reset all permissions to factory defaults' })
  async reset() {
    return this.service.resetToDefaults();
  }

  @Post('check')
  @ApiOperation({ summary: 'Check if current user role may perform action' })
  async checkPermission(
    @Req() req: { user?: { role?: string } },
    @Body() body: { module: string; action: string },
  ) {
    const role = String(req.user?.role ?? '');
    const allowed = await this.service.hasPermission(role, body.module, body.action);
    return { allowed };
  }
}
