import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class VehiclesService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: any) {
    const { status, type, search, page = 1, limit = 10 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = { isDeleted: false };
    if (status) where.status = status;
    if (type) where.type = type;
    if (search) {
      where.OR = [
        { regNumber: { contains: search, mode: 'insensitive' } },
        { make: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.vehicle.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          insurance: { where: { status: { in: ['ACTIVE', 'EXPIRING_SOON'] } }, take: 1 },
          assignments: { where: { isCurrent: true }, include: { driver: { select: { name: true, phone: true } } }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.vehicle.count({ where }),
    ]);
    return { data, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) };
  }

  async getStats() {
    const [total, active, maintenance, idle, breakdown] = await Promise.all([
      this.prisma.vehicle.count({ where: { isDeleted: false } }),
      this.prisma.vehicle.count({ where: { isDeleted: false, status: 'ACTIVE' } }),
      this.prisma.vehicle.count({ where: { isDeleted: false, status: 'IN_MAINTENANCE' } }),
      this.prisma.vehicle.count({ where: { isDeleted: false, status: 'IDLE' } }),
      this.prisma.vehicle.count({ where: { isDeleted: false, status: 'BREAKDOWN' } }),
    ]);
    return { total, active, maintenance, idle, breakdown };
  }

  async findOne(id: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id, isDeleted: false },
      include: {
        trips: { take: 5, orderBy: { date: 'desc' }, include: { driver: { select: { name: true } } } },
        fuelEntries: { take: 5, orderBy: { createdAt: 'desc' } },
        maintenance: { take: 5, orderBy: { createdAt: 'desc' } },
        insurance: { orderBy: { createdAt: 'desc' } },
        documents: { orderBy: { createdAt: 'desc' } },
        assignments: { where: { isCurrent: true }, include: { driver: { select: { name: true, phone: true, status: true } } } },
      },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return vehicle;
  }

  async create(dto: any) {
    return this.prisma.vehicle.create({ data: this.parseVehicleDto(dto) });
  }

  async update(id: string, dto: any) {
    await this.findOne(id);
    return this.prisma.vehicle.update({ where: { id }, data: this.parseVehicleDto(dto) });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.vehicle.update({ where: { id }, data: { isDeleted: true } });
  }

  async getExpiringDocuments(daysAhead = 30) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    const today = new Date();

    const vehicles = await this.prisma.vehicle.findMany({
      where: {
        isDeleted: false,
        status: { not: 'SOLD' },
        OR: [
          { pucExpiryDate: { lte: futureDate } },
          { insuranceExpiryDate: { lte: futureDate } },
          { fitnessExpiryDate: { lte: futureDate } },
          { taxExpiryDate: { lte: futureDate } },
          { permitExpiryDate: { lte: futureDate } },
        ],
      },
    });

    return vehicles
      .map((vehicle) => {
        const alerts: any[] = [];

        const check = (name: string, date: Date | null) => {
          if (!date) return;
          if (date < today) {
            alerts.push({ document: name, status: 'EXPIRED', expiryDate: date });
          } else if (date <= futureDate) {
            const daysLeft = Math.ceil((date.getTime() - today.getTime()) / 86400000);
            alerts.push({ document: name, status: 'EXPIRING_SOON', expiryDate: date, daysLeft });
          }
        };

        check('PUC', vehicle.pucExpiryDate);
        check('Insurance', vehicle.insuranceExpiryDate);
        check('Fitness', vehicle.fitnessExpiryDate);
        check('Road Tax', vehicle.taxExpiryDate);
        check('Permit', vehicle.permitExpiryDate);

        return { vehicleId: vehicle.id, regNumber: vehicle.regNumber, vehicleType: vehicle.type, alerts };
      })
      .filter((v) => v.alerts.length > 0);
  }

  async getExpirySummary() {
    const today = new Date();
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

    const vehicles = await this.prisma.vehicle.findMany({
      where: { isDeleted: false, status: { not: 'SOLD' } },
      select: {
        pucExpiryDate: true,
        insuranceExpiryDate: true,
        fitnessExpiryDate: true,
        taxExpiryDate: true,
        permitExpiryDate: true,
      },
    });

    let expired = 0;
    let expiringSoon = 0;

    for (const v of vehicles) {
      const dates = [v.pucExpiryDate, v.insuranceExpiryDate, v.fitnessExpiryDate, v.taxExpiryDate, v.permitExpiryDate];
      for (const d of dates) {
        if (d && d < today) expired++;
        else if (d && d <= thirtyDaysLater) expiringSoon++;
      }
    }

    return { expired, expiringSoon, total: expired + expiringSoon };
  }

  private parseVehicleDto(dto: any) {
    const data = { ...dto };

    const DATE_FIELDS = [
      'purchaseDate', 'registrationDate',
      'pucIssueDate', 'pucExpiryDate',
      'insuranceStartDate', 'insuranceExpiryDate',
      'fitnessIssueDate', 'fitnessExpiryDate',
      'taxPaidDate', 'taxExpiryDate',
      'permitExpiryDate',
    ];
    for (const f of DATE_FIELDS) {
      if (data[f] !== undefined) {
        data[f] = data[f] ? new Date(data[f]) : null;
      }
    }

    const FLOAT_FIELDS = ['loadCapacityKg', 'tankCapacityL', 'purchasePrice', 'currentKm', 'taxAmount'];
    for (const f of FLOAT_FIELDS) {
      if (data[f] !== undefined) {
        data[f] = parseFloat(String(data[f])) || 0;
      }
    }

    const INT_FIELDS = ['year', 'numTires'];
    for (const f of INT_FIELDS) {
      if (data[f] !== undefined) {
        data[f] = parseInt(String(data[f]), 10) || 0;
      }
    }

    // Strip relation fields that Prisma doesn't accept on create/update
    delete data.trips;
    delete data.fuelEntries;
    delete data.maintenance;
    delete data.emergencies;
    delete data.insurance;
    delete data.shifts;
    delete data.documents;
    delete data.assignments;
    delete data.clientVehicles;
    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;

    return data;
  }
}
