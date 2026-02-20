import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class EmergenciesService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: any) {
    const { status, page = 1, limit = 10 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = {};
    if (status) where.status = status;
    const [data, total] = await Promise.all([
      this.prisma.emergency.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          vehicle: { select: { regNumber: true, make: true, model: true } },
          driver: { select: { name: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.emergency.count({ where }),
    ]);
    return { data, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) };
  }

  async create(dto: any) {
    return this.prisma.emergency.create({
      data: dto,
      include: {
        vehicle: { select: { regNumber: true } },
        driver: { select: { name: true, phone: true } },
      },
    });
  }

  async resolve(id: string, dto: any) {
    const existing = await this.prisma.emergency.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Emergency not found');
    return this.prisma.emergency.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedBy: dto.resolvedBy,
        resolution: dto.resolution,
        actualCost: dto.actualCost,
      },
    });
  }
}
