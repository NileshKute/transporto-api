import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DriversService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: any) {
    const { status, search, page = 1, limit = 10 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = { isDeleted: false };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { licenseNumber: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.driver.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          assignments: {
            where: { isCurrent: true },
            include: { vehicle: { select: { regNumber: true, make: true, model: true } } },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.driver.count({ where }),
    ]);
    return { data, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) };
  }

  async findOne(id: string) {
    const driver = await this.prisma.driver.findFirst({
      where: { id, isDeleted: false },
      include: {
        trips: { take: 10, orderBy: { date: 'desc' }, include: { vehicle: { select: { regNumber: true } } } },
        shifts: { take: 10, orderBy: { date: 'desc' } },
        assignments: { where: { isCurrent: true }, include: { vehicle: { select: { regNumber: true, make: true, model: true, status: true } } } },
      },
    });
    if (!driver) throw new NotFoundException('Driver not found');
    return driver;
  }

  async create(dto: any) {
    return this.prisma.driver.create({ data: this.parseDriverDto(dto) });
  }

  async update(id: string, dto: any) {
    await this.findOne(id);
    return this.prisma.driver.update({ where: { id }, data: this.parseDriverDto(dto) });
  }

  private parseDriverDto(dto: any) {
    const data = { ...dto };

    if (data.experience !== undefined) {
      data.experience = parseInt(String(data.experience).replace(/[^0-9]/g, ''), 10) || 0;
    }
    if (data.salary !== undefined) {
      data.salary = parseFloat(String(data.salary)) || 0;
    }
    if (data.rating !== undefined) {
      data.rating = parseFloat(String(data.rating)) || 0;
    }
    if (data.licenseExpiry !== undefined) {
      data.licenseExpiry = data.licenseExpiry ? new Date(data.licenseExpiry) : null;
    }
    if (data.dateOfBirth !== undefined) {
      data.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
    }
    if (data.joiningDate !== undefined) {
      data.joiningDate = data.joiningDate ? new Date(data.joiningDate) : null;
    }

    return data;
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.driver.update({ where: { id }, data: { isDeleted: true } });
  }
}
