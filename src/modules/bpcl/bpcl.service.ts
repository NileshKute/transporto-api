import { Injectable, BadRequestException } from '@nestjs/common';
import { FuelType, Prisma, Vehicle } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import * as XLSX from 'xlsx';

@Injectable()
export class BpclService {
  constructor(private prisma: PrismaService) {}

  async importExcel(buffer: Buffer, fileName: string) {
    void fileName;
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const allRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
    });

    let headerIndex = -1;
    for (let i = 0; i < Math.min(20, allRows.length); i++) {
      const row = allRows[i];
      if (
        Array.isArray(row) &&
        row.some((c) => String(c ?? '').includes('Transaction ID'))
      ) {
        headerIndex = i;
        break;
      }
    }
    if (headerIndex === -1) {
      throw new BadRequestException(
        'Invalid BPCL format: header row not found',
      );
    }

    const headers = (allRows[headerIndex] as unknown[]).map((h) =>
      String(h ?? '').trim(),
    );
    const dataRows = allRows.slice(headerIndex + 1);
    const batchId = `IMPORT_${Date.now()}`;

    const col = (search: string) =>
      headers.findIndex((h) => h.toLowerCase().includes(search.toLowerCase()));
    const pickCol = (...searches: string[]) => {
      for (const s of searches) {
        const i = col(s);
        if (i !== -1) return i;
      }
      return -1;
    };

    const C = {
      txnId: col('Transaction ID'),
      date: col('Transaction Date'),
      time: col('Transaction Time'),
      mode: col('Transaction mode'),
      cardName: col('Name of Card'),
      cardNumber: col('Card Number'),
      vehicleNumber: col('Vehicle Number'),
      mobile: col('Mobile Number'),
      stationId: col('Fuel Station ID'),
      stationName: col('Fuel Station Name'),
      stationCity: col('City'),
      stationState: col('State'),
      txnType: col('Transaction Type'),
      txnCategory: col('Transaction Category'),
      product: col('Product Name'),
      volume: pickCol('Volume', 'Quantity', 'Litres'),
      rate: col('Rate'),
      amount: col('Purchase Amount'),
      totalAmount: pickCol('Total Transaction Amount', 'Total Amount'),
      creditDebit: col('Credit / Debit'),
      slipNumber: col('Slip Number'),
    };

    let imported = 0;
    let skipped = 0;
    let duplicates = 0;
    const newCards: string[] = [];
    const newVehicles: string[] = [];
    const errors: string[] = [];

    for (const row of dataRows) {
      if (!Array.isArray(row)) continue;
      const txnId = String(row[C.txnId] ?? '').trim();
      if (!txnId || !txnId.startsWith('TXN')) continue;

      const category = String(row[C.txnCategory] ?? '').toUpperCase();
      if (category && category !== 'SALE') {
        skipped++;
        continue;
      }

      const existing = await this.prisma.bpclTransaction.findUnique({
        where: { txnId },
      });
      if (existing) {
        duplicates++;
        continue;
      }

      const vehicleNumber = this.normalizeBpclVehicleReg(row[C.vehicleNumber]);
      const cardNumber = String(row[C.cardNumber] ?? '').trim();
      if (!vehicleNumber || !cardNumber) {
        skipped++;
        continue;
      }

      const litres = parseFloat(String(row[C.volume] ?? 0)) || 0;
      const rate = parseFloat(String(row[C.rate] ?? 0)) || 0;
      const amount = parseFloat(String(row[C.amount] ?? 0)) || 0;
      const totalAmount =
        parseFloat(String(row[C.totalAmount] ?? 0)) || amount;

      const txnDate = this.parseBpclDate(String(row[C.date] ?? ''));
      if (!txnDate) {
        errors.push(`Row ${txnId}: invalid date ${row[C.date]}`);
        skipped++;
        continue;
      }

      const fuelType = this.mapProductToFuelType(String(row[C.product] ?? ''));
      const { vehicle, wasCreated } = await this.ensureVehicleForBpclImport(
        vehicleNumber,
        fuelType,
      );
      if (wasCreated && !newVehicles.includes(vehicleNumber)) {
        newVehicles.push(vehicleNumber);
      }
      const vehicleId = vehicle.id;

      let card = await this.prisma.bpclCard.findUnique({
        where: { cardNumber },
      });
      if (!card) {
        card = await this.prisma.bpclCard.create({
          data: {
            cardNumber,
            vehicleNumber,
            vehicleId,
            cardName: this.strCell(row[C.cardName]) || null,
            currentTag: 'BUSINESS',
            periods: {
              create: {
                tag: 'BUSINESS',
                startDate: txnDate,
              },
            },
          },
        });
        if (!newCards.includes(cardNumber)) newCards.push(cardNumber);
      }

      await this.prisma.bpclTransaction.create({
        data: {
          txnId,
          txnDate,
          txnTime: this.strCell(row[C.time]) || null,
          cardNumber,
          cardName: this.strCell(row[C.cardName]) || null,
          vehicleNumber,
          vehicleId,
          mobileNumber: this.strCell(row[C.mobile]) || null,
          product: String(row[C.product] ?? 'Diesel'),
          litres,
          rate,
          amount,
          totalAmount,
          stationName: this.strCell(row[C.stationName]) || null,
          stationId: this.strCell(row[C.stationId]) || null,
          stationCity: this.strCell(row[C.stationCity]) || null,
          stationState: this.strCell(row[C.stationState]) || null,
          txnMode: this.strCell(row[C.mode]) || null,
          txnType: this.strCell(row[C.txnType]) || null,
          txnCategory: category || null,
          creditDebit: this.strCell(row[C.creditDebit]) || null,
          slipNumber: this.strCell(row[C.slipNumber]) || null,
          importBatchId: batchId,
        },
      });
      imported++;
    }

    return {
      success: true,
      batchId,
      imported,
      duplicates,
      skipped,
      errors: errors.slice(0, 10),
      newCards: newCards.length,
      newCardsList: newCards,
      newVehicles: newVehicles.length,
      newVehiclesList: newVehicles,
      total: dataRows.length,
    };
  }

  /** BPCL / fleet reg: strip spaces & dashes, uppercase, max DB length. */
  private normalizeBpclVehicleReg(raw: unknown): string {
    return String(raw ?? '')
      .trim()
      .replace(/[\s-]/g, '')
      .toUpperCase()
      .substring(0, 20);
  }

  /**
   * Match vehicles whose stored regNumber differs only by spaces/dashes (same rule as
   * {@link normalizeBpclVehicleReg}). Prisma `equals` cannot see through that formatting.
   */
  private async findVehicleByLooseRegNumber(
    normalizedReg: string,
  ): Promise<Vehicle | null> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`
        SELECT id FROM vehicles
        WHERE UPPER(
          REPLACE(
            regexp_replace(BTRIM("regNumber"), E'\\s+', '', 'g'),
            '-',
            ''
          )
        ) = ${normalizedReg}
        LIMIT 1
      `,
    );
    const id = rows[0]?.id;
    if (!id) return null;
    return this.prisma.vehicle.findUnique({ where: { id } });
  }

  /**
   * Find existing vehicle by reg (case-insensitive), including soft-deleted rows
   * (they still hold the unique regNumber). Revive if deleted; create only when absent.
   * Handles concurrent import races via P2002 retry.
   */
  private async ensureVehicleForBpclImport(
    normalizedReg: string,
    fuelType: FuelType,
  ): Promise<{ vehicle: Vehicle; wasCreated: boolean }> {
    const findMatch = () =>
      this.prisma.vehicle.findFirst({
        where: {
          regNumber: { equals: normalizedReg, mode: 'insensitive' },
        },
      });

    let vehicle = await findMatch();
    if (!vehicle) {
      vehicle = await this.findVehicleByLooseRegNumber(normalizedReg);
    }
    if (vehicle) {
      if (vehicle.isDeleted) {
        vehicle = await this.prisma.vehicle.update({
          where: { id: vehicle.id },
          data: { isDeleted: false, status: 'ACTIVE' },
        });
      }
      return { vehicle, wasCreated: false };
    }

    try {
      vehicle = await this.prisma.vehicle.create({
        data: {
          regNumber: normalizedReg,
          make: 'Unknown',
          model: 'Unknown',
          year: new Date().getFullYear(),
          fuelType,
          type: 'TRUCK',
          status: 'ACTIVE',
          currentKm: 0,
        },
      });
      return { vehicle, wasCreated: true };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        vehicle = (await findMatch()) ?? (await this.findVehicleByLooseRegNumber(normalizedReg));
        if (vehicle) {
          if (vehicle.isDeleted) {
            vehicle = await this.prisma.vehicle.update({
              where: { id: vehicle.id },
              data: { isDeleted: false, status: 'ACTIVE' },
            });
          }
          return { vehicle, wasCreated: false };
        }
      }
      throw e;
    }
  }

  private strCell(v: unknown): string | null {
    if (v == null) return null;
    const s = String(v).trim();
    return s.length ? s : null;
  }

  private mapProductToFuelType(product: string): FuelType {
    const u = product.toUpperCase();
    if (u.includes('PETROL')) return 'PETROL';
    if (u.includes('CNG')) return 'CNG';
    if (u.includes('ELECTRIC')) return 'ELECTRIC';
    if (u.includes('HYBRID')) return 'HYBRID';
    return 'DIESEL';
  }

  async getTransactions(filters: {
    tag?: string;
    vehicleNumber?: string;
    cardNumber?: string;
    startDate?: string;
    endDate?: string;
    product?: string;
    page?: number;
    limit?: number;
  }) {
    const where: Record<string, unknown> = {};
    if (filters.vehicleNumber) {
      const raw = filters.vehicleNumber.trim();
      if (raw.includes(',')) {
        const parts = raw
          .split(',')
          .map((v) => v.trim())
          .filter((v) => v.length > 0);
        if (parts.length > 0) {
          const vehicleOr = parts.map((v) => ({
            vehicleNumber: { equals: v, mode: 'insensitive' as const },
          }));

          const hasExistingOr =
            Object.prototype.hasOwnProperty.call(where, 'OR') &&
            where.OR != null &&
            (Array.isArray(where.OR)
              ? (where.OR as unknown[]).length > 0
              : true);

          if (hasExistingOr) {
            const existingOr = where.OR;
            delete where.OR;
            const andArr: object[] = [];
            if (where.AND) {
              if (Array.isArray(where.AND)) {
                andArr.push(...(where.AND as object[]));
              } else {
                andArr.push(where.AND as object);
              }
              delete where.AND;
            }
            andArr.push({ OR: existingOr });
            andArr.push({ OR: vehicleOr });
            where.AND = andArr;
          } else {
            where.OR = vehicleOr;
          }
        }
      } else {
        where.vehicleNumber = {
          contains: raw,
          mode: 'insensitive',
        };
      }
    }
    if (filters.cardNumber) {
      where.cardNumber = filters.cardNumber;
    }
    if (filters.product) {
      where.product = { contains: filters.product, mode: 'insensitive' };
    }
    if (filters.startDate || filters.endDate) {
      const txnDate: { gte?: Date; lte?: Date } = {};
      if (filters.startDate) txnDate.gte = new Date(filters.startDate);
      if (filters.endDate) {
        txnDate.lte = new Date(`${filters.endDate}T23:59:59.999Z`);
      }
      where.txnDate = txnDate;
    }

    if (filters.tag && filters.tag !== 'ALL') {
      const cards = await this.getCardsByTag(
        filters.tag,
        filters.startDate,
        filters.endDate,
      );
      if (cards.length === 0) {
        return {
          data: [],
          total: 0,
          page: filters.page || 1,
          limit: filters.limit || 50,
          summary: { litres: 0, amount: 0, txnCount: 0 },
        };
      }
      const cardNumbers = cards.map((c) => c.cardNumber);
      where.cardNumber = { in: cardNumbers };
    }

    const page = filters.page || 1;
    const limit = filters.limit || 50;

    const [data, total, sumAgg] = await Promise.all([
      this.prisma.bpclTransaction.findMany({
        where,
        orderBy: { txnDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.bpclTransaction.count({ where }),
      this.prisma.bpclTransaction.aggregate({
        where,
        _sum: { litres: true, totalAmount: true },
      }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      summary: {
        litres: sumAgg._sum.litres ?? 0,
        amount: sumAgg._sum.totalAmount ?? 0,
        txnCount: total,
      },
    };
  }

  private async getCardsByTag(
    tag: string,
    _startDate?: string,
    _endDate?: string,
  ) {
    void _startDate;
    void _endDate;
    return this.prisma.bpclCard.findMany({
      where: { currentTag: tag },
      select: { cardNumber: true },
    });
  }

  async getImportHistory() {
    const batches = await this.prisma.bpclTransaction.groupBy({
      by: ['importBatchId'],
      where: { importBatchId: { not: null } },
      _count: { _all: true },
      _sum: { totalAmount: true, litres: true },
      _min: { txnDate: true, createdAt: true },
      _max: { txnDate: true },
      orderBy: { _min: { createdAt: 'desc' } },
    });
    return batches.map((b) => ({
      importBatchId: b.importBatchId,
      count: b._count._all,
      totalAmount: b._sum.totalAmount ?? 0,
      litres: b._sum.litres ?? 0,
      minTxnDate: b._min.txnDate,
      maxTxnDate: b._max.txnDate,
      firstImportedAt: b._min.createdAt,
    }));
  }

  async getDashboardSummary(startDate?: string, endDate?: string) {
    const where: Record<string, unknown> = {};
    if (startDate || endDate) {
      const txnDate: { gte?: Date; lte?: Date } = {};
      if (startDate) txnDate.gte = new Date(startDate);
      if (endDate) {
        txnDate.lte = new Date(`${endDate}T23:59:59.999Z`);
      }
      where.txnDate = txnDate;
    }

    const businessCards = await this.prisma.bpclCard.findMany({
      where: { currentTag: 'BUSINESS' },
      select: { cardNumber: true },
    });
    const businessCardNumbers = businessCards.map((c) => c.cardNumber);

    const businessWhere =
      businessCardNumbers.length > 0
        ? { ...where, cardNumber: { in: businessCardNumbers } }
        : { ...where, cardNumber: { in: ['__none__'] } };

    const [totalAll, totalBusiness, byVehicle, byDay] = await Promise.all([
      this.prisma.bpclTransaction.aggregate({
        where,
        _sum: { litres: true, totalAmount: true },
      }),
      this.prisma.bpclTransaction.aggregate({
        where: businessWhere,
        _sum: { litres: true, totalAmount: true },
      }),
      this.prisma.bpclTransaction.groupBy({
        by: ['vehicleNumber'],
        where: businessWhere,
        _sum: { litres: true, totalAmount: true },
        _count: { _all: true },
        orderBy: { _sum: { totalAmount: 'desc' } },
      }),
      this.prisma.bpclTransaction.groupBy({
        by: ['txnDate'],
        where: businessWhere,
        _sum: { litres: true, totalAmount: true },
        _count: { _all: true },
      }),
    ]);

    const countAll = await this.prisma.bpclTransaction.count({ where });
    const countBusiness = await this.prisma.bpclTransaction.count({
      where: businessWhere,
    });

    return {
      totalAll: {
        litres: totalAll._sum.litres ?? 0,
        amount: totalAll._sum.totalAmount ?? 0,
        count: countAll,
      },
      totalBusiness: {
        litres: totalBusiness._sum.litres ?? 0,
        amount: totalBusiness._sum.totalAmount ?? 0,
        count: countBusiness,
      },
      byVehicle,
      byMonth: byDay,
    };
  }

  private parseBpclDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    const months: Record<string, number> = {
      jan: 0,
      feb: 1,
      mar: 2,
      apr: 3,
      may: 4,
      jun: 5,
      jul: 6,
      aug: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dec: 11,
    };
    const match = dateStr.match(/(\d{1,2})[\-/]([A-Za-z]{3})[\-/](\d{4})/);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = months[match[2].toLowerCase()];
      const year = parseInt(match[3], 10);
      if (month !== undefined && !isNaN(day) && !isNaN(year)) {
        return new Date(year, month, day);
      }
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }
}
