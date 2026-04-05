import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto, UpdateUserDto } from './auth.dto';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

/** Roles that can be assigned via admin UI / register (never SUPER_ADMIN). */
const ASSIGNABLE_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.CEO,
  UserRole.MANAGER,
  UserRole.ACCOUNTANT,
  UserRole.DRIVER,
  UserRole.COLD_STORAGE_OPERATOR,
  UserRole.VIEWER,
];

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });
    const token = this.jwtService.sign({ sub: user.id, email: user.email, role: user.role });
    const { password: _, ...userWithoutPassword } = user;
    return { token, user: userWithoutPassword };
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const role = dto.role ?? UserRole.DRIVER;
    if (role === UserRole.SUPER_ADMIN) {
      throw new BadRequestException('Cannot assign SUPER_ADMIN via this endpoint');
    }
    if (!ASSIGNABLE_ROLES.includes(role)) {
      throw new BadRequestException('Invalid role for user creation');
    }
    const hashed = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
        password: hashed,
        phone: dto.phone?.trim() || null,
        role,
        isActive: dto.isActive !== false,
      },
    });
    const { password: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword };
  }

  async listUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateUser(actorId: string, targetId: string, dto: UpdateUserDto) {
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target) throw new NotFoundException('User not found');

    if (dto.role !== undefined && dto.role !== target.role) {
      if (actorId === targetId) {
        throw new ForbiddenException('You cannot change your own role');
      }
      if (target.role === UserRole.SUPER_ADMIN) {
        throw new ForbiddenException('Cannot change role of a SUPER_ADMIN user');
      }
      if (dto.role === UserRole.SUPER_ADMIN) {
        throw new BadRequestException('Cannot assign SUPER_ADMIN via this endpoint');
      }
      if (!ASSIGNABLE_ROLES.includes(dto.role)) {
        throw new BadRequestException('Invalid role');
      }
    }

    if (dto.email !== undefined && dto.email.trim().toLowerCase() !== target.email) {
      const taken = await this.prisma.user.findUnique({
        where: { email: dto.email.trim().toLowerCase() },
      });
      if (taken) throw new ConflictException('Email already in use');
    }

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.email !== undefined) data.email = dto.email.trim().toLowerCase();
    if (dto.phone !== undefined) data.phone = dto.phone?.trim() || null;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.password !== undefined && dto.password.length > 0) {
      data.password = await bcrypt.hash(dto.password, 10);
    }

    const user = await this.prisma.user.update({
      where: { id: targetId },
      data: data as any,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
      },
    });
    return user;
  }

  async removeUser(actorId: string, targetId: string) {
    if (actorId === targetId) {
      throw new ForbiddenException('You cannot delete your own account');
    }
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target) throw new NotFoundException('User not found');
    await this.prisma.user.update({
      where: { id: targetId },
      data: { isActive: false },
    });
    return { success: true };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, email: true, phone: true,
        role: true, avatarUrl: true, isActive: true, lastLogin: true,
        createdAt: true, updatedAt: true,
      },
    });
    if (!user) throw new UnauthorizedException('User not found');
    return user;
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId, isActive: true } });
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
