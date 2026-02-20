import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

    const [
      totalVehicles,
      activeVehicles,
      totalDrivers,
      driversOnTrip,
      tripsToday,
      fuelCost,
      activeMaintenance,
      pendingEmergencies,
      expiringInsurance,
      coldStorageAlerts,
      activeShifts,
    ] = await Promise.all([
      this.prisma.vehicle.count({ where: { isDeleted: false } }),
      this.prisma.vehicle.count({ where: { isDeleted: false, status: 'ACTIVE' } }),
      this.prisma.driver.count({ where: { isDeleted: false } }),
      this.prisma.driver.count({ where: { isDeleted: false, status: 'ON_TRIP' } }),
      this.prisma.trip.count({ where: { date: { gte: today } } }),
      this.prisma.fuelEntry.aggregate({ _sum: { totalCost: true } }),
      this.prisma.maintenance.count({ where: { status: 'IN_PROGRESS' } }),
      this.prisma.emergency.count({ where: { status: { in: ['PENDING', 'ACKNOWLEDGED', 'IN_PROGRESS'] } } }),
      this.prisma.insurance.count({ where: { status: { not: 'EXPIRED' }, endDate: { lte: thirtyDaysLater } } }),
      this.prisma.coldStorageAlert.count({ where: { isResolved: false } }),
      this.prisma.shift.count({ where: { status: 'ACTIVE' } }),
    ]);

    return {
      vehicles: { total: totalVehicles, active: activeVehicles },
      drivers: { total: totalDrivers, onTrip: driversOnTrip },
      trips: { today: tripsToday },
      fuel: { totalCost: fuelCost._sum.totalCost || 0 },
      maintenance: { active: activeMaintenance },
      emergencies: { pending: pendingEmergencies },
      insurance: { expiring: expiringInsurance },
      coldStorage: { alerts: coldStorageAlerts },
      shifts: { active: activeShifts },
    };
  }

  async getRecent() {
    const [trips, fuelEntries, emergencies] = await Promise.all([
      this.prisma.trip.findMany({
        take: 5,
        orderBy: { date: 'desc' },
        include: {
          vehicle: { select: { regNumber: true } },
          driver: { select: { name: true } },
        },
      }),
      this.prisma.fuelEntry.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          vehicle: { select: { regNumber: true } },
          driver: { select: { name: true } },
        },
      }),
      this.prisma.emergency.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          vehicle: { select: { regNumber: true } },
          driver: { select: { name: true, phone: true } },
        },
      }),
    ]);
    return { trips, fuelEntries, emergencies };
  }
}
