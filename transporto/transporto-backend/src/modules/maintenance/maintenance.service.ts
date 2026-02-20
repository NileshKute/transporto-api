import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MaintenanceService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: any) {
    const { vehicleId, status, page = 1, limit = 10 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = {};
    if (vehicleId) where.vehicleId = vehicleId;
    if (status) where.status = status;
    const [data, total] = await Promise.all([
      this.prisma.maintenance.findMany({
        where,
        skip,
        take: Number(limit),
        include: { vehicle: { select: { regNumber: true, make: true, model: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.maintenance.count({ where }),
    ]);
    return { data, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) };
  }

  async findDue() {
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
    return this.prisma.maintenance.findMany({
      where: {
        status: { not: 'COMPLETED' },
        nextDueDate: { lte: thirtyDaysLater },
      },
      include: { vehicle: { select: { regNumber: true, make: true, model: true } } },
      orderBy: { nextDueDate: 'asc' },
    });
  }

  async create(dto: any) {
    return this.prisma.maintenance.create({
      data: dto,
      include: { vehicle: { select: { regNumber: true } } },
    });
  }

  async update(id: string, dto: any) {
    const existing = await this.prisma.maintenance.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Maintenance record not found');
    return this.prisma.maintenance.update({
      where: { id },
      data: dto,
    });
  }
}
