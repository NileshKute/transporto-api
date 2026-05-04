import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  Prisma,
  QuotationStatus,
  VehicleQuoteType,
} from '@prisma/client';
import Fuse from 'fuse.js';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceService } from '../invoice/invoice.service';
import { amountInWords } from '../invoice/invoice.utils';

function normalizeCompanyName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[.,()&\[\]]/g, ' ')
    .replace(
      /\b(pvt|private|ltd|limited|llp|inc|corp|corporation|company|co)\b\.?/g,
      '',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

@Injectable()
export class QuotationsService {
  constructor(
    private prisma: PrismaService,
    private invoiceService: InvoiceService,
  ) {}

  async generateQuoteNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `QT/${year}/`;
    const quotes = await this.prisma.quotation.findMany({
      where: { quoteNumber: { startsWith: prefix } },
      select: { quoteNumber: true },
    });
    let nextNum = 1;
    const re = /^QT\/\d+\/(\d+)$/;
    for (const q of quotes) {
      const m = q.quoteNumber.match(re);
      if (m) {
        const n = parseInt(m[1], 10);
        if (!Number.isNaN(n) && n >= nextNum) nextNum = n + 1;
      }
    }
    return `${prefix}${String(nextNum).padStart(3, '0')}`;
  }

  async findAll(query: Record<string, unknown>) {
    const {
      status,
      clientId,
      fromDate,
      toDate,
      vehicleType,
      search,
      page = 1,
      limit = 10,
    } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: Prisma.QuotationWhereInput = {};

    if (status && typeof status === 'string') {
      where.status = status as QuotationStatus;
    }
    if (clientId && typeof clientId === 'string') {
      where.clientId = clientId;
    }
    if (fromDate || toDate) {
      where.quoteDate = {};
      if (fromDate) {
        (where.quoteDate as Prisma.DateTimeFilter).gte = new Date(
          String(fromDate),
        );
      }
      if (toDate) {
        (where.quoteDate as Prisma.DateTimeFilter).lte = new Date(
          String(toDate),
        );
      }
    }
    if (vehicleType && typeof vehicleType === 'string') {
      where.vehicleType = {
        contains: vehicleType,
        mode: 'insensitive',
      };
    }
    if (search && typeof search === 'string') {
      const term = search.trim();
      if (term) {
        where.OR = [
          { quoteNumber: { contains: term, mode: 'insensitive' } },
          { clientName: { contains: term, mode: 'insensitive' } },
          { attnPerson: { contains: term, mode: 'insensitive' } },
          { subject: { contains: term, mode: 'insensitive' } },
          { rawText: { contains: term, mode: 'insensitive' } },
          { termsAndConditions: { contains: term, mode: 'insensitive' } },
          { notes: { contains: term, mode: 'insensitive' } },
          { vehicleType: { contains: term, mode: 'insensitive' } },
          { sourceFolder: { contains: term, mode: 'insensitive' } },
          { sourceFile: { contains: term, mode: 'insensitive' } },
          {
            client: {
              name: { contains: term, mode: 'insensitive' },
            },
          },
        ];
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.quotation.findMany({
        where,
        skip,
        take: Number(limit),
        // All scalar fields (including quoteDate) are returned; relations below are added.
        include: {
          client: { select: { id: true, name: true, gstNumber: true } },
          invoice: { select: { id: true, invoiceNumber: true, status: true } },
        },
        orderBy: { quoteDate: 'desc' },
      }),
      this.prisma.quotation.count({ where }),
    ]);

    return {
      data,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    };
  }

  async findOne(id: string) {
    const q = await this.prisma.quotation.findUnique({
      where: { id },
      include: {
        client: true,
        invoice: true,
        lineItems: { orderBy: { srNo: 'asc' } },
        history: { orderBy: { changedAt: 'desc' } },
      },
    });
    if (!q) throw new NotFoundException('Quotation not found');
    return q;
  }

  async create(dto: Record<string, unknown>, createdBy?: string) {
    let clientName = dto.clientName != null ? String(dto.clientName) : '';
    if (dto.clientId) {
      const client = await this.prisma.client.findUnique({
        where: { id: String(dto.clientId) },
      });
      if (!client) throw new NotFoundException('Client not found');
      if (!clientName) clientName = client.name;
    }
    if (!clientName.trim()) {
      throw new BadRequestException('clientName or valid clientId is required');
    }

    const quoteNumber =
      (dto.quoteNumber as string) || (await this.generateQuoteNumber());
    const quoteDate = dto.quoteDate
      ? new Date(String(dto.quoteDate))
      : new Date();
    const validityDays =
      dto.validityDays != null ? Number(dto.validityDays) : 30;
    const validUntil =
      dto.validUntil != null
        ? new Date(String(dto.validUntil))
        : new Date(
            quoteDate.getTime() + Math.max(0, validityDays) * 86_400_000,
          );

    const lineItemsIn = (dto.lineItems as Record<string, unknown>[]) || [];
    const status = (dto.status as QuotationStatus) || 'DRAFT';

    const q = await this.prisma.quotation.create({
      data: {
        quoteNumber,
        clientId: dto.clientId ? String(dto.clientId) : null,
        clientName: clientName.trim(),
        attnPerson: dto.attnPerson != null ? String(dto.attnPerson) : null,
        clientAddress:
          dto.clientAddress != null ? String(dto.clientAddress) : null,
        subject: dto.subject != null ? String(dto.subject) : null,
        quoteDate,
        validityDays,
        validUntil,
        vehicleType:
          dto.vehicleType != null ? String(dto.vehicleType) : 'Unknown',
        vehicleCategory: dto.vehicleCategory as VehicleQuoteType | undefined,
        loadingCapacityKg:
          dto.loadingCapacityKg != null
            ? Number(dto.loadingCapacityKg)
            : null,
        temperatureC:
          dto.temperatureC != null ? Number(dto.temperatureC) : null,
        monthlyRate:
          dto.monthlyRate != null ? Number(dto.monthlyRate) : null,
        fixedKm: dto.fixedKm != null ? Number(dto.fixedKm) : null,
        additionalPerKm:
          dto.additionalPerKm != null ? Number(dto.additionalPerKm) : null,
        tollIncluded: Boolean(dto.tollIncluded),
        loadLocations: Array.isArray(dto.loadLocations)
          ? (dto.loadLocations as string[]).map(String)
          : [],
        status,
        termsAndConditions:
          dto.termsAndConditions != null
            ? String(dto.termsAndConditions)
            : null,
        notes: dto.notes != null ? String(dto.notes) : null,
        sourceType: dto.sourceType != null ? String(dto.sourceType) : null,
        createdBy: createdBy ?? null,
        lineItems:
          lineItemsIn.length > 0
            ? {
                create: lineItemsIn.map((li, i) => ({
                  srNo: Number(li.srNo ?? i + 1),
                  description: String(li.description ?? ''),
                  vehicleNumber:
                    li.vehicleNumber != null
                      ? String(li.vehicleNumber)
                      : null,
                  fixedKm:
                    li.fixedKm != null ? Number(li.fixedKm) : null,
                  fixedCharges: Number(li.fixedCharges ?? 0) || 0,
                  additionalCost:
                    li.additionalCost != null
                      ? Number(li.additionalCost)
                      : null,
                  remark: li.remark != null ? String(li.remark) : null,
                })),
              }
            : undefined,
        history: {
          create: {
            action: 'created',
            toStatus: status,
            changedBy: createdBy ?? null,
          },
        },
      },
    });

    return this.findOne(q.id);
  }

  async update(
    id: string,
    dto: Record<string, unknown>,
    changedBy?: string,
  ) {
    const existing = await this.prisma.quotation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Quotation not found');
    if (existing.status === 'CONVERTED_TO_INVOICE') {
      throw new BadRequestException('Converted quotations cannot be edited');
    }
    if (existing.status !== 'DRAFT' && existing.sourceType !== 'imported') {
      throw new BadRequestException(
        'Only draft or imported quotations can be edited',
      );
    }

    const data: Prisma.QuotationUpdateInput = {};
    if (dto.clientId !== undefined) {
      if (dto.clientId === null) data.client = { disconnect: true };
      else {
        const c = await this.prisma.client.findUnique({
          where: { id: String(dto.clientId) },
        });
        if (!c) throw new NotFoundException('Client not found');
        data.client = { connect: { id: c.id } };
      }
    }
    if (dto.clientName !== undefined) data.clientName = String(dto.clientName);
    if (dto.attnPerson !== undefined) {
      data.attnPerson =
        dto.attnPerson != null ? String(dto.attnPerson) : null;
    }
    if (dto.clientAddress !== undefined) {
      data.clientAddress =
        dto.clientAddress != null ? String(dto.clientAddress) : null;
    }
    if (dto.subject !== undefined) {
      data.subject = dto.subject != null ? String(dto.subject) : null;
    }
    if (dto.quoteDate !== undefined) {
      data.quoteDate = new Date(String(dto.quoteDate));
    }
    if (dto.validityDays !== undefined) {
      data.validityDays = Number(dto.validityDays);
    }
    if (dto.validUntil !== undefined) {
      data.validUntil =
        dto.validUntil != null ? new Date(String(dto.validUntil)) : null;
    }
    if (dto.vehicleType !== undefined) {
      data.vehicleType = String(dto.vehicleType);
    }
    if (dto.vehicleCategory !== undefined) {
      data.vehicleCategory = dto.vehicleCategory as VehicleQuoteType | null;
    }
    if (dto.loadingCapacityKg !== undefined) {
      data.loadingCapacityKg =
        dto.loadingCapacityKg != null ? Number(dto.loadingCapacityKg) : null;
    }
    if (dto.temperatureC !== undefined) {
      data.temperatureC =
        dto.temperatureC != null ? Number(dto.temperatureC) : null;
    }
    if (dto.monthlyRate !== undefined) {
      data.monthlyRate =
        dto.monthlyRate != null ? Number(dto.monthlyRate) : null;
    }
    if (dto.fixedKm !== undefined) {
      data.fixedKm = dto.fixedKm != null ? Number(dto.fixedKm) : null;
    }
    if (dto.additionalPerKm !== undefined) {
      data.additionalPerKm =
        dto.additionalPerKm != null ? Number(dto.additionalPerKm) : null;
    }
    if (dto.tollIncluded !== undefined) {
      data.tollIncluded = Boolean(dto.tollIncluded);
    }
    if (dto.loadLocations !== undefined) {
      data.loadLocations = Array.isArray(dto.loadLocations)
        ? (dto.loadLocations as string[]).map(String)
        : [];
    }
    if (dto.termsAndConditions !== undefined) {
      data.termsAndConditions =
        dto.termsAndConditions != null
          ? String(dto.termsAndConditions)
          : null;
    }
    if (dto.notes !== undefined) {
      data.notes = dto.notes != null ? String(dto.notes) : null;
    }

    if (dto.lineItems && Array.isArray(dto.lineItems)) {
      await this.prisma.quotationLineItem.deleteMany({ where: { quotationId: id } });
      const items = dto.lineItems as Record<string, unknown>[];
      if (items.length > 0) {
        data.lineItems = {
          create: items.map((li, i) => ({
            srNo: Number(li.srNo ?? i + 1),
            description: String(li.description ?? ''),
            vehicleNumber:
              li.vehicleNumber != null ? String(li.vehicleNumber) : null,
            fixedKm: li.fixedKm != null ? Number(li.fixedKm) : null,
            fixedCharges: Number(li.fixedCharges ?? 0) || 0,
            additionalCost:
              li.additionalCost != null ? Number(li.additionalCost) : null,
            remark: li.remark != null ? String(li.remark) : null,
          })),
        };
      }
    }

    await this.prisma.quotation.update({ where: { id }, data });
    await this.prisma.quotationHistory.create({
      data: {
        quotationId: id,
        action: 'edited',
        fromStatus: existing.status,
        toStatus: existing.status,
        changedBy: changedBy ?? null,
        notes:
          dto.editNotes != null ? String(dto.editNotes) : null,
      },
    });

    return this.findOne(id);
  }

  async updateStatus(
    id: string,
    status: QuotationStatus,
    opts?: { notes?: string; rejectedReason?: string; changedBy?: string },
  ) {
    const existing = await this.prisma.quotation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Quotation not found');
    if (existing.status === 'CONVERTED_TO_INVOICE') {
      throw new BadRequestException('Quotation already converted to invoice');
    }

    const fromStatus = existing.status;
    const data: Prisma.QuotationUpdateInput = { status };
    if (status === 'ACCEPTED') {
      data.acceptedDate = new Date();
    }
    if (status === 'REJECTED' && opts?.rejectedReason) {
      data.rejectedReason = opts.rejectedReason;
    }

    await this.prisma.quotation.update({ where: { id }, data });
    await this.prisma.quotationHistory.create({
      data: {
        quotationId: id,
        action: 'status_change',
        fromStatus,
        toStatus: status,
        changedBy: opts?.changedBy ?? null,
        notes: opts?.notes ?? null,
      },
    });

    return this.findOne(id);
  }

  async convertToInvoice(id: string, createdBy?: string) {
    const q = await this.findOne(id);
    if (q.status === 'CONVERTED_TO_INVOICE' && q.invoiceId) {
      throw new BadRequestException('Already converted');
    }
    if (!['ACCEPTED', 'SENT'].includes(q.status)) {
      throw new BadRequestException(
        'Only SENT or ACCEPTED quotations can be converted',
      );
    }
    if (!q.clientId) {
      throw new BadRequestException(
        'Link a client (clientId) before converting to invoice',
      );
    }

    const client = await this.prisma.client.findUnique({
      where: { id: q.clientId },
    });
    if (!client) throw new NotFoundException('Client not found');

    const y = q.quoteDate.getFullYear();
    const m = q.quoteDate.getMonth();
    const billingPeriodStart = new Date(y, m, 1);
    const billingPeriodEnd = new Date(y, m + 1, 0, 23, 59, 59);

    const lineItems =
      q.lineItems.length > 0
        ? q.lineItems.map((li) => ({
            vehicleRegNumber: li.vehicleNumber || 'N/A',
            description: li.description,
            billingType: 'MONTHLY_CONTRACT' as const,
            tripCount: 0,
            daysCount: li.fixedKm != null ? Number(li.fixedKm) : null,
            rate: li.fixedCharges,
            advance: 0,
            weight: 0,
            amount: li.fixedCharges,
          }))
        : [
            {
              vehicleRegNumber: 'N/A',
              description: `${q.vehicleType} — quoted service`,
              billingType: 'MONTHLY_CONTRACT' as const,
              tripCount: 0,
              daysCount: q.fixedKm != null ? Number(q.fixedKm) : null,
              rate: Number(q.monthlyRate ?? 0),
              advance: 0,
              weight: 0,
              amount: Number(q.monthlyRate ?? 0),
            },
          ];

    const subtotal = lineItems.reduce((s, li) => s + Number(li.amount), 0);
    const invoiceNumber = await this.invoiceService.getNextInvoiceNumber();
    const issueDate = new Date();
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + (client.paymentTermsDays ?? 15));

    const invoice = await this.prisma.invoice.create({
      data: {
        invoiceNumber,
        clientId: q.clientId,
        billingPeriodStart,
        billingPeriodEnd,
        issueDate,
        dueDate,
        status: 'DRAFT',
        subtotal,
        totalDeductions: 0,
        totalAmount: subtotal,
        amountPaid: 0,
        balanceDue: subtotal,
        amountInWords: amountInWords(subtotal),
        notes:
          q.notes ||
          `Generated from quotation ${q.quoteNumber}`,
        lineItems: {
          create: lineItems.map((li) => ({
            vehicleRegNumber: li.vehicleRegNumber,
            description: li.description,
            billingType: li.billingType,
            tripCount: li.tripCount,
            daysCount: li.daysCount,
            rate: li.rate,
            weight: li.weight,
            advance: li.advance,
            amount: li.amount,
          })),
        },
      },
    });

    await this.prisma.quotation.update({
      where: { id },
      data: {
        status: 'CONVERTED_TO_INVOICE',
        invoiceId: invoice.id,
      },
    });
    await this.prisma.quotationHistory.create({
      data: {
        quotationId: id,
        action: 'converted_to_invoice',
        fromStatus: q.status,
        toStatus: 'CONVERTED_TO_INVOICE',
        changedBy: createdBy ?? null,
        notes: `Invoice ${invoice.invoiceNumber}`,
      },
    });

    return this.invoiceService.findOne(invoice.id);
  }

  async delete(id: string) {
    const q = await this.prisma.quotation.findUnique({ where: { id } });
    if (!q) throw new NotFoundException('Quotation not found');
    if (q.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT quotations can be deleted');
    }
    await this.prisma.quotation.delete({ where: { id } });
    return { success: true };
  }

  async getStats() {
    const [total, byStatus, quoteDates, converted] = await Promise.all([
      this.prisma.quotation.count(),
      this.prisma.quotation.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      this.prisma.quotation.findMany({
        select: { quoteDate: true },
      }),
      this.prisma.quotation.count({
        where: { status: 'CONVERTED_TO_INVOICE' },
      }),
    ]);

    const monthMap = new Map<string, number>();
    for (const q of quoteDates) {
      const d = q.quoteDate;
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      monthMap.set(key, (monthMap.get(key) ?? 0) + 1);
    }
    const byMonth = Array.from(monthMap.entries())
      .map(([k, count]) => {
        const [y, m] = k.split('-').map(Number);
        return { year: y, month: m, count };
      })
      .sort((a, b) => b.year - a.year || b.month - a.month)
      .slice(0, 24);

    const acceptedOrConverted = await this.prisma.quotation.count({
      where: { status: { in: ['ACCEPTED', 'CONVERTED_TO_INVOICE'] } },
    });
    const conversionRate =
      acceptedOrConverted > 0 ? converted / acceptedOrConverted : 0;

    return {
      total,
      byStatus: Object.fromEntries(
        byStatus.map((r) => [r.status, r._count.id]),
      ),
      byMonth,
      convertedCount: converted,
      conversionRate,
    };
  }

  async relinkClientsForUnmatched(autoCreate = true) {
    const clients = await this.prisma.client.findMany({
      select: { id: true, name: true },
    });

    const searchList = clients.map((c) => ({
      id: c.id,
      name: c.name,
      normalized: normalizeCompanyName(c.name),
    }));

    const unmatchedQuotations = await this.prisma.quotation.findMany({
      where: { clientId: null },
      select: { id: true, clientName: true },
    });

    if (unmatchedQuotations.length === 0) {
      return { total: 0, matched: 0, unmatched: 0, ambiguous: 0, created: 0, details: [] };
    }

    const fuse = new Fuse(searchList, {
      keys: ['normalized'],
      threshold: 0.4,
      includeScore: true,
      ignoreLocation: true,
      minMatchCharLength: 3,
    });

    let matched = 0;
    let unmatched = 0;
    let ambiguous = 0;
    let created = 0;
    const details: Array<{
      quotationId: string;
      clientName: string;
      matchedClientName?: string;
      matchedClientId?: string;
      score?: number;
      status: 'MATCHED' | 'CREATED' | 'UNMATCHED' | 'AMBIGUOUS';
    }> = [];

    for (const q of unmatchedQuotations) {
      if (!q.clientName || q.clientName.trim() === '') {
        unmatched++;
        details.push({ quotationId: q.id, clientName: q.clientName || '', status: 'UNMATCHED' });
        continue;
      }

      const normalizedQuery = normalizeCompanyName(q.clientName);
      if (!normalizedQuery) {
        unmatched++;
        details.push({ quotationId: q.id, clientName: q.clientName, status: 'UNMATCHED' });
        continue;
      }

      const results = fuse.search(normalizedQuery);
      const top = results[0];
      const second = results[1];

      const confident =
        top &&
        ((top.score ?? 1) < 0.25 ||
          !second ||
          ((second.score ?? 1) - (top.score ?? 1)) > 0.15);

      if (confident && top) {
        await this.prisma.quotation.update({
          where: { id: q.id },
          data: { clientId: top.item.id },
        });
        matched++;
        details.push({
          quotationId: q.id,
          clientName: q.clientName,
          matchedClientName: top.item.name,
          matchedClientId: top.item.id,
          score: top.score,
          status: 'MATCHED',
        });
      } else if (top) {
        ambiguous++;
        details.push({
          quotationId: q.id,
          clientName: q.clientName,
          matchedClientName: top.item.name,
          matchedClientId: top.item.id,
          score: top.score,
          status: 'AMBIGUOUS',
        });
      } else if (autoCreate) {
        const newClient = await this.prisma.client.create({
          data: { name: q.clientName.trim() },
        });
        await this.prisma.quotation.update({
          where: { id: q.id },
          data: { clientId: newClient.id },
        });
        searchList.push({
          id: newClient.id,
          name: newClient.name,
          normalized: normalizeCompanyName(newClient.name),
        });
        fuse.setCollection(searchList);
        created++;
        details.push({
          quotationId: q.id,
          clientName: q.clientName,
          matchedClientName: newClient.name,
          matchedClientId: newClient.id,
          status: 'CREATED',
        });
      } else {
        unmatched++;
        details.push({ quotationId: q.id, clientName: q.clientName, status: 'UNMATCHED' });
      }
    }

    return { total: unmatchedQuotations.length, matched, unmatched, ambiguous, created, details };
  }
}
