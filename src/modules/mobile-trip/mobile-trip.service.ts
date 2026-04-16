import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MobileTripService {
  constructor(private prisma: PrismaService) {}

  private async getDriverForUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        driver: {
          include: {
            assignments: {
              where: { isCurrent: true },
              include: { vehicle: { select: { id: true, regNumber: true } } },
              take: 1,
            },
          },
        },
      },
    });
    if (!user?.driver) throw new ForbiddenException('No driver profile linked to this account');
    return user.driver;
  }

  async startTrip(userId: string, dto: {
    clientId?: string;
    clientName?: string;
    pickupLocationId?: string;
    pickupName: string;
    dropLocationId?: string;
    dropName: string;
    pickupLat?: number;
    pickupLng?: number;
  }) {
    const driver = await this.getDriverForUser(userId);
    const assignment = driver.assignments[0];
    if (!assignment) {
      throw new BadRequestException('No vehicle assigned. Contact your manager.');
    }

    const active = await this.prisma.mobileTrip.findFirst({
      where: { driverId: driver.id, status: 'ACTIVE' },
    });
    if (active) {
      throw new BadRequestException('You already have an active trip. End it first.');
    }

    const trip = await this.prisma.mobileTrip.create({
      data: {
        driverId: driver.id,
        vehicleId: assignment.vehicleId,
        clientId: dto.clientId || null,
        clientName: dto.clientName?.trim() || null,
        pickupLocationId: dto.pickupLocationId || null,
        pickupName: dto.pickupName.trim(),
        pickupLat: dto.pickupLat ?? null,
        pickupLng: dto.pickupLng ?? null,
        dropLocationId: dto.dropLocationId || null,
        dropName: dto.dropName.trim(),
        status: 'ACTIVE',
      },
      include: {
        vehicle: { select: { regNumber: true } },
        client: { select: { name: true } },
      },
    });

    return {
      tripId: trip.id,
      status: trip.status,
      startTime: trip.startTime,
      vehicle: trip.vehicle,
      pickupName: trip.pickupName,
      dropName: trip.dropName,
    };
  }

  async endTrip(
    userId: string,
    tripId: string,
    dto: { dropLat?: number; dropLng?: number },
  ) {
    const driver = await this.getDriverForUser(userId);
    const trip = await this.prisma.mobileTrip.findUnique({
      where: { id: tripId },
    });
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.driverId !== driver.id) throw new ForbiddenException('Not your trip');
    if (trip.status !== 'ACTIVE') throw new BadRequestException('Trip is not active');

    const endTime = new Date();
    const durationMinutes = Math.round(
      (endTime.getTime() - trip.startTime.getTime()) / 60_000,
    );

    const points = await this.prisma.tripGpsPoint.findMany({
      where: { tripId },
      orderBy: { timestamp: 'asc' },
      select: { lat: true, lng: true },
    });
    const distanceKm = this.calculateDistance(points);

    const updated = await this.prisma.mobileTrip.update({
      where: { id: tripId },
      data: {
        status: 'COMPLETED',
        endTime,
        durationMinutes,
        distanceKm,
        dropLat: dto.dropLat ?? null,
        dropLng: dto.dropLng ?? null,
      },
    });

    return {
      tripId: updated.id,
      status: updated.status,
      distanceKm,
      durationMinutes,
      endTime: updated.endTime,
    };
  }

  async addGpsPoints(
    userId: string,
    tripId: string,
    points: { lat: number; lng: number; speed?: number; accuracy?: number; timestamp: string }[],
  ) {
    const driver = await this.getDriverForUser(userId);
    const trip = await this.prisma.mobileTrip.findUnique({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.driverId !== driver.id) throw new ForbiddenException('Not your trip');
    if (trip.status !== 'ACTIVE') throw new BadRequestException('Trip is not active');

    const data = points.map((p) => ({
      tripId,
      lat: p.lat,
      lng: p.lng,
      speed: p.speed ?? null,
      accuracy: p.accuracy ?? null,
      timestamp: new Date(p.timestamp),
    }));

    const result = await this.prisma.tripGpsPoint.createMany({ data });
    return { inserted: result.count };
  }

  async getActiveTrip(userId: string) {
    const driver = await this.getDriverForUser(userId);
    const trip = await this.prisma.mobileTrip.findFirst({
      where: { driverId: driver.id, status: 'ACTIVE' },
      include: {
        vehicle: { select: { id: true, regNumber: true } },
        client: { select: { id: true, name: true } },
      },
    });
    return trip;
  }

  async getTodayTrips(userId: string) {
    const driver = await this.getDriverForUser(userId);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const trips = await this.prisma.mobileTrip.findMany({
      where: {
        driverId: driver.id,
        startTime: { gte: start, lte: end },
      },
      include: {
        vehicle: { select: { regNumber: true } },
        client: { select: { name: true } },
      },
      orderBy: { startTime: 'desc' },
    });

    const totalKm = trips.reduce((s, t) => s + (t.distanceKm ?? 0), 0);
    const totalMinutes = trips.reduce((s, t) => s + (t.durationMinutes ?? 0), 0);
    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

    return {
      trips,
      stats: {
        totalTrips: trips.length,
        totalKm: Math.round(totalKm * 10) / 10,
        totalHours,
      },
    };
  }

  async getHistory(
    userId: string,
    role: string,
    query: {
      page?: number;
      limit?: number;
      from?: string;
      to?: string;
      driverId?: string;
      vehicleId?: string;
      clientId?: string;
    },
  ) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER'].includes(role);

    if (!isAdmin) {
      const driver = await this.getDriverForUser(userId);
      where.driverId = driver.id;
    } else {
      if (query.driverId) where.driverId = query.driverId;
      if (query.vehicleId) where.vehicleId = query.vehicleId;
      if (query.clientId) where.clientId = query.clientId;
    }

    if (query.from || query.to) {
      where.startTime = {};
      if (query.from) (where.startTime as Record<string, unknown>).gte = new Date(query.from);
      if (query.to) (where.startTime as Record<string, unknown>).lte = new Date(query.to);
    }

    const [data, total] = await Promise.all([
      this.prisma.mobileTrip.findMany({
        where: where as any,
        skip,
        take: limit,
        include: {
          driver: { select: { name: true, phone: true } },
          vehicle: { select: { regNumber: true } },
          client: { select: { name: true } },
        },
        orderBy: { startTime: 'desc' },
      }),
      this.prisma.mobileTrip.count({ where: where as any }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getRoute(userId: string, role: string, tripId: string) {
    const trip = await this.prisma.mobileTrip.findUnique({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Trip not found');

    const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER'].includes(role);
    if (!isAdmin) {
      const driver = await this.getDriverForUser(userId);
      if (trip.driverId !== driver.id) throw new ForbiddenException('Not your trip');
    }

    const points = await this.prisma.tripGpsPoint.findMany({
      where: { tripId },
      orderBy: { timestamp: 'asc' },
      select: { lat: true, lng: true, speed: true, accuracy: true, timestamp: true },
    });

    return { tripId, points };
  }

  private calculateDistance(points: { lat: number; lng: number }[]): number {
    if (points.length < 2) return 0;
    let totalKm = 0;
    for (let i = 1; i < points.length; i++) {
      totalKm += this.haversine(
        points[i - 1].lat, points[i - 1].lng,
        points[i].lat, points[i].lng,
      );
    }
    return Math.round(totalKm * 10) / 10;
  }

  private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
