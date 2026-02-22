import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InsuranceService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: any) {
    const { vehicleId, status, page = 1, limit = 10 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = {};
    if (vehicleId) where.vehicleId = vehicleId;
    if (status) where.status = status;
    const [data, total] = await Promise.all([
      this.prisma.insurance.findMany({
        where,
        skip,
        take: Number(limit),
        include: { vehicle: { select: { regNumber: true, type: true, make: true, model: true } } },
        orderBy: { endDate: 'asc' },
      }),
      this.prisma.insurance.count({ where }),
    ]);
    return { data, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) };
  }

  async findExpiring() {
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
    return this.prisma.insurance.findMany({
      where: {
        status: { not: 'EXPIRED' },
        endDate: { lte: thirtyDaysLater },
      },
      include: { vehicle: { select: { regNumber: true, type: true } } },
      orderBy: { endDate: 'asc' },
    });
  }

  async create(dto: any) {
    return this.prisma.insurance.create({
      data: dto,
      include: { vehicle: { select: { regNumber: true } } },
    });
  }

  async update(id: string, dto: any) {
    const existing = await this.prisma.insurance.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Insurance policy not found');
    return this.prisma.insurance.update({ where: { id }, data: dto });
  }
}
