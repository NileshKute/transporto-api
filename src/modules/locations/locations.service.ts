import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LocationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: { search?: string; limit?: string | number }) {
    const search =
      typeof query.search === 'string' ? query.search.trim() : '';
    const limit = Math.min(
      Math.max(parseInt(String(query.limit ?? '500'), 10) || 500, 1),
      2000,
    );

    const where: Record<string, unknown> = { isActive: true };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { shortName: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }

    const data = await this.prisma.location.findMany({
      where,
      take: limit,
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
    return { data };
  }

  async findOne(id: string) {
    const loc = await this.prisma.location.findFirst({
      where: { id },
    });
    if (!loc) throw new NotFoundException('Location not found');
    return loc;
  }

  async create(dto: {
    name: string;
    shortName?: string | null;
    type?: string;
    city?: string | null;
    state?: string | null;
    address?: string | null;
    clientId?: string | null;
  }) {
    const name = String(dto.name ?? '').trim();
    if (!name) throw new BadRequestException('name is required');
    return this.prisma.location.create({
      data: {
        name,
        shortName: dto.shortName?.trim() || null,
        type: dto.type?.trim() || 'GENERAL',
        city: dto.city?.trim() || null,
        state: dto.state?.trim() || null,
        address: dto.address?.trim() || null,
        clientId: dto.clientId || null,
        isActive: true,
      },
    });
  }

  async update(
    id: string,
    dto: {
      name?: string;
      shortName?: string | null;
      type?: string;
      city?: string | null;
      state?: string | null;
      address?: string | null;
      clientId?: string | null;
      isActive?: boolean;
    },
  ) {
    await this.findOne(id);
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = String(dto.name).trim();
    if (dto.shortName !== undefined) data.shortName = dto.shortName?.trim() || null;
    if (dto.type !== undefined) data.type = String(dto.type).trim() || 'GENERAL';
    if (dto.city !== undefined) data.city = dto.city?.trim() || null;
    if (dto.state !== undefined) data.state = dto.state?.trim() || null;
    if (dto.address !== undefined) data.address = dto.address?.trim() || null;
    if (dto.clientId !== undefined) data.clientId = dto.clientId || null;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    return this.prisma.location.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.location.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
