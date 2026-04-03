import {
  Injectable,
  NotFoundException,
  OnModuleInit,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class VehicleMaintenanceService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedDefaultTypes();
  }

  async getAllTypes() {
    return this.prisma.maintCatalog.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async getTypesByCategory(category: string) {
    return this.prisma.maintCatalog.findMany({
      where: { category: category.toUpperCase(), isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createType(data: { name: string; category: string; icon?: string }) {
    return this.prisma.maintCatalog.create({
      data: {
        name: data.name.trim(),
        category: data.category.toUpperCase(),
        icon: data.icon || null,
      },
    });
  }

  async updateType(
    id: string,
    data: {
      name?: string;
      icon?: string;
      isActive?: boolean;
      sortOrder?: number;
    },
  ) {
    return this.prisma.maintCatalog.update({ where: { id }, data });
  }

  async deleteType(id: string) {
    return this.prisma.maintCatalog.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async createRecord(data: {
    vehicleId: string;
    typeId: string;
    category?: string;
    date: string | Date;
    description?: string;
    partsUsed?: string;
    laborCost?: number | string;
    partsCost?: number | string;
    totalCost?: number | string;
    odometerKm?: number | string;
    runningHours?: number | string;
    garageName?: string;
    garageContact?: string;
    billNumber?: string;
    billPhotoUrl?: string;
    nextServiceDate?: string | Date;
    nextServiceKm?: number | string;
    nextServiceHours?: number | string;
    notes?: string;
    source?: string;
  }) {
    const labor = parseFloat(String(data.laborCost ?? 0)) || 0;
    const parts = parseFloat(String(data.partsCost ?? 0)) || 0;
    let totalCost = parseFloat(String(data.totalCost ?? 0)) || 0;
    if (labor > 0 || parts > 0) {
      totalCost = labor + parts;
    } else if (totalCost === 0) {
      totalCost = 0;
    }

    let category = (data.category || 'TRUCK').toUpperCase();
    if (data.typeId) {
      const type = await this.prisma.maintCatalog.findUnique({
        where: { id: data.typeId },
      });
      if (!type) throw new BadRequestException('Invalid typeId');
      category = type.category;
    }

    return this.prisma.vehicleMaintRecord.create({
      data: {
        vehicleId: data.vehicleId,
        typeId: data.typeId,
        category,
        date: new Date(data.date),
        description: data.description ?? null,
        partsUsed: data.partsUsed ?? null,
        laborCost: labor,
        partsCost: parts,
        totalCost,
        odometerKm: data.odometerKm != null ? parseInt(String(data.odometerKm), 10) : null,
        runningHours:
          data.runningHours != null ? parseInt(String(data.runningHours), 10) : null,
        garageName: data.garageName ?? null,
        garageContact: data.garageContact ?? null,
        billNumber: data.billNumber ?? null,
        billPhotoUrl: data.billPhotoUrl ?? null,
        nextServiceDate: data.nextServiceDate
          ? new Date(data.nextServiceDate)
          : null,
        nextServiceKm:
          data.nextServiceKm != null
            ? parseInt(String(data.nextServiceKm), 10)
            : null,
        nextServiceHours:
          data.nextServiceHours != null
            ? parseInt(String(data.nextServiceHours), 10)
            : null,
        notes: data.notes ?? null,
        source: data.source || 'MANUAL',
      },
      include: { type: true, vehicle: true },
    });
  }

  async updateRecord(id: string, data: Record<string, unknown>) {
    const existing = await this.prisma.vehicleMaintRecord.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Record not found');

    const update: Record<string, unknown> = {};
    if (data.date) update.date = new Date(String(data.date));
    if (data.typeId) {
      update.typeId = data.typeId;
      const t = await this.prisma.maintCatalog.findUnique({
        where: { id: String(data.typeId) },
      });
      if (t) update.category = t.category;
    }
    if (data.description !== undefined) update.description = data.description;
    if (data.partsUsed !== undefined) update.partsUsed = data.partsUsed;
    if (data.billPhotoUrl !== undefined) update.billPhotoUrl = data.billPhotoUrl;

    let labor = existing.laborCost;
    let parts = existing.partsCost;
    if (data.laborCost !== undefined) {
      labor = parseFloat(String(data.laborCost)) || 0;
      update.laborCost = labor;
    }
    if (data.partsCost !== undefined) {
      parts = parseFloat(String(data.partsCost)) || 0;
      update.partsCost = parts;
    }
    if (data.laborCost !== undefined || data.partsCost !== undefined) {
      update.totalCost = labor + parts;
    }
    if (data.totalCost !== undefined && data.laborCost === undefined && data.partsCost === undefined) {
      update.totalCost = parseFloat(String(data.totalCost)) || 0;
    }

    if (data.odometerKm !== undefined) {
      update.odometerKm = data.odometerKm
        ? parseInt(String(data.odometerKm), 10)
        : null;
    }
    if (data.runningHours !== undefined) {
      update.runningHours = data.runningHours
        ? parseInt(String(data.runningHours), 10)
        : null;
    }
    if (data.garageName !== undefined) update.garageName = data.garageName;
    if (data.garageContact !== undefined) {
      update.garageContact = data.garageContact;
    }
    if (data.billNumber !== undefined) update.billNumber = data.billNumber;
    if (data.nextServiceDate !== undefined) {
      update.nextServiceDate = data.nextServiceDate
        ? new Date(String(data.nextServiceDate))
        : null;
    }
    if (data.nextServiceKm !== undefined) {
      update.nextServiceKm = data.nextServiceKm
        ? parseInt(String(data.nextServiceKm), 10)
        : null;
    }
    if (data.nextServiceHours !== undefined) {
      update.nextServiceHours = data.nextServiceHours
        ? parseInt(String(data.nextServiceHours), 10)
        : null;
    }
    if (data.notes !== undefined) update.notes = data.notes;

    return this.prisma.vehicleMaintRecord.update({
      where: { id },
      data: update,
      include: { type: true, vehicle: true },
    });
  }

  async deleteRecord(id: string) {
    return this.prisma.vehicleMaintRecord.delete({ where: { id } });
  }

  async getRecordById(id: string) {
    return this.prisma.vehicleMaintRecord.findUnique({
      where: { id },
      include: { type: true, vehicle: true },
    });
  }

  async getRecordsByVehicle(
    vehicleId: string,
    filters: {
      category?: string;
      typeId?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const where: Record<string, unknown> = { vehicleId };
    if (filters.category) where.category = filters.category.toUpperCase();
    if (filters.typeId) where.typeId = filters.typeId;
    if (filters.startDate || filters.endDate) {
      const date: { gte?: Date; lte?: Date } = {};
      if (filters.startDate) date.gte = new Date(filters.startDate);
      if (filters.endDate) {
        date.lte = new Date(`${filters.endDate}T23:59:59.999Z`);
      }
      where.date = date;
    }

    const page = filters.page || 1;
    const limit = filters.limit || 50;

    const [records, total, sumAgg] = await Promise.all([
      this.prisma.vehicleMaintRecord.findMany({
        where,
        include: { type: true },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.vehicleMaintRecord.count({ where }),
      this.prisma.vehicleMaintRecord.aggregate({
        where,
        _sum: { totalCost: true, laborCost: true, partsCost: true },
      }),
    ]);

    return {
      records,
      total,
      page,
      limit,
      summary: {
        totalCost: sumAgg._sum.totalCost ?? 0,
        laborCost: sumAgg._sum.laborCost ?? 0,
        partsCost: sumAgg._sum.partsCost ?? 0,
        recordCount: total,
      },
    };
  }

  async getAllRecords(filters: {
    vehicleId?: string;
    category?: string;
    typeId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    const where: Record<string, unknown> = {};
    if (filters.vehicleId) where.vehicleId = filters.vehicleId;
    if (filters.category) where.category = filters.category.toUpperCase();
    if (filters.typeId) where.typeId = filters.typeId;
    if (filters.startDate || filters.endDate) {
      const date: { gte?: Date; lte?: Date } = {};
      if (filters.startDate) date.gte = new Date(filters.startDate);
      if (filters.endDate) {
        date.lte = new Date(`${filters.endDate}T23:59:59.999Z`);
      }
      where.date = date;
    }

    const page = filters.page || 1;
    const limit = filters.limit || 50;

    const [records, total, sumAgg] = await Promise.all([
      this.prisma.vehicleMaintRecord.findMany({
        where,
        include: {
          type: true,
          vehicle: {
            select: { id: true, regNumber: true, make: true, model: true },
          },
        },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.vehicleMaintRecord.count({ where }),
      this.prisma.vehicleMaintRecord.aggregate({
        where,
        _sum: { totalCost: true, laborCost: true, partsCost: true },
      }),
    ]);

    return {
      records,
      total,
      page,
      limit,
      summary: {
        totalCost: sumAgg._sum.totalCost ?? 0,
        laborCost: sumAgg._sum.laborCost ?? 0,
        partsCost: sumAgg._sum.partsCost ?? 0,
        recordCount: total,
      },
    };
  }

  async getUpcomingReminders(daysAhead = 30) {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const [upcoming, overdue] = await Promise.all([
      this.prisma.vehicleMaintRecord.findMany({
        where: {
          nextServiceDate: { lte: futureDate, gte: now },
        },
        include: {
          type: true,
          vehicle: {
            select: {
              id: true,
              regNumber: true,
              make: true,
              model: true,
              currentKm: true,
            },
          },
        },
        orderBy: { nextServiceDate: 'asc' },
      }),
      this.prisma.vehicleMaintRecord.findMany({
        where: {
          nextServiceDate: { lt: now, not: null },
        },
        include: {
          type: true,
          vehicle: {
            select: {
              id: true,
              regNumber: true,
              make: true,
              model: true,
              currentKm: true,
            },
          },
        },
        orderBy: { nextServiceDate: 'asc' },
        take: 50,
      }),
    ]);

    return { upcoming, overdue };
  }

  async getVehicleCostSummary(vehicleId: string) {
    const [truckCost, reeferCost, truckCount, reeferCount, byType] =
      await Promise.all([
        this.prisma.vehicleMaintRecord.aggregate({
          where: { vehicleId, category: 'TRUCK' },
          _sum: { totalCost: true },
        }),
        this.prisma.vehicleMaintRecord.aggregate({
          where: { vehicleId, category: 'REEFER' },
          _sum: { totalCost: true },
        }),
        this.prisma.vehicleMaintRecord.count({
          where: { vehicleId, category: 'TRUCK' },
        }),
        this.prisma.vehicleMaintRecord.count({
          where: { vehicleId, category: 'REEFER' },
        }),
        this.prisma.vehicleMaintRecord.groupBy({
          by: ['typeId'],
          where: { vehicleId },
          _sum: { totalCost: true },
          _count: { _all: true },
        }),
      ]);

    const truckSum = truckCost._sum.totalCost ?? 0;
    const reeferSum = reeferCost._sum.totalCost ?? 0;

    return {
      truck: { cost: truckSum, count: truckCount },
      reefer: { cost: reeferSum, count: reeferCount },
      total: truckSum + reeferSum,
      byType,
    };
  }

  private async seedDefaultTypes() {
    const count = await this.prisma.maintCatalog.count();
    if (count > 0) return;

    const defaults = [
      { name: 'Regular Servicing', category: 'TRUCK', icon: '🔧', sortOrder: 1 },
      { name: 'Tyre Change/Repair', category: 'TRUCK', icon: '🛞', sortOrder: 2 },
      { name: 'AC Servicing', category: 'TRUCK', icon: '❄️', sortOrder: 3 },
      { name: 'Battery Replace', category: 'TRUCK', icon: '🔋', sortOrder: 4 },
      { name: 'Brake Repair', category: 'TRUCK', icon: '🛑', sortOrder: 5 },
      {
        name: 'Body/Denting/Painting',
        category: 'TRUCK',
        icon: '🎨',
        sortOrder: 6,
      },
      { name: 'Accident Repair', category: 'TRUCK', icon: '⚠️', sortOrder: 7 },
      { name: 'Clutch Repair', category: 'TRUCK', icon: '⚙️', sortOrder: 8 },
      {
        name: 'Electrical/Wiring',
        category: 'TRUCK',
        icon: '🔌',
        sortOrder: 9,
      },
      {
        name: 'Suspension Repair',
        category: 'TRUCK',
        icon: '🔩',
        sortOrder: 10,
      },
      { name: 'Other (Truck)', category: 'TRUCK', icon: '📋', sortOrder: 99 },
      {
        name: 'Compressor Servicing',
        category: 'REEFER',
        icon: '🔧',
        sortOrder: 1,
      },
      {
        name: 'Gas Refill (Refrigerant)',
        category: 'REEFER',
        icon: '💨',
        sortOrder: 2,
      },
      {
        name: 'Thermostat Calibration',
        category: 'REEFER',
        icon: '🌡️',
        sortOrder: 3,
      },
      {
        name: 'Condenser Cleaning',
        category: 'REEFER',
        icon: '🧹',
        sortOrder: 4,
      },
      {
        name: 'Evaporator Service',
        category: 'REEFER',
        icon: '💧',
        sortOrder: 5,
      },
      {
        name: 'Door Seal Replace',
        category: 'REEFER',
        icon: '🚪',
        sortOrder: 6,
      },
      {
        name: 'Insulation Repair',
        category: 'REEFER',
        icon: '🧱',
        sortOrder: 7,
      },
      {
        name: 'Standby Unit Service',
        category: 'REEFER',
        icon: '🔋',
        sortOrder: 8,
      },
      {
        name: 'Electrical/Control Panel',
        category: 'REEFER',
        icon: '🔌',
        sortOrder: 9,
      },
      {
        name: 'Full Reefer Overhaul',
        category: 'REEFER',
        icon: '🔄',
        sortOrder: 10,
      },
      { name: 'Other (Reefer)', category: 'REEFER', icon: '📋', sortOrder: 99 },
    ];

    await this.prisma.maintCatalog.createMany({ data: defaults });
  }
}
