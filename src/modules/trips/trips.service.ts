import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TripsService {
  constructor(private prisma: PrismaService) {}

  private generateTripNumber(): string {
    const now = new Date();
    const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const rand = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
    return `TRP-${date}-${rand}`;
  }

  async findAll(query: any) {
    const { status, vehicleId, driverId, search, page = 1, limit = 10 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = {};
    if (status) where.status = status;
    if (vehicleId) where.vehicleId = vehicleId;
    if (driverId) where.driverId = driverId;
    if (search) {
      where.OR = [
        { startLocation: { contains: search, mode: 'insensitive' } },
        { endLocation: { contains: search, mode: 'insensitive' } },
        { tripNumber: { contains: search, mode: 'insensitive' } },
        { clientName: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.trip.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          vehicle: { select: { regNumber: true, make: true, model: true } },
          driver: { select: { name: true, phone: true } },
        },
        orderBy: { date: 'desc' },
      }),
      this.prisma.trip.count({ where }),
    ]);
    return { data, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) };
  }

  async findOne(id: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id },
      include: {
        vehicle: true,
        driver: true,
        expenses: true,
      },
    });
    if (!trip) throw new NotFoundException('Trip not found');
    return trip;
  }

  async create(dto: any) {
    const tripNumber = dto.tripNumber || this.generateTripNumber();
    let distanceKm = dto.distanceKm;
    if (dto.endKm && dto.startKm) {
      distanceKm = dto.endKm - dto.startKm;
    }
    return this.prisma.trip.create({
      data: { ...dto, tripNumber, distanceKm },
      include: { vehicle: { select: { regNumber: true } }, driver: { select: { name: true } } },
    });
  }

  async update(id: string, dto: any) {
    await this.findOne(id);

    const data: Record<string, unknown> = {};

    if (dto.date !== undefined) {
      data.date = new Date(dto.date);
    }

    const stringFields = [
      'startLocation', 'endLocation', 'clientName', 'lrNumber',
      'cargoType', 'cargoUnit', 'notes',
    ];
    for (const field of stringFields) {
      if (dto[field] !== undefined) {
        data[field] = typeof dto[field] === 'string' && dto[field].trim()
          ? dto[field].trim()
          : null;
      }
    }

    const optionalNumberFields = [
      'endKm', 'billAmount', 'tollAmount', 'otherExpenses', 'cargoWeight',
    ];
    for (const field of optionalNumberFields) {
      if (dto[field] !== undefined) {
        const val = Number(dto[field]);
        data[field] = Number.isFinite(val) && val !== 0 ? val : null;
      }
    }

    if (dto.startKm !== undefined) {
      data.startKm = Number(dto.startKm) || 0;
    }

    if (dto.status !== undefined) data.status = dto.status;
    if (dto.loadStatus !== undefined) data.loadStatus = dto.loadStatus;
    if (dto.vehicleId !== undefined) data.vehicleId = dto.vehicleId;
    if (dto.driverId !== undefined) data.driverId = dto.driverId;

    let distanceKm = dto.distanceKm;
    if (dto.endKm !== undefined && dto.startKm !== undefined) {
      distanceKm = Number(dto.endKm) - Number(dto.startKm);
    } else if (dto.endKm !== undefined) {
      const trip = await this.prisma.trip.findUnique({ where: { id } });
      distanceKm = Number(dto.endKm) - (trip?.startKm ?? 0);
    }
    if (distanceKm !== undefined) {
      data.distanceKm = Number.isFinite(distanceKm) && distanceKm > 0
        ? distanceKm
        : null;
    }

    return this.prisma.trip.update({ where: { id }, data });
  }

  async remove(id: string) {
    const trip = await this.prisma.trip.findUnique({ where: { id } });
    if (!trip) throw new NotFoundException('Trip not found');
    await this.prisma.trip.delete({ where: { id } });
    return { message: 'Trip deleted successfully' };
  }

  async getPendingTrips(page = 1, limit = 20) {
    const where = { status: 'PENDING_VERIFICATION' as any };
    const [data, total] = await Promise.all([
      this.prisma.trip.findMany({
        where,
        include: {
          vehicle: { select: { id: true, regNumber: true, type: true } },
          driver: { select: { id: true, name: true, phone: true } },
        },
        orderBy: { date: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.trip.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async approveTrip(id: string, userId: string, notes?: string) {
    const trip = await this.findOne(id);
    if ((trip.status as string) !== 'PENDING_VERIFICATION') {
      throw new BadRequestException('Trip is not pending verification');
    }
    return this.prisma.trip.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        verifiedBy: userId,
        verifiedAt: new Date(),
        notes: notes
          ? `${trip.notes || ''}\nApproval note: ${notes}`.trim()
          : trip.notes,
      },
      include: {
        vehicle: { select: { regNumber: true } },
        driver: { select: { name: true, phone: true } },
      },
    });
  }

  async rejectTrip(id: string, userId: string, reason: string) {
    const trip = await this.findOne(id);
    if ((trip.status as string) !== 'PENDING_VERIFICATION') {
      throw new BadRequestException('Trip is not pending verification');
    }
    return this.prisma.trip.update({
      where: { id },
      data: {
        status: 'REJECTED',
        verifiedBy: userId,
        verifiedAt: new Date(),
        rejectedReason: reason,
        notes: `${trip.notes || ''}\nRejected: ${reason}`.trim(),
      },
      include: {
        vehicle: { select: { regNumber: true } },
        driver: { select: { name: true, phone: true } },
      },
    });
  }

  async complete(id: string, dto: any) {
    const trip = await this.findOne(id);
    const endKm = dto.endKm || trip.endKm;
    const distanceKm = endKm ? endKm - trip.startKm : trip.distanceKm;
    return this.prisma.trip.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        endKm,
        distanceKm,
        endTime: new Date(),
        endLocation: dto.endLocation || trip.endLocation,
        notes: dto.notes || trip.notes,
      },
    });
  }
}
