import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FuelService {
  constructor(private prisma: PrismaService) {}

  private generateEntryNumber(): string {
    const now = new Date();
    const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const rand = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
    return `FUEL-${date}-${rand}`;
  }

  async findAll(query: any) {
    const { vehicleId, driverId, page = 1, limit = 10 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = {};
    if (vehicleId) where.vehicleId = vehicleId;
    if (driverId) where.driverId = driverId;
    const [data, total] = await Promise.all([
      this.prisma.fuelEntry.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          vehicle: { select: { regNumber: true, make: true } },
          driver: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.fuelEntry.count({ where }),
    ]);
    return { data, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) };
  }

  async getStats(query: any) {
    const { vehicleId } = query;
    const where: any = {};
    if (vehicleId) where.vehicleId = vehicleId;
    const [totalEntries, aggregate] = await Promise.all([
      this.prisma.fuelEntry.count({ where }),
      this.prisma.fuelEntry.aggregate({
        where,
        _sum: { liters: true, totalCost: true },
        _avg: { ratePerLiter: true },
      }),
    ]);
    return {
      totalEntries,
      totalLiters: aggregate._sum.liters || 0,
      totalCost: aggregate._sum.totalCost || 0,
      avgRatePerLiter: aggregate._avg.ratePerLiter || 0,
    };
  }

  async create(dto: any) {
    const entryNumber = dto.entryNumber || this.generateEntryNumber();
    let ratePerLiter = dto.ratePerLiter;
    if (!ratePerLiter && dto.totalCost && dto.liters) {
      ratePerLiter = dto.totalCost / dto.liters;
    }
    return this.prisma.fuelEntry.create({
      data: { ...dto, entryNumber, ratePerLiter },
      include: {
        vehicle: { select: { regNumber: true } },
        driver: { select: { name: true } },
      },
    });
  }
}
