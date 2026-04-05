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
        { nickname: { contains: search, mode: 'insensitive' } },
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
    delete data.id;
    delete data.assignments;
    delete data.trips;
    delete data.shifts;
    delete data.whatsappMessages;
    delete data.attendances;
    delete data.ledgerEntries;
    delete data.salaryRecords;
    delete data.dailyTripLogs;
    delete data.user;
    delete data.createdAt;
    delete data.updatedAt;

    const OPTIONAL_STRING_FIELDS = [
      'bloodGroup',
      'city',
      'state',
      'emergencyContact',
      'emergencyName',
      'employeeCode',
      'address',
      'nickname',
    ];
    for (const key of OPTIONAL_STRING_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(dto, key)) continue;
      if (data[key] === '') data[key] = null;
    }

    const FLOAT_FIELDS = ['salary', 'baseSalary'];
    for (const key of FLOAT_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(dto, key)) continue;
      if (data[key] === '' || data[key] === null || data[key] === undefined) {
        data[key] = null;
      } else {
        const n = parseFloat(String(data[key]));
        data[key] = Number.isNaN(n) ? null : n;
      }
    }

    const INT_FIELDS = ['experience'];
    for (const key of INT_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(dto, key)) continue;
      if (data[key] === '' || data[key] === null || data[key] === undefined) {
        delete data[key];
      } else {
        const n = parseInt(String(data[key]), 10);
        if (Number.isNaN(n)) delete data[key];
        else data[key] = n;
      }
    }

    if (Object.prototype.hasOwnProperty.call(dto, 'rating')) {
      if (data.rating === '' || data.rating === null || data.rating === undefined) delete data.rating;
      else {
        const r = parseFloat(String(data.rating));
        if (Number.isNaN(r)) delete data.rating;
        else data.rating = r;
      }
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
    if (data.nickname !== undefined && data.nickname !== null) {
      const n = String(data.nickname).trim();
      data.nickname = n || null;
    }

    return data;
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.driver.update({ where: { id }, data: { isDeleted: true } });
  }
}
