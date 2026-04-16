import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MobileFleetService {
  constructor(private prisma: PrismaService) {}

  async getOverview() {
    const activeTrips = await this.prisma.mobileTrip.findMany({
      where: { status: 'ACTIVE' },
      include: {
        driver: { select: { id: true, name: true, phone: true } },
        vehicle: { select: { id: true, regNumber: true } },
        client: { select: { name: true } },
      },
    });

    const vehicleIdsOnRoad = new Set(activeTrips.map((t) => t.vehicleId));
    const totalVehicles = await this.prisma.vehicle.count({
      where: { isDeleted: false, status: 'ACTIVE' },
    });

    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 86_400_000);
    const expiringDocs = await this.prisma.vehicle.count({
      where: {
        isDeleted: false,
        OR: [
          { pucExpiryDate: { lte: in30Days } },
          { insuranceExpiryDate: { lte: in30Days } },
          { fitnessExpiryDate: { lte: in30Days } },
          { permitExpiryDate: { lte: in30Days } },
        ],
      },
    });

    return {
      vehiclesOnRoad: vehicleIdsOnRoad.size,
      vehiclesIdle: totalVehicles - vehicleIdsOnRoad.size,
      activeAlerts: expiringDocs,
      activeTrips: activeTrips.map((t) => ({
        tripId: t.id,
        driver: t.driver,
        vehicle: t.vehicle,
        client: t.client?.name ?? t.clientName,
        pickupName: t.pickupName,
        dropName: t.dropName,
        startTime: t.startTime,
      })),
    };
  }

  async getVehicles() {
    const vehicles = await this.prisma.vehicle.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        regNumber: true,
        make: true,
        model: true,
        type: true,
        status: true,
        lastLatitude: true,
        lastLongitude: true,
        lastSpeed: true,
        lastTemperature: true,
        lastGpsUpdate: true,
        gpsStatus: true,
        assignments: {
          where: { isCurrent: true },
          include: { driver: { select: { id: true, name: true, phone: true } } },
          take: 1,
        },
        mobileTrips: {
          where: { status: 'ACTIVE' },
          select: {
            id: true,
            pickupName: true,
            dropName: true,
            startTime: true,
            clientName: true,
          },
          take: 1,
        },
      },
      orderBy: { regNumber: 'asc' },
    });

    return vehicles.map((v) => ({
      id: v.id,
      regNumber: v.regNumber,
      make: v.make,
      model: v.model,
      type: v.type,
      status: v.status,
      gps: {
        lat: v.lastLatitude,
        lng: v.lastLongitude,
        speed: v.lastSpeed,
        temperature: v.lastTemperature,
        lastUpdate: v.lastGpsUpdate,
        gpsStatus: v.gpsStatus,
      },
      driver: v.assignments[0]?.driver ?? null,
      activeTrip: v.mobileTrips[0] ?? null,
    }));
  }

  async getDrivers() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const drivers = await this.prisma.driver.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        name: true,
        phone: true,
        status: true,
        photoUrl: true,
        licenseExpiry: true,
        assignments: {
          where: { isCurrent: true },
          include: { vehicle: { select: { id: true, regNumber: true } } },
          take: 1,
        },
        mobileTrips: {
          where: { status: 'ACTIVE' },
          select: { id: true },
          take: 1,
        },
      },
      orderBy: { name: 'asc' },
    });

    const driverIds = drivers.map((d) => d.id);
    const todayTrips = await this.prisma.mobileTrip.groupBy({
      by: ['driverId'],
      where: {
        driverId: { in: driverIds },
        startTime: { gte: today, lte: endOfDay },
      },
      _count: { id: true },
    });
    const tripCountMap = new Map(
      todayTrips.map((r) => [r.driverId, r._count.id]),
    );

    const now = Date.now();
    return drivers.map((d) => {
      const licDaysLeft = d.licenseExpiry
        ? Math.ceil((d.licenseExpiry.getTime() - now) / 86_400_000)
        : null;

      return {
        id: d.id,
        name: d.name,
        phone: d.phone,
        status: d.status,
        photoUrl: d.photoUrl,
        onTrip: d.mobileTrips.length > 0,
        todayTripCount: tripCountMap.get(d.id) ?? 0,
        assignedVehicle: d.assignments[0]?.vehicle ?? null,
        licenseExpiry: d.licenseExpiry,
        licenseAlert: licDaysLeft !== null && licDaysLeft <= 30
          ? { daysLeft: licDaysLeft, level: licDaysLeft <= 0 ? 'expired' : licDaysLeft <= 7 ? 'critical' : licDaysLeft <= 15 ? 'warning' : 'notice' }
          : null,
      };
    });
  }

  async getAlerts() {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 86_400_000);

    const vehicles = await this.prisma.vehicle.findMany({
      where: {
        isDeleted: false,
        OR: [
          { pucExpiryDate: { lte: in30Days } },
          { insuranceExpiryDate: { lte: in30Days } },
          { fitnessExpiryDate: { lte: in30Days } },
          { permitExpiryDate: { lte: in30Days } },
          { taxExpiryDate: { lte: in30Days } },
        ],
      },
      select: {
        id: true,
        regNumber: true,
        pucExpiryDate: true,
        insuranceExpiryDate: true,
        fitnessExpiryDate: true,
        permitExpiryDate: true,
        taxExpiryDate: true,
      },
    });

    const driverAlerts = await this.prisma.driver.findMany({
      where: { isDeleted: false, licenseExpiry: { lte: in30Days } },
      select: { id: true, name: true, phone: true, licenseExpiry: true },
    });

    const alerts: {
      type: string;
      entityType: 'vehicle' | 'driver';
      entityId: string;
      entityLabel: string;
      expiryDate: Date;
      daysLeft: number;
      level: string;
    }[] = [];

    const addAlert = (
      type: string,
      entityType: 'vehicle' | 'driver',
      entityId: string,
      label: string,
      date: Date | null | undefined,
    ) => {
      if (!date) return;
      const days = Math.ceil((date.getTime() - now.getTime()) / 86_400_000);
      if (days > 30) return;
      let level = 'notice';
      if (days <= 0) level = 'expired';
      else if (days <= 7) level = 'critical';
      else if (days <= 15) level = 'warning';
      alerts.push({ type, entityType, entityId, entityLabel: label, expiryDate: date, daysLeft: days, level });
    };

    for (const v of vehicles) {
      addAlert('PUC', 'vehicle', v.id, v.regNumber, v.pucExpiryDate);
      addAlert('Insurance', 'vehicle', v.id, v.regNumber, v.insuranceExpiryDate);
      addAlert('Fitness', 'vehicle', v.id, v.regNumber, v.fitnessExpiryDate);
      addAlert('Permit', 'vehicle', v.id, v.regNumber, v.permitExpiryDate);
      addAlert('Road Tax', 'vehicle', v.id, v.regNumber, v.taxExpiryDate);
    }

    for (const d of driverAlerts) {
      addAlert('License', 'driver', d.id, d.name, d.licenseExpiry);
    }

    alerts.sort((a, b) => a.daysLeft - b.daysLeft);
    return alerts;
  }
}
