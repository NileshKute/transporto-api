import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import * as XLSX from 'xlsx';

const STATEMENT_SHEET = 'Statement';
/** 1-based row 27 → index 26 */
const TXN_HEADER_ROW = 26;
/** 1-based row 28 → first data row */
const TXN_DATA_START_ROW = 27;
/** 1-based row 6 col D → statement period */
const PERIOD_ROW = 5;
const PERIOD_COL = 3;

@Injectable()
export class TollService {
  constructor(private prisma: PrismaService) {}

  async importExcel(
    buffer: Buffer,
    fileName: string,
    uploadedBy?: string | null,
  ) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[STATEMENT_SHEET];
    if (!sheet) {
      throw new BadRequestException(
        `Invalid Kotak FASTag format: sheet "${STATEMENT_SHEET}" not found`,
      );
    }

    const allRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
    });

    const statementPeriod = this.strCell(
      (allRows[PERIOD_ROW] as unknown[])?.[PERIOD_COL],
    );

    const headerRow = allRows[TXN_HEADER_ROW] as unknown[] | undefined;
    if (!headerRow || !this.looksLikeTxnHeader(headerRow)) {
      throw new BadRequestException(
        'Invalid Kotak FASTag format: transaction headers not found at row 27',
      );
    }

    const dataRows = allRows.slice(TXN_DATA_START_ROW);
    const parsed: Array<{
      uniqueTxnId: string;
      transactionDateTime: Date;
      transactionType: string;
      plazaCode: string | null;
      plazaName: string | null;
      debitAmt: Prisma.Decimal;
      creditAmt: Prisma.Decimal;
      openingBalance: Prisma.Decimal | null;
      closingBalance: Prisma.Decimal | null;
      rawRow: Prisma.InputJsonValue;
    }> = [];

    let skippedParse = 0;

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (!Array.isArray(row)) continue;

      const uniqueTxnId = String(row[2] ?? '')
        .trim()
        .replace(/\s+/g, '')
        .toUpperCase();
      if (!uniqueTxnId) continue;

      const dt = this.parseKotakDateTime(String(row[0] ?? ''));
      if (!dt) {
        skippedParse++;
        continue;
      }

      const transactionType = String(row[1] ?? '').trim() || 'Unknown';
      const plazaCode = this.strCell(row[3]);
      const desc = String(row[4] ?? '');
      const plazaName = this.extractPlazaName(desc);

      parsed.push({
        uniqueTxnId,
        transactionDateTime: dt,
        transactionType,
        plazaCode,
        plazaName,
        debitAmt: this.parseMoney(row[5]),
        creditAmt: this.parseMoney(row[6]),
        openingBalance: this.parseMoneyNullable(row[7]),
        closingBalance: this.parseMoneyNullable(row[8]),
        rawRow: row.slice(0, 9) as Prisma.InputJsonValue,
      });
    }

    const totalRows = parsed.length + skippedParse;
    if (parsed.length === 0) {
      throw new BadRequestException('No valid transaction rows found in file');
    }

    const txnIds = parsed.map((p) => p.uniqueTxnId);
    const existing = await this.prisma.tollTransaction.findMany({
      where: { uniqueTxnId: { in: txnIds } },
      select: { uniqueTxnId: true },
    });
    const existingSet = new Set(
      existing.map((e) => e.uniqueTxnId.toUpperCase()),
    );

    const batch = await this.prisma.tollImportBatch.create({
      data: {
        fileName,
        statementPeriod,
        totalRows,
        importedRows: 0,
        duplicateRows: 0,
        skippedRows: 0,
        totalDebit: new Prisma.Decimal(0),
        uploadedBy: uploadedBy ?? null,
      },
    });

    let imported = 0;
    let duplicates = 0;
    let totalDebitSum = new Prisma.Decimal(0);

    for (const row of parsed) {
      if (existingSet.has(row.uniqueTxnId)) {
        duplicates++;
        continue;
      }

      try {
        await this.prisma.tollTransaction.create({
          data: {
            ...row,
            vehicleId: null,
            importBatchId: batch.id,
          },
        });
        existingSet.add(row.uniqueTxnId);
        imported++;
        totalDebitSum = totalDebitSum.add(row.debitAmt);
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        ) {
          duplicates++;
          continue;
        }
        throw e;
      }
    }

    const skipped = skippedParse;

    await this.prisma.tollImportBatch.update({
      where: { id: batch.id },
      data: {
        importedRows: imported,
        duplicateRows: duplicates,
        skippedRows: skipped,
        totalDebit: totalDebitSum,
      },
    });

    return {
      totalRows,
      imported,
      duplicates,
      skipped,
      batchId: batch.id,
    };
  }

  async getTransactions(filters: {
    vehicleId?: string;
    from?: string;
    to?: string;
    plazaCode?: string;
    type?: string;
    page?: number;
    limit?: number;
  }) {
    const where: Prisma.TollTransactionWhereInput = {};

    if (filters.vehicleId) {
      where.vehicleId = filters.vehicleId;
    }
    if (filters.plazaCode) {
      where.plazaCode = {
        equals: filters.plazaCode,
        mode: 'insensitive',
      };
    }
    if (filters.type) {
      where.transactionType = {
        contains: filters.type,
        mode: 'insensitive',
      };
    }
    if (filters.from || filters.to) {
      where.transactionDateTime = {};
      if (filters.from) {
        where.transactionDateTime.gte = new Date(filters.from);
      }
      if (filters.to) {
        where.transactionDateTime.lte = new Date(
          `${filters.to}T23:59:59.999Z`,
        );
      }
    }

    const page = filters.page || 1;
    const limit = filters.limit || 50;

    const [data, total, sumAgg] = await Promise.all([
      this.prisma.tollTransaction.findMany({
        where,
        orderBy: { transactionDateTime: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { vehicle: { select: { id: true, regNumber: true } } },
      }),
      this.prisma.tollTransaction.count({ where }),
      this.prisma.tollTransaction.aggregate({
        where,
        _sum: { debitAmt: true, creditAmt: true },
      }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      summary: {
        totalDebit: sumAgg._sum.debitAmt ?? new Prisma.Decimal(0),
        totalCredit: sumAgg._sum.creditAmt ?? new Prisma.Decimal(0),
        txnCount: total,
      },
    };
  }

  async getSummary() {
    const now = new Date();
    const todayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const todayEnd = new Date(todayStart);
    todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);

    const weekStart = this.startOfUtcWeek(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const monthEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );

    const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const yearEnd = new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1));

    const [today, week, month, year] = await Promise.all([
      this.aggDebitCredit({
        transactionDateTime: { gte: todayStart, lt: todayEnd },
      }),
      this.aggDebitCredit({
        transactionDateTime: { gte: weekStart, lt: weekEnd },
      }),
      this.aggDebitCredit({
        transactionDateTime: { gte: monthStart, lt: monthEnd },
      }),
      this.aggDebitCredit({
        transactionDateTime: { gte: yearStart, lt: yearEnd },
      }),
    ]);

    const topPlazasRaw = await this.prisma.tollTransaction.groupBy({
      by: ['plazaCode'],
      where: { plazaCode: { not: null } },
      _sum: { debitAmt: true },
      _count: { _all: true },
      orderBy: { _sum: { debitAmt: 'desc' } },
      take: 5,
    });

    const topPlazas = await Promise.all(
      topPlazasRaw.map(async (p) => {
        const sample = await this.prisma.tollTransaction.findFirst({
          where: { plazaCode: p.plazaCode },
          select: { plazaName: true },
          orderBy: { transactionDateTime: 'desc' },
        });
        return {
          plazaCode: p.plazaCode,
          plazaName: sample?.plazaName ?? null,
          totalDebit: p._sum.debitAmt ?? new Prisma.Decimal(0),
          txnCount: p._count._all,
        };
      }),
    );

    const topVehicleGroup = await this.prisma.tollTransaction.groupBy({
      by: ['vehicleId'],
      where: { vehicleId: { not: null } },
      _sum: { debitAmt: true },
      orderBy: { _sum: { debitAmt: 'desc' } },
      take: 1,
    });

    let topSpendVehicle: {
      vehicleId: string;
      regNumber: string | null;
      totalDebit: Prisma.Decimal;
    } | null = null;

    if (topVehicleGroup[0]?.vehicleId) {
      const v = await this.prisma.vehicle.findUnique({
        where: { id: topVehicleGroup[0].vehicleId },
        select: { id: true, regNumber: true },
      });
      topSpendVehicle = {
        vehicleId: topVehicleGroup[0].vehicleId,
        regNumber: v?.regNumber ?? null,
        totalDebit:
          topVehicleGroup[0]._sum.debitAmt ?? new Prisma.Decimal(0),
      };
    }

    return {
      periods: {
        today,
        week,
        month,
        year,
      },
      topPlazas,
      topSpendVehicle,
    };
  }

  async getByVehicle() {
    const withVehicle = await this.prisma.tollTransaction.groupBy({
      by: ['vehicleId'],
      where: { vehicleId: { not: null } },
      _sum: { debitAmt: true, creditAmt: true },
      _count: { _all: true },
      orderBy: { _sum: { debitAmt: 'desc' } },
    });

    const vehicleIds = withVehicle
      .map((g) => g.vehicleId)
      .filter((id): id is string => id != null);
    const vehicles = await this.prisma.vehicle.findMany({
      where: { id: { in: vehicleIds } },
      select: { id: true, regNumber: true },
    });
    const regById = new Map(vehicles.map((v) => [v.id, v.regNumber]));

    const assigned = withVehicle.map((g) => ({
      vehicleId: g.vehicleId,
      regNumber: g.vehicleId ? regById.get(g.vehicleId) ?? null : null,
      totalDebit: g._sum.debitAmt ?? new Prisma.Decimal(0),
      totalCredit: g._sum.creditAmt ?? new Prisma.Decimal(0),
      txnCount: g._count._all,
    }));

    const unassigned = await this.prisma.tollTransaction.aggregate({
      where: { vehicleId: null },
      _sum: { debitAmt: true, creditAmt: true },
      _count: { _all: true },
    });

    const unassignedRow =
      unassigned._count._all > 0
        ? [
            {
              vehicleId: null as string | null,
              regNumber: null as string | null,
              totalDebit: unassigned._sum.debitAmt ?? new Prisma.Decimal(0),
              totalCredit: unassigned._sum.creditAmt ?? new Prisma.Decimal(0),
              txnCount: unassigned._count._all,
            },
          ]
        : [];

    return [...unassignedRow, ...assigned];
  }

  async getByPlaza() {
    const rows = await this.prisma.tollTransaction.groupBy({
      by: ['plazaCode', 'plazaName'],
      _sum: { debitAmt: true, creditAmt: true },
      _count: { _all: true },
      orderBy: { _sum: { debitAmt: 'desc' } },
    });

    return rows.map((r) => ({
      plazaCode: r.plazaCode,
      plazaName: r.plazaName,
      totalDebit: r._sum.debitAmt ?? new Prisma.Decimal(0),
      totalCredit: r._sum.creditAmt ?? new Prisma.Decimal(0),
      txnCount: r._count._all,
    }));
  }

  async getByMonth() {
    type Row = {
      month: Date;
      total_debit: Prisma.Decimal;
      total_credit: Prisma.Decimal;
      txn_count: bigint;
    };
    const rows = await this.prisma.$queryRaw<Row[]>`
      SELECT date_trunc('month', "transactionDateTime") AS month,
             SUM("debitAmt") AS total_debit,
             SUM("creditAmt") AS total_credit,
             COUNT(*)::bigint AS txn_count
      FROM toll_transactions
      GROUP BY 1
      ORDER BY 1 DESC
    `;

    return rows.map((r) => ({
      month: r.month,
      totalDebit: r.total_debit,
      totalCredit: r.total_credit,
      txnCount: Number(r.txn_count),
    }));
  }

  async deleteBatch(id: string) {
    const batch = await this.prisma.tollImportBatch.findUnique({
      where: { id },
    });
    if (!batch) {
      throw new NotFoundException('Import batch not found');
    }

    await this.prisma.tollImportBatch.delete({ where: { id } });
    return { success: true, id };
  }

  async getImportHistory() {
    return this.prisma.tollImportBatch.findMany({
      orderBy: { uploadedAt: 'desc' },
    });
  }

  private looksLikeTxnHeader(row: unknown[]): boolean {
    const a = String(row[0] ?? '').toLowerCase();
    const c = String(row[2] ?? '').toLowerCase();
    return (
      a.includes('date') ||
      c.includes('unique') ||
      c.includes('transaction id')
    );
  }

  private extractPlazaName(description: string): string | null {
    const m = description.replace(/\r\n/g, '\n').match(
      /Plaza Name:\s*(.+)/i,
    );
    if (!m) return null;
    return m[1].replace(/\n/g, ' ').trim() || null;
  }

  private parseKotakDateTime(s: string): Date | null {
    const t = s.trim();
    if (!t) return null;
    const m = t.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/,
    );
    if (!m) return null;
    const d = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    const y = parseInt(m[3], 10);
    const h = parseInt(m[4], 10);
    const mi = parseInt(m[5], 10);
    const se = parseInt(m[6], 10);
    const dt = new Date(y, mo - 1, d, h, mi, se);
    return isNaN(dt.getTime()) ? null : dt;
  }

  private parseMoney(v: unknown): Prisma.Decimal {
    if (v == null || v === '') return new Prisma.Decimal(0);
    const s = String(v).trim();
    if (s.toUpperCase() === 'NA' || s === '-') return new Prisma.Decimal(0);
    const n = parseFloat(s.replace(/,/g, ''));
    if (Number.isNaN(n)) return new Prisma.Decimal(0);
    return new Prisma.Decimal(n);
  }

  private parseMoneyNullable(v: unknown): Prisma.Decimal | null {
    if (v == null || v === '') return null;
    const s = String(v).trim();
    if (s.toUpperCase() === 'NA' || s === '-') return null;
    const n = parseFloat(s.replace(/,/g, ''));
    if (Number.isNaN(n)) return null;
    return new Prisma.Decimal(n);
  }

  private strCell(v: unknown): string | null {
    if (v == null) return null;
    const s = String(v).trim();
    return s.length ? s : null;
  }

  private startOfUtcWeek(d: Date): Date {
    const day = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
    );
    const dow = day.getUTCDay();
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    day.setUTCDate(day.getUTCDate() + mondayOffset);
    return day;
  }

  private async aggDebitCredit(where: Prisma.TollTransactionWhereInput) {
    const [agg, count] = await Promise.all([
      this.prisma.tollTransaction.aggregate({
        where,
        _sum: { debitAmt: true, creditAmt: true },
      }),
      this.prisma.tollTransaction.count({ where }),
    ]);
    return {
      totalDebit: agg._sum.debitAmt ?? new Prisma.Decimal(0),
      totalCredit: agg._sum.creditAmt ?? new Prisma.Decimal(0),
      txnCount: count,
    };
  }
}
