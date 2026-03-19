import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { amountInWords } from './invoice.utils';

@Injectable()
export class InvoiceService {
  constructor(
    private prisma: PrismaService,
    private invoicePdfService: InvoicePdfService,
  ) {}

  async getNextInvoiceNumber(): Promise<string> {
    const now = new Date();
    const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const fyEnd = fyStart + 1;
    const fyString = `${fyStart}-${String(fyEnd).slice(-2)}`;

    const lastInvoice = await this.prisma.invoice.findFirst({
      where: { invoiceNumber: { endsWith: `/${fyString}` } },
      orderBy: { createdAt: 'desc' },
    });

    let nextNum = 1;
    if (lastInvoice) {
      const parts = lastInvoice.invoiceNumber.split('/');
      nextNum = parseInt(parts[0], 10) + 1;
    }

    return `${nextNum}/${fyString}`;
  }

  async findAll(query: any) {
    const { clientId, status, month, year, page = 1, limit = 10 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = {};
    if (clientId) where.clientId = clientId;
    if (status) where.status = status;
    if (month && year) {
      const y = parseInt(year, 10);
      const m = parseInt(month, 10) - 1;
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 0, 23, 59, 59);
      where.billingPeriodStart = { gte: start };
      where.billingPeriodEnd = { lte: end };
    }
    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: Number(limit),
        include: { client: { select: { name: true, gstNumber: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.invoice.count({ where }),
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
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        client: true,
        lineItems: true,
        deductions: true,
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async create(dto: any) {
    const invoiceNumber = dto.invoiceNumber || (await this.getNextInvoiceNumber());
    const client = await this.prisma.client.findUnique({ where: { id: dto.clientId } });
    if (!client) throw new NotFoundException('Client not found');

    const subtotal = Number(dto.subtotal ?? 0);
    const totalDeductions = Number(dto.totalDeductions ?? 0);
    const totalAmount = subtotal - totalDeductions;
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : new Date(dto.issueDate || Date.now());
    if (client.paymentTermsDays) dueDate.setDate(dueDate.getDate() + client.paymentTermsDays);

    const invoice = await this.prisma.invoice.create({
      data: {
        invoiceNumber,
        clientId: dto.clientId,
        billingPeriodStart: new Date(dto.billingPeriodStart),
        billingPeriodEnd: new Date(dto.billingPeriodEnd),
        issueDate: dto.issueDate ? new Date(dto.issueDate) : new Date(),
        dueDate,
        status: (dto.status as any) ?? 'DRAFT',
        subtotal,
        totalDeductions,
        totalAmount,
        amountPaid: Number(dto.amountPaid ?? 0),
        balanceDue: totalAmount - Number(dto.amountPaid ?? 0),
        amountInWords: amountInWords(totalAmount),
        notes: dto.notes,
      },
    });

    if (dto.lineItems?.length) {
      await this.prisma.invoiceLineItem.createMany({
        data: dto.lineItems.map((li: any) => ({
          invoiceId: invoice.id,
          vehicleId: li.vehicleId,
          vehicleRegNumber: li.vehicleRegNumber,
          description: li.description ?? '',
          billingType: (li.billingType as any) ?? 'MONTHLY_CONTRACT',
          tripCount: li.tripCount ?? 0,
          daysCount: li.daysCount,
          rate: Number(li.rate ?? 0),
          weight: li.weight != null ? Number(li.weight) : undefined,
          advance: Number(li.advance ?? 0),
          amount: Number(li.amount ?? 0),
        })),
      });
    }
    if (dto.deductions?.length) {
      await this.prisma.invoiceDeduction.createMany({
        data: dto.deductions.map((d: any) => ({
          invoiceId: invoice.id,
          description: d.description,
          amount: Number(d.amount),
        })),
      });
    }

    return this.findOne(invoice.id);
  }

  async update(id: string, dto: any) {
    const inv = await this.prisma.invoice.findUnique({ where: { id } });
    if (!inv) throw new NotFoundException('Invoice not found');
    if (inv.status !== 'DRAFT') throw new BadRequestException('Only DRAFT invoices can be updated');

    const updateData: any = {};
    if (dto.billingPeriodStart != null) updateData.billingPeriodStart = new Date(dto.billingPeriodStart);
    if (dto.billingPeriodEnd != null) updateData.billingPeriodEnd = new Date(dto.billingPeriodEnd);
    if (dto.issueDate != null) updateData.issueDate = new Date(dto.issueDate);
    if (dto.dueDate != null) updateData.dueDate = new Date(dto.dueDate);
    if (dto.notes !== undefined) updateData.notes = dto.notes;

    if (dto.subtotal != null || dto.totalDeductions != null || dto.lineItems || dto.deductions) {
      let subtotal = Number(dto.subtotal);
      let totalDeductions = Number(dto.totalDeductions);
      if (dto.lineItems?.length) {
        await this.prisma.invoiceLineItem.deleteMany({ where: { invoiceId: id } });
        await this.prisma.invoiceLineItem.createMany({
          data: dto.lineItems.map((li: any) => ({
            invoiceId: id,
            vehicleId: li.vehicleId,
            vehicleRegNumber: li.vehicleRegNumber,
            description: li.description ?? '',
            billingType: (li.billingType as any) ?? 'MONTHLY_CONTRACT',
            tripCount: li.tripCount ?? 0,
            daysCount: li.daysCount,
            rate: Number(li.rate ?? 0),
            weight: li.weight != null ? Number(li.weight) : undefined,
            advance: Number(li.advance ?? 0),
            amount: Number(li.amount ?? 0),
          })),
        });
        subtotal = dto.lineItems.reduce((s: number, li: any) => s + Number(li.amount ?? 0), 0);
      }
      if (dto.deductions?.length) {
        await this.prisma.invoiceDeduction.deleteMany({ where: { invoiceId: id } });
        await this.prisma.invoiceDeduction.createMany({
          data: dto.deductions.map((d: any) => ({
            invoiceId: id,
            description: d.description,
            amount: Number(d.amount),
          })),
        });
        totalDeductions = dto.deductions.reduce((s: number, d: any) => s + Number(d.amount), 0);
      }
      const totalAmount = subtotal - totalDeductions;
      updateData.subtotal = subtotal;
      updateData.totalDeductions = totalDeductions;
      updateData.totalAmount = totalAmount;
      updateData.balanceDue = totalAmount - Number(inv.amountPaid);
      updateData.amountInWords = amountInWords(totalAmount);
    }

    await this.prisma.invoice.update({ where: { id }, data: updateData });
    return this.findOne(id);
  }

  async remove(id: string) {
    const inv = await this.prisma.invoice.findUnique({ where: { id } });
    if (!inv) throw new NotFoundException('Invoice not found');
    if (inv.status !== 'DRAFT') throw new BadRequestException('Only DRAFT invoices can be deleted');
    await this.prisma.invoice.delete({ where: { id } });
    return { success: true };
  }

  async generatePdf(id: string): Promise<{ pdfUrl: string }> {
    const invoice = await this.findOne(id);
    const { path, url } = await this.invoicePdfService.generate(invoice as any);
    await this.prisma.invoice.update({
      where: { id },
      data: { pdfUrl: url ?? path },
    });
    return { pdfUrl: url ?? path };
  }

  async updateStatus(id: string, status: string) {
    const inv = await this.prisma.invoice.findUnique({ where: { id } });
    if (!inv) throw new NotFoundException('Invoice not found');
    const valid = ['SENT', 'PAID', 'PARTIAL', 'OVERDUE', 'CANCELLED'].includes(status);
    if (!valid) throw new BadRequestException('Invalid status');
    return this.prisma.invoice.update({
      where: { id },
      data: { status: status as any },
      include: { client: { select: { name: true } } },
    });
  }

  async recordPayment(id: string, dto: { amount: number }) {
    const inv = await this.prisma.invoice.findUnique({ where: { id } });
    if (!inv) throw new NotFoundException('Invoice not found');
    const amountPaid = Number(inv.amountPaid) + Number(dto.amount);
    const balanceDue = Number(inv.totalAmount) - amountPaid;
    const status = balanceDue <= 0 ? 'PAID' : 'PARTIAL';
    return this.prisma.invoice.update({
      where: { id },
      data: { amountPaid, balanceDue, status: status as any },
      include: { client: { select: { name: true } } },
    });
  }

  async autoGenerate(dto: { clientId: string; billingMonth: string }) {
    const [y, m] = dto.billingMonth.split('-').map(Number);
    if (!y || !m) throw new BadRequestException('billingMonth must be YYYY-MM');
    const periodStart = new Date(y, m - 1, 1);
    const periodEnd = new Date(y, m, 0, 23, 59, 59);

    const client = await this.prisma.client.findUnique({
      where: { id: dto.clientId },
      include: {
        clientVehicles: {
          where: { isActive: true },
          include: { vehicle: true },
        },
      },
    });
    if (!client) throw new NotFoundException('Client not found');
    if (!client.clientVehicles.length) throw new BadRequestException('No vehicles assigned to this client');

    const daysInMonth = new Date(y, m, 0).getDate();
    const lineItems: any[] = [];

    for (const cv of client.clientVehicles) {
      const regNumber = cv.vehicle.regNumber;
      const description = cv.route || 'Monthly / Trip billing';
      const billingType = cv.billingType;

      if (billingType === 'MONTHLY_CONTRACT') {
        const monthlyRate = Number(cv.monthlyRate ?? client.contractRate ?? 0);
        const amount = monthlyRate;
        lineItems.push({
          vehicleId: cv.vehicleId,
          vehicleRegNumber: regNumber,
          description,
          billingType: 'MONTHLY_CONTRACT',
          tripCount: 0,
          daysCount: daysInMonth,
          rate: monthlyRate,
          advance: 0,
          amount,
        });
      } else {
        const tripCount = await this.prisma.trip.count({
          where: {
            vehicleId: cv.vehicleId,
            date: { gte: periodStart, lte: periodEnd },
            status: 'COMPLETED',
          },
        });
        const tripRate = Number(cv.tripRate ?? client.adhocTripRate ?? 0);
        const amount = tripCount * tripRate;
        lineItems.push({
          vehicleId: cv.vehicleId,
          vehicleRegNumber: regNumber,
          description,
          billingType: 'ADHOC',
          tripCount,
          daysCount: null,
          rate: tripRate,
          advance: 0,
          amount,
        });
      }
    }

    const subtotal = lineItems.reduce((s, li) => s + li.amount, 0);
    const dueDate = new Date(periodEnd);
    dueDate.setDate(dueDate.getDate() + (client.paymentTermsDays ?? 15));

    const invoice = await this.create({
      clientId: dto.clientId,
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,
      dueDate,
      status: 'DRAFT',
      subtotal,
      totalDeductions: 0,
      lineItems,
      deductions: [],
    });

    return invoice;
  }
}
