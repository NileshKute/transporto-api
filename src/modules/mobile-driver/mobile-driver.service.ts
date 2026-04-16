import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MobileDriverService {
  constructor(private prisma: PrismaService) {}

  private async getDriverForUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { driver: true },
    });
    if (!user?.driver) throw new ForbiddenException('No driver profile linked');
    return user.driver;
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        driver: {
          include: {
            assignments: {
              where: { isCurrent: true },
              include: {
                vehicle: {
                  select: {
                    id: true,
                    regNumber: true,
                    make: true,
                    model: true,
                    type: true,
                    status: true,
                    pucExpiryDate: true,
                    insuranceExpiryDate: true,
                    fitnessExpiryDate: true,
                    permitExpiryDate: true,
                  },
                },
              },
              take: 1,
            },
          },
        },
      },
    });
    if (!user?.driver) throw new ForbiddenException('No driver profile linked');

    const d = user.driver;
    const vehicle = d.assignments[0]?.vehicle ?? null;

    return {
      id: d.id,
      userId: user.id,
      name: d.name,
      nickname: d.nickname,
      phone: d.phone,
      altPhone: d.altPhone,
      photoUrl: d.photoUrl,
      licenseNumber: d.licenseNumber,
      licenseType: d.licenseType,
      licenseExpiry: d.licenseExpiry,
      dateOfBirth: d.dateOfBirth,
      bloodGroup: d.bloodGroup,
      experience: d.experience,
      status: d.status,
      address: d.address,
      city: d.city,
      state: d.state,
      rating: d.rating,
      totalTrips: d.totalTrips,
      totalKm: d.totalKm,
      joiningDate: d.joiningDate,
      assignedVehicle: vehicle,
      documentAlerts: this.buildDriverDocAlerts(d, vehicle),
    };
  }

  async getSalary(userId: string, month?: string) {
    const driver = await this.getDriverForUser(userId);
    const now = new Date();
    let m: number;
    let y: number;

    if (month) {
      const parts = month.split('-');
      y = parseInt(parts[0], 10);
      m = parseInt(parts[1], 10);
    } else {
      m = now.getMonth() + 1;
      y = now.getFullYear();
    }

    const salary = await this.prisma.driverSalary.findUnique({
      where: { driverId_month_year: { driverId: driver.id, month: m, year: y } },
    });

    const baseSalary = Number(driver.baseSalary ?? driver.salary ?? 0);

    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0, 23, 59, 59);
    const ledgerEntries = await this.prisma.driverLedger.findMany({
      where: {
        driverId: driver.id,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: 'asc' },
    });

    let totalCredits = 0;
    let totalDebits = 0;
    for (const entry of ledgerEntries) {
      if (entry.type === 'SALARY') continue;
      const amt = Number(entry.amount);
      if (entry.isCredit) {
        totalCredits += amt;
      } else {
        totalDebits += amt;
      }
    }

    const netPayable = baseSalary + totalCredits - totalDebits;

    return {
      month: m,
      year: y,
      baseSalary,
      totalCredits,
      totalDebits,
      netPayable,
      status: salary?.status ?? 'PENDING',
      paidAmount: salary ? Number(salary.paidAmount) : 0,
      entries: ledgerEntries.map((e) => ({
        id: e.id,
        date: e.date,
        type: e.type,
        description: e.description,
        amount: Number(e.amount),
        isCredit: e.isCredit,
        isPaid: e.isPaid,
      })),
    };
  }

  async getLedger(
    userId: string,
    role: string,
    query: { from?: string; to?: string; driverId?: string },
  ) {
    const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER', 'ACCOUNTANT'].includes(role);
    let driverId: string;

    if (isAdmin && query.driverId) {
      driverId = query.driverId;
    } else {
      const driver = await this.getDriverForUser(userId);
      driverId = driver.id;
    }

    const where: Record<string, unknown> = { driverId };
    if (query.from || query.to) {
      where.date = {};
      if (query.from) (where.date as Record<string, unknown>).gte = new Date(query.from);
      if (query.to) (where.date as Record<string, unknown>).lte = new Date(query.to);
    }

    const entries = await this.prisma.driverLedger.findMany({
      where: where as any,
      orderBy: { date: 'desc' },
      take: 200,
    });

    return entries.map((e) => ({
      id: e.id,
      date: e.date,
      type: e.type,
      category: e.category,
      description: e.description,
      amount: Number(e.amount),
      isCredit: e.isCredit,
      isPaid: e.isPaid,
      paidDate: e.paidDate,
    }));
  }

  async getDocuments(userId: string) {
    const driver = await this.getDriverForUser(userId);
    return {
      licenseNumber: driver.licenseNumber,
      licenseType: driver.licenseType,
      licenseExpiry: driver.licenseExpiry,
      aadharNumber: driver.aadharNumber ? `XXXX-XXXX-${driver.aadharNumber.slice(-4)}` : null,
      panNumber: driver.panNumber ? `XXXXX${driver.panNumber.slice(-5)}` : null,
      photoUrl: driver.photoUrl,
    };
  }

  private buildDriverDocAlerts(
    driver: { licenseExpiry: Date },
    vehicle: { pucExpiryDate?: Date | null; insuranceExpiryDate?: Date | null; fitnessExpiryDate?: Date | null; permitExpiryDate?: Date | null } | null,
  ) {
    const alerts: { document: string; expiryDate: Date; daysLeft: number; level: string }[] = [];
    const now = Date.now();

    const check = (name: string, date: Date | null | undefined) => {
      if (!date) return;
      const days = Math.ceil((date.getTime() - now) / 86_400_000);
      let level = 'ok';
      if (days <= 0) level = 'expired';
      else if (days <= 7) level = 'critical';
      else if (days <= 15) level = 'warning';
      else if (days <= 30) level = 'notice';
      if (level !== 'ok') {
        alerts.push({ document: name, expiryDate: date, daysLeft: days, level });
      }
    };

    check('Driving License', driver.licenseExpiry);
    if (vehicle) {
      check('PUC', vehicle.pucExpiryDate);
      check('Insurance', vehicle.insuranceExpiryDate);
      check('Fitness', vehicle.fitnessExpiryDate);
      check('Permit', vehicle.permitExpiryDate);
    }
    return alerts.sort((a, b) => a.daysLeft - b.daysLeft);
  }
}
