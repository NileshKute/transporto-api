import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { ParsedDailyTripBlock } from './daily-trip-log-whatsapp.parser';

export interface DailyTripInput {
  fromLocation: string;
  toLocation: string;
  clientName?: string;
  notes?: string;
  tripType?: string;
}

export interface CreateDailyLogDto {
  date: string;
  driverName: string;
  vehicleReg: string;
  trips: DailyTripInput[];
  notes?: string;
  source?: string;
}

@Injectable()
export class DailyTripService {
  constructor(private prisma: PrismaService) {}

  normalizeVehicleReg(reg: string): string {
    return reg.replace(/[\s-]/g, '').toUpperCase();
  }

  private toDateOnly(isoYmd: string): Date {
    const parts = isoYmd.trim().split('-').map(Number);
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
      throw new BadRequestException('Invalid date; use YYYY-MM-DD');
    }
    const [y, m, d] = parts;
    return new Date(Date.UTC(y, m - 1, d));
  }

  private async resolveVehicleId(normalizedReg: string): Promise<string | null> {
    const v = await this.prisma.vehicle.findFirst({
      where: {
        isDeleted: false,
        regNumber: { contains: normalizedReg, mode: 'insensitive' },
      },
      select: { id: true },
    });
    return v?.id ?? null;
  }

  private async resolveDriverId(driverName: string): Promise<string | null> {
    const name = driverName.trim();
    if (!name) return null;
    const d = await this.prisma.driver.findFirst({
      where: {
        isDeleted: false,
        name: { contains: name, mode: 'insensitive' },
      },
      select: { id: true },
    });
    return d?.id ?? null;
  }

  async createOrReplace(dto: CreateDailyLogDto, createdBy?: string | null) {
    if (!dto.trips?.length) {
      throw new BadRequestException('At least one trip entry is required');
    }
    const vehicleReg = this.normalizeVehicleReg(dto.vehicleReg);
    if (!vehicleReg) {
      throw new BadRequestException('vehicleReg is required');
    }
    const date = this.toDateOnly(dto.date);
    const driverName = (dto.driverName || '').trim() || 'Unknown';
    const [vehicleId, driverId] = await Promise.all([
      this.resolveVehicleId(vehicleReg),
      this.resolveDriverId(driverName),
    ]);

    const source = dto.source?.trim() || 'MANUAL';

    return this.prisma.$transaction(async (tx) => {
      const log = await tx.dailyTripLog.upsert({
        where: {
          date_vehicleReg: {
            date,
            vehicleReg,
          },
        },
        create: {
          date,
          driverName,
          driverId,
          vehicleId,
          vehicleReg,
          notes: dto.notes?.trim() || null,
          source,
          createdBy: createdBy ?? null,
        },
        update: {
          driverName,
          driverId,
          vehicleId,
          source,
          ...(dto.notes !== undefined
            ? { notes: dto.notes?.trim() || null }
            : {}),
        },
      });

      await tx.dailyTripEntry.deleteMany({
        where: { dailyTripLogId: log.id },
      });
      await tx.dailyTripEntry.createMany({
        data: dto.trips.map((t, i) => ({
          dailyTripLogId: log.id,
          sequence: i + 1,
          fromLocation: (t.fromLocation ?? '').trim(),
          toLocation: (t.toLocation ?? '').trim(),
          clientName: t.clientName?.trim() || null,
          tripType: (t.tripType || 'DELIVERY').trim() || 'DELIVERY',
          notes: t.notes?.trim() || null,
        })),
      });

      return tx.dailyTripLog.findUnique({
        where: { id: log.id },
        include: {
          trips: { orderBy: { sequence: 'asc' } },
          driver: { select: { id: true, name: true } },
          vehicle: {
            select: { id: true, regNumber: true, make: true, model: true },
          },
        },
      });
    });
  }

  async applyWhatsAppBlocks(data: {
    dateIso: string;
    blocks: ParsedDailyTripBlock[];
  }): Promise<
    { driverName: string; vehicleReg: string; tripCount: number }[]
  > {
    const results: {
      driverName: string;
      vehicleReg: string;
      tripCount: number;
    }[] = [];
    for (const b of data.blocks) {
      if (!b.trips.length) continue;
      await this.createOrReplace(
        {
          date: data.dateIso,
          driverName: b.driverName,
          vehicleReg: b.vehicleReg,
          trips: b.trips,
          source: 'WHATSAPP',
        },
        null,
      );
      results.push({
        driverName: b.driverName,
        vehicleReg: b.vehicleReg,
        tripCount: b.trips.length,
      });
    }
    return results;
  }

  async findAll(query: {
    date?: string;
    startDate?: string;
    endDate?: string;
    driverId?: string;
    vehicleId?: string;
    vehicleReg?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const where: Record<string, unknown> = {};

    if (query.date) {
      where.date = this.toDateOnly(query.date);
    } else if (query.startDate || query.endDate) {
      const dr: { gte?: Date; lte?: Date } = {};
      if (query.startDate) dr.gte = this.toDateOnly(query.startDate);
      if (query.endDate) {
        const e = this.toDateOnly(query.endDate);
        e.setUTCHours(23, 59, 59, 999);
        dr.lte = e;
      }
      where.date = dr;
    }
    if (query.driverId) where.driverId = query.driverId;
    if (query.vehicleId) where.vehicleId = query.vehicleId;
    if (query.vehicleReg) {
      where.vehicleReg = {
        contains: this.normalizeVehicleReg(query.vehicleReg),
        mode: 'insensitive',
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.dailyTripLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ date: 'desc' }, { vehicleReg: 'asc' }],
        include: {
          trips: { orderBy: { sequence: 'asc' } },
          driver: { select: { id: true, name: true } },
          vehicle: {
            select: { id: true, regNumber: true, make: true, model: true },
          },
        },
      }),
      this.prisma.dailyTripLog.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const log = await this.prisma.dailyTripLog.findUnique({
      where: { id },
      include: {
        trips: { orderBy: { sequence: 'asc' } },
        driver: { select: { id: true, name: true, phone: true } },
        vehicle: {
          select: { id: true, regNumber: true, make: true, model: true },
        },
      },
    });
    if (!log) throw new NotFoundException('Daily trip log not found');
    return log;
  }

  async update(
    id: string,
    dto: Partial<{
      driverName: string;
      notes: string;
      trips: DailyTripInput[];
      source: string;
    }>,
    createdBy?: string | null,
  ) {
    await this.findOne(id);
    const data: Record<string, unknown> = {};
    if (dto.driverName !== undefined) {
      const dn = dto.driverName.trim() || 'Unknown';
      data.driverName = dn;
      data.driverId = await this.resolveDriverId(dn);
    }
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;
    if (dto.source !== undefined) data.source = dto.source?.trim() || 'MANUAL';
    if (createdBy != null) data.createdBy = createdBy;

    return this.prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.dailyTripLog.update({ where: { id }, data });
      }
      if (dto.trips) {
        if (!dto.trips.length) {
          throw new BadRequestException('At least one trip entry is required');
        }
        await tx.dailyTripEntry.deleteMany({ where: { dailyTripLogId: id } });
        await tx.dailyTripEntry.createMany({
          data: dto.trips.map((t, i) => ({
            dailyTripLogId: id,
            sequence: i + 1,
            fromLocation: (t.fromLocation ?? '').trim(),
            toLocation: (t.toLocation ?? '').trim(),
            clientName: t.clientName?.trim() || null,
            tripType: (t.tripType || 'DELIVERY').trim() || 'DELIVERY',
            notes: t.notes?.trim() || null,
          })),
        });
      }
      return tx.dailyTripLog.findUnique({
        where: { id },
        include: {
          trips: { orderBy: { sequence: 'asc' } },
          driver: { select: { id: true, name: true } },
          vehicle: {
            select: { id: true, regNumber: true, make: true, model: true },
          },
        },
      });
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.dailyTripLog.delete({ where: { id } });
    return { success: true };
  }

  async summary(startDate: string, endDate: string) {
    const gte = this.toDateOnly(startDate);
    const lte = this.toDateOnly(endDate);
    lte.setUTCHours(23, 59, 59, 999);

    const logs = await this.prisma.dailyTripLog.findMany({
      where: { date: { gte, lte } },
      include: {
        trips: { select: { id: true, clientName: true, toLocation: true } },
      },
    });

    const totalDays = logs.length;
    const totalTrips = logs.reduce((s, l) => s + l.trips.length, 0);

    const driverMap = new Map<
      string,
      { tripCount: number; days: Set<string> }
    >();
    const clientMap = new Map<string, number>();
    const vehicleMap = new Map<string, number>();

    for (const log of logs) {
      const dayKey = log.date.toISOString().slice(0, 10);
      const dn = log.driverName || 'Unknown';
      if (!driverMap.has(dn)) {
        driverMap.set(dn, { tripCount: 0, days: new Set() });
      }
      const dEnt = driverMap.get(dn)!;
      dEnt.tripCount += log.trips.length;
      dEnt.days.add(dayKey);

      vehicleMap.set(
        log.vehicleReg,
        (vehicleMap.get(log.vehicleReg) || 0) + log.trips.length,
      );

      for (const t of log.trips) {
        const c =
          (t.clientName && t.clientName.trim()) ||
          t.toLocation ||
          'Unknown';
        clientMap.set(c, (clientMap.get(c) || 0) + 1);
      }
    }

    const driverSummary = [...driverMap.entries()]
      .map(([driverName, v]) => ({
        driverName,
        tripCount: v.tripCount,
        daysWorked: v.days.size,
      }))
      .sort((a, b) => b.tripCount - a.tripCount);

    const clientSummary = [...clientMap.entries()]
      .map(([clientName, tripCount]) => ({ clientName, tripCount }))
      .sort((a, b) => b.tripCount - a.tripCount);

    const vehicleSummary = [...vehicleMap.entries()]
      .map(([vehicleReg, tripCount]) => ({ vehicleReg, tripCount }))
      .sort((a, b) => b.tripCount - a.tripCount);

    return {
      totalDays,
      totalTrips,
      driverSummary,
      clientSummary,
      vehicleSummary,
    };
  }
}
