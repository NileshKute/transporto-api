import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ShiftsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: any) {
    const { driverId, date, status, page = 1, limit = 10 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = {};
    if (driverId) where.driverId = driverId;
    if (date) where.date = new Date(date);
    if (status) where.status = status;
    const [data, total] = await Promise.all([
      this.prisma.shift.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          driver: { select: { name: true, phone: true } },
          vehicle: { select: { regNumber: true } },
        },
        orderBy: { date: 'desc' },
      }),
      this.prisma.shift.count({ where }),
    ]);
    return { data, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) };
  }

  async create(dto: any) {
    return this.prisma.shift.create({
      data: dto,
      include: {
        driver: { select: { name: true } },
        vehicle: { select: { regNumber: true } },
      },
    });
  }

  async start(id: string) {
    const shift = await this.prisma.shift.findUnique({ where: { id } });
    if (!shift) throw new NotFoundException('Shift not found');
    return this.prisma.shift.update({
      where: { id },
      data: { status: 'ACTIVE', startTime: new Date() },
    });
  }

  async end(id: string, dto: any) {
    const shift = await this.prisma.shift.findUnique({ where: { id } });
    if (!shift) throw new NotFoundException('Shift not found');
    const endTime = new Date();
    const startTime = shift.startTime;
    const diffMs = endTime.getTime() - startTime.getTime();
    const hoursWorked = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
    const overtime = hoursWorked > 10 ? Math.round((hoursWorked - 10) * 100) / 100 : 0;
    return this.prisma.shift.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        endTime,
        hoursWorked,
        overtime,
        notes: dto?.notes || shift.notes,
      },
    });
  }
}
