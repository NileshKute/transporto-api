import { Injectable, NotFoundException } from '@nestjs/common';
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
    let distanceKm = dto.distanceKm;
    if (dto.endKm !== undefined && dto.startKm !== undefined) {
      distanceKm = dto.endKm - dto.startKm;
    } else if (dto.endKm !== undefined) {
      const trip = await this.prisma.trip.findUnique({ where: { id } });
      distanceKm = dto.endKm - trip.startKm;
    }
    return this.prisma.trip.update({
      where: { id },
      data: { ...dto, ...(distanceKm !== undefined && { distanceKm }) },
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
