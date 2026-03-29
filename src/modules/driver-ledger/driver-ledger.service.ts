import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

const CREDIT_TYPES = ['EXTRA_DUTY', 'BONUS'];
const DEBIT_TYPES = ['ADVANCE_RECOVERY', 'PENALTY', 'FOOD', 'FUEL_ADVANCE', 'TOLL', 'MAINTENANCE'];

function classifyEntry(type: string, amount: number): 'credit' | 'debit' {
  if (CREDIT_TYPES.includes(type)) return 'credit';
  if (DEBIT_TYPES.includes(type)) return 'debit';
  if (type === 'OTHER') return amount >= 0 ? 'credit' : 'debit';
  return 'debit';
}

@Injectable()
export class DriverLedgerService {
  constructor(private prisma: PrismaService) {}

  // ────────────────────────────────────────────
  // LEDGER ENTRIES — CRUD
  // ────────────────────────────────────────────

  async findAllEntries(query: any) {
    const {
      driverId,
      type,
      dateFrom,
      dateTo,
      month,
      year,
      page = 1,
      limit = 20,
    } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = {};

    if (driverId) where.driverId = driverId;
    if (type) where.type = type;
    if (month) where.month = Number(month);
    if (year) where.year = Number(year);
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) where.date.lte = new Date(dateTo);
    }

    const [data, total] = await Promise.all([
      this.prisma.driverLedger.findMany({
        where,
        skip,
        take: Number(limit),
        include: { driver: { select: { name: true, phone: true, employeeCode: true } } },
        orderBy: { date: 'desc' },
      }),
      this.prisma.driverLedger.count({ where }),
    ]);

    return {
      data,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    };
  }

  async findOneEntry(id: string) {
    const entry = await this.prisma.driverLedger.findUnique({
      where: { id },
      include: { driver: { select: { name: true, phone: true, employeeCode: true } } },
    });
    if (!entry) throw new NotFoundException('Ledger entry not found');
    return entry;
  }

  async createEntry(dto: any) {
    const driver = await this.prisma.driver.findFirst({
      where: { id: dto.driverId, isDeleted: false },
    });
    if (!driver) throw new NotFoundException('Driver not found');

    const date = dto.date ? new Date(dto.date) : new Date();
    const entryMonth = dto.month ?? date.getMonth() + 1;
    const entryYear = dto.year ?? date.getFullYear();
    const paid = dto.isPaid === true || dto.isPaid === 'true';

    const entry = await this.prisma.driverLedger.create({
      data: {
        driverId: dto.driverId,
        date,
        type: dto.type,
        category: dto.category || dto.type,
        description: dto.description || '',
        amount: new Prisma.Decimal(Number(dto.amount) || 0),
        isCredit: dto.isCredit ?? this.isTypeCredit(dto.type),
        tripId: dto.tripId || null,
        approvedBy: dto.approvedBy || null,
        notes: dto.notes || null,
        month: entryMonth,
        year: entryYear,
        isPaid: paid,
        paidDate: paid ? new Date() : null,
        paidMode: paid ? (dto.paidMode || null) : null,
        paidRef: paid ? (dto.paidRef || null) : null,
        paidBy: paid ? (dto.paidBy || null) : null,
        paidNotes: paid ? (dto.paidNotes || null) : null,
      },
      include: { driver: { select: { name: true, phone: true } } },
    });

    return entry;
  }

  async updateEntry(id: string, dto: any) {
    const existing = await this.prisma.driverLedger.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Ledger entry not found');

    const data: any = {};
    if (dto.date !== undefined) data.date = new Date(dto.date);
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.amount !== undefined) data.amount = new Prisma.Decimal(Number(dto.amount));
    if (dto.isCredit !== undefined) data.isCredit = dto.isCredit;
    if (dto.tripId !== undefined) data.tripId = dto.tripId || null;
    if (dto.approvedBy !== undefined) data.approvedBy = dto.approvedBy;
    if (dto.notes !== undefined) data.notes = dto.notes;

    return this.prisma.driverLedger.update({
      where: { id },
      data,
      include: { driver: { select: { name: true, phone: true } } },
    });
  }

  async markEntryPaid(id: string, dto: {
    paidMode: string;
    paidRef?: string;
    paidBy: string;
    paidNotes?: string;
  }) {
    const existing = await this.prisma.driverLedger.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Ledger entry not found');

    return this.prisma.driverLedger.update({
      where: { id },
      data: {
        isPaid: true,
        paidDate: new Date(),
        paidMode: dto.paidMode,
        paidRef: dto.paidRef || null,
        paidBy: dto.paidBy,
        paidNotes: dto.paidNotes || null,
      },
      include: { driver: { select: { name: true, phone: true } } },
    });
  }

  async deleteEntry(id: string) {
    const existing = await this.prisma.driverLedger.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Ledger entry not found');
    await this.prisma.driverLedger.delete({ where: { id } });
    return { success: true };
  }

  // ────────────────────────────────────────────
  // DRIVER SUMMARY & BALANCE
  // ────────────────────────────────────────────

  async getDriverSummary(driverId: string, query: any) {
    const driver = await this.prisma.driver.findFirst({
      where: { id: driverId, isDeleted: false },
      select: { id: true, name: true, phone: true, employeeCode: true, baseSalary: true, salary: true },
    });
    if (!driver) throw new NotFoundException('Driver not found');

    const month = query.month ? Number(query.month) : new Date().getMonth() + 1;
    const year = query.year ? Number(query.year) : new Date().getFullYear();

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const entries = await this.prisma.driverLedger.findMany({
      where: { driverId, date: { gte: startDate, lte: endDate } },
      orderBy: { date: 'asc' },
    });

    const s = this.computePaidUnpaidSummary(entries);
    const baseSalary = Number(driver.baseSalary ?? (driver as any).salary ?? 0);

    return {
      driver,
      driverName: driver.name,
      month,
      year,
      baseSalary,
      ...s,
      netPayable: baseSalary + s.totalCredits - s.totalDebits,
      entries: entries.length,
    };
  }

  buildDateFilter(filterType: string, params: any) {
    const now = new Date();
    switch (filterType) {
      case 'month': {
        const m = parseInt(params.month) || (now.getMonth() + 1);
        const y = parseInt(params.year) || now.getFullYear();
        return { gte: new Date(y, m - 1, 1), lte: new Date(y, m, 0, 23, 59, 59) };
      }
      case 'year': {
        if (params.financialYear) {
          const [startYr] = params.financialYear.split('-');
          const fy = parseInt(startYr);
          return { gte: new Date(fy, 3, 1), lte: new Date(fy + 1, 2, 31, 23, 59, 59) };
        }
        const yr = parseInt(params.year) || now.getFullYear();
        return { gte: new Date(yr, 0, 1), lte: new Date(yr, 11, 31, 23, 59, 59) };
      }
      case 'lastX': {
        const months = parseInt(params.lastMonths) || 3;
        return { gte: new Date(now.getFullYear(), now.getMonth() - months, 1), lte: now };
      }
      case 'custom': {
        if (!params.startDate || !params.endDate) return undefined;
        return { gte: new Date(params.startDate), lte: new Date(params.endDate + 'T23:59:59') };
      }
      case 'all':
      default:
        return undefined;
    }
  }

  async findByFilters(driverId: string, filterType: string, params: any) {
    const where: any = {};
    if (driverId) where.driverId = driverId;

    const dateFilter = this.buildDateFilter(filterType || 'month', params);
    if (dateFilter) where.date = dateFilter;

    const entries = await this.prisma.driverLedger.findMany({
      where,
      orderBy: { date: 'asc' },
      include: { driver: { select: { name: true, phone: true, employeeCode: true } } },
    });

    return {
      entries,
      summary: this.computePaidUnpaidSummary(entries),
    };
  }

  private computePaidUnpaidSummary(entries: any[]) {
    let paidCredits = 0, unpaidCredits = 0;
    let paidDebits = 0, unpaidDebits = 0;

    for (const e of entries) {
      const amt = Math.abs(Number(e.amount));
      const side = classifyEntry(e.type, Number(e.amount));

      if (side === 'credit') {
        if (e.isPaid) paidCredits += amt;
        else unpaidCredits += amt;
      } else {
        if (e.isPaid) paidDebits += amt;
        else unpaidDebits += amt;
      }
    }

    return {
      paidCredits,
      unpaidCredits,
      paidDebits,
      unpaidDebits,
      totalCredits: paidCredits + unpaidCredits,
      totalDebits: paidDebits + unpaidDebits,
      net: (paidCredits + unpaidCredits) - (paidDebits + unpaidDebits),
      entryCount: entries.length,
    };
  }

  async getDriverBalance(driverId: string) {
    const driver = await this.prisma.driver.findFirst({
      where: { id: driverId, isDeleted: false },
      select: { id: true, name: true, phone: true, employeeCode: true, baseSalary: true },
    });
    if (!driver) throw new NotFoundException('Driver not found');

    const advanceTypes = ['ADVANCE', 'FUEL_ADVANCE'];
    const recoveryTypes = ['ADVANCE_RECOVERY'];

    const [advanceAgg, recoveryAgg] = await Promise.all([
      this.prisma.driverLedger.aggregate({
        where: { driverId, type: { in: advanceTypes as any } },
        _sum: { amount: true },
      }),
      this.prisma.driverLedger.aggregate({
        where: { driverId, type: { in: recoveryTypes as any } },
        _sum: { amount: true },
      }),
    ]);

    const totalAdvances = Number(advanceAgg._sum.amount ?? 0);
    const totalRecovered = Number(recoveryAgg._sum.amount ?? 0);
    const outstandingBalance = totalAdvances - totalRecovered;

    return {
      driver,
      totalAdvances,
      totalRecovered,
      outstandingBalance,
    };
  }

  // ────────────────────────────────────────────
  // QUICK ACTIONS
  // ────────────────────────────────────────────

  async giveAdvance(dto: { driverId: string; amount: number; description?: string; date?: string }) {
    return this.createEntry({
      driverId: dto.driverId,
      type: 'ADVANCE',
      category: 'ADVANCE',
      description: dto.description || 'Cash advance',
      amount: dto.amount,
      isCredit: false,
      isPaid: true,
      paidMode: 'CASH',
      paidBy: 'Admin',
      date: dto.date,
    });
  }

  async recordExtraDuty(dto: {
    driverId: string;
    amount: number;
    tripId?: string;
    description?: string;
    date?: string;
  }) {
    return this.createEntry({
      driverId: dto.driverId,
      type: 'EXTRA_DUTY',
      category: 'EXTRA_DUTY',
      description: dto.description || 'Extra duty payment',
      amount: dto.amount,
      isCredit: true,
      tripId: dto.tripId,
      date: dto.date,
    });
  }

  // ────────────────────────────────────────────
  // SALARY MANAGEMENT
  // ────────────────────────────────────────────

  async findAllSalaries(query: any) {
    const { driverId, month, year, status, page = 1, limit = 20 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = {};

    if (driverId) where.driverId = driverId;
    if (month) where.month = Number(month);
    if (year) where.year = Number(year);
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.driverSalary.findMany({
        where,
        skip,
        take: Number(limit),
        include: { driver: { select: { name: true, phone: true, employeeCode: true } } },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      }),
      this.prisma.driverSalary.count({ where }),
    ]);

    return {
      data,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    };
  }

  async findOneSalary(id: string) {
    const record = await this.prisma.driverSalary.findUnique({
      where: { id },
      include: { driver: { select: { name: true, phone: true, employeeCode: true, baseSalary: true } } },
    });
    if (!record) throw new NotFoundException('Salary record not found');
    return record;
  }

  async calculateSalary(dto: { driverId: string; month: number; year: number }) {
    const { driverId, month, year } = dto;
    if (!month || !year || month < 1 || month > 12) {
      throw new BadRequestException('Valid month (1-12) and year required');
    }

    const driver = await this.prisma.driver.findFirst({
      where: { id: driverId, isDeleted: false },
    });
    if (!driver) throw new NotFoundException('Driver not found');

    const baseSalary = Number(driver.baseSalary ?? driver.salary ?? 0);

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const entries = await this.prisma.driverLedger.findMany({
      where: { driverId, date: { gte: startDate, lte: endDate } },
    });

    let extraDutyPay = 0;
    let bonuses = 0;
    let totalAdvances = 0;
    let penalties = 0;
    let otherCredits = 0;
    let otherDebits = 0;

    for (const e of entries) {
      const amt = Math.abs(Number(e.amount));
      const side = classifyEntry(e.type, Number(e.amount));

      switch (e.type) {
        case 'EXTRA_DUTY':
          if (!e.isPaid) extraDutyPay += amt;
          break;
        case 'BONUS':
          if (!e.isPaid) bonuses += amt;
          break;
        case 'ADVANCE_RECOVERY':
        case 'FUEL_ADVANCE':
          totalAdvances += amt;
          break;
        case 'PENALTY':
          penalties += amt;
          break;
        case 'FOOD':
        case 'TOLL':
        case 'MAINTENANCE':
          if (e.isPaid) totalAdvances += amt;
          else otherDebits += amt;
          break;
        default:
          if (side === 'credit') {
            if (!e.isPaid) otherCredits += amt;
          } else {
            if (e.isPaid) totalAdvances += amt;
            else otherDebits += amt;
          }
          break;
      }
    }

    const netPayable =
      baseSalary + extraDutyPay + bonuses + otherCredits - totalAdvances - penalties - otherDebits;

    const record = await this.prisma.driverSalary.upsert({
      where: { driverId_month_year: { driverId, month, year } },
      update: {
        baseSalary,
        totalAdvances,
        extraDutyPay,
        bonuses,
        penalties,
        otherCredits,
        otherDebits,
        netPayable,
        status: 'CALCULATED',
      },
      create: {
        driverId,
        month,
        year,
        baseSalary,
        totalAdvances,
        extraDutyPay,
        bonuses,
        penalties,
        otherCredits,
        otherDebits,
        netPayable,
        status: 'CALCULATED',
      },
      include: { driver: { select: { name: true, phone: true, employeeCode: true } } },
    });

    return record;
  }

  async calculateAllSalaries(dto: { month: number; year: number }) {
    const { month, year } = dto;
    if (!month || !year || month < 1 || month > 12) {
      throw new BadRequestException('Valid month (1-12) and year required');
    }

    const drivers = await this.prisma.driver.findMany({
      where: { isDeleted: false, status: { not: 'TERMINATED' } },
      select: { id: true },
    });

    const results = [];
    for (const d of drivers) {
      const record = await this.calculateSalary({ driverId: d.id, month, year });
      results.push(record);
    }

    return { count: results.length, records: results };
  }

  async approveSalary(id: string) {
    const record = await this.prisma.driverSalary.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('Salary record not found');
    if (record.status !== 'CALCULATED' && record.status !== 'PENDING') {
      throw new BadRequestException('Only PENDING or CALCULATED records can be approved');
    }
    return this.prisma.driverSalary.update({
      where: { id },
      data: { status: 'APPROVED' },
      include: { driver: { select: { name: true } } },
    });
  }

  async paySalary(id: string, dto: {
    paidAmount: number;
    paidDate?: string;
    paymentMode?: string;
    transactionRef?: string;
    paidBy?: string;
    notes?: string;
  }) {
    const record = await this.prisma.driverSalary.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('Salary record not found');

    const paidAmount = Number(dto.paidAmount) || 0;
    const totalPaid = Number(record.paidAmount) + paidAmount;
    const netPayable = Number(record.netPayable);
    const status = totalPaid >= netPayable ? 'PAID' : 'PARTIAL';

    const updated = await this.prisma.driverSalary.update({
      where: { id },
      data: {
        paidAmount: totalPaid,
        paidDate: dto.paidDate ? new Date(dto.paidDate) : new Date(),
        paymentMode: dto.paymentMode || null,
        transactionRef: dto.transactionRef || null,
        paidBy: dto.paidBy || null,
        status,
        notes: dto.notes ?? record.notes,
      },
      include: { driver: { select: { name: true } } },
    });

    await this.createEntry({
      driverId: record.driverId,
      type: 'SALARY',
      category: 'SALARY',
      description: `Salary payment for ${record.month}/${record.year}`,
      amount: paidAmount,
      isCredit: true,
      isPaid: true,
      paidMode: dto.paymentMode || 'CASH',
      paidBy: dto.paidBy || 'Admin',
      date: dto.paidDate || new Date().toISOString(),
      month: record.month,
      year: record.year,
    });

    return updated;
  }

  // ────────────────────────────────────────────
  // HELPERS
  // ────────────────────────────────────────────

  private isTypeCredit(type: string): boolean {
    const creditTypes = ['SALARY', 'EXTRA_DUTY', 'BONUS'];
    return creditTypes.includes(type);
  }
}
