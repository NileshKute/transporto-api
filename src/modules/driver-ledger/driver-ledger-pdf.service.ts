import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DriverLedgerService } from './driver-ledger.service';
import {
  classifyLedgerSide,
  excludeFromNetTotals,
} from './ledger-entry-classification';
import PDFDocument from 'pdfkit';
import * as path from 'path';
import * as fs from 'fs';

const COMPANY = {
  name: 'G K ENTERPRISE',
  type: 'FLEET OWNERS & COLD CHAIN LOGISTICS SPECIALISTS',
  address:
    'Office 402, SHREE GANESH CHS LTD, PLOT NO 151, PHASE II, NAVDE, TALOJA, PANVEL, NAVI MUMBAI 410208',
  mobile: '+91 9324540988',
  email: 'ganesh@gkenterprise.in',
  web: 'www.gkenterprise.in',
};

const C = {
  navy: '#0D2847',
  royal: '#1565C0',
  ice: '#42A5F5',
  white: '#FFFFFF',
  bg: '#F4F6F8',
  rowAlt: '#F8F9FA',
  border: '#E0E8F0',
  gray: '#6B7B8D',
  black: '#1A1A1A',
  green: '#16A34A',
  orange: '#F59E0B',
};

const MONTHS = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function fmtCurrency(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: Date | string): string {
  const x = new Date(d);
  if (isNaN(x.getTime())) return '—';
  return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()}`;
}

function resolveSignaturePath(): string | null {
  const candidates = [
    path.join(process.cwd(), 'src', 'assets', 'signature.jpeg'),
    path.join(__dirname, '..', '..', 'assets', 'signature.jpeg'),
    path.join(process.cwd(), 'assets', 'signature.jpeg'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch { /* skip */ }
  }
  return null;
}

function getPeriodTitle(filterType: string, params: any): string {
  const now = new Date();
  switch (filterType) {
    case 'month': {
      const m = parseInt(params.month) || (now.getMonth() + 1);
      const y = parseInt(params.year) || now.getFullYear();
      return `${MONTHS[m]} ${y} Ledger`;
    }
    case 'year': {
      if (params.financialYear) return `FY ${params.financialYear} Ledger`;
      const yr = parseInt(params.year) || now.getFullYear();
      return `Year ${yr} Ledger`;
    }
    case 'lastX': {
      const months = parseInt(params.lastMonths) || 3;
      const start = new Date(now.getFullYear(), now.getMonth() - months, 1);
      const startLabel = `${MONTHS[start.getMonth() + 1]} ${start.getFullYear()}`;
      const endLabel = `${MONTHS[now.getMonth() + 1]} ${now.getFullYear()}`;
      return `Last ${months} Months Ledger (${startLabel} - ${endLabel})`;
    }
    case 'custom': {
      if (params.startDate && params.endDate) {
        return `${fmtDate(params.startDate)} to ${fmtDate(params.endDate)} Ledger`;
      }
      return 'Custom Period Ledger';
    }
    case 'all':
      return 'Complete Ledger';
    default: {
      const m = parseInt(params.month) || (now.getMonth() + 1);
      const y = parseInt(params.year) || now.getFullYear();
      return `${MONTHS[m]} ${y} Ledger`;
    }
  }
}

function formatDriverLedgerName(driver: { name: string; nickname?: string | null }): string {
  const nick = driver.nickname?.trim();
  return nick ? `${nick} (${driver.name})` : driver.name;
}

function ledgerTypeLabel(entry: { type: string; category?: string | null; description?: string | null }): string {
  const blob = `${entry.category ?? ''} ${entry.description ?? ''}`.toLowerCase();
  if (entry.type === 'ADVANCE' && blob.includes('salary against advance')) {
    return 'Salary Against Advance';
  }
  return entry.type.replace(/_/g, ' ');
}

const ML = 40;
const MR = 40;
const PW = 595.28;
const CW = PW - ML - MR;

@Injectable()
export class DriverLedgerPdfService {
  constructor(
    private prisma: PrismaService,
    private ledgerService: DriverLedgerService,
  ) {}

  async generate(driverId: string, query: any): Promise<Buffer> {
    const driver = await this.prisma.driver.findFirst({
      where: { id: driverId, isDeleted: false },
    });
    if (!driver) throw new NotFoundException('Driver not found');

    const filterType = query.filterType || 'month';
    const dateFilter = this.ledgerService.buildDateFilter(filterType, query);

    const where: any = { driverId };
    if (dateFilter) where.date = dateFilter;

    const entries = await this.prisma.driverLedger.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    let totalCredits = 0;
    let totalDebits = 0;
    let paidCount = 0;
    let unpaidCount = 0;
    let paidAmount = 0;
    let unpaidAmount = 0;

    for (const e of entries) {
      const amt = Math.abs(Number(e.amount));
      const side = classifyLedgerSide(e);
      if (!excludeFromNetTotals(e)) {
        if (side === 'credit') totalCredits += amt;
        else totalDebits += amt;
      }

      if (e.isPaid) {
        paidCount++;
        paidAmount += amt;
      } else {
        unpaidCount++;
        unpaidAmount += amt;
      }
    }

    const periodTitle = getPeriodTitle(filterType, query);

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 30, bottom: 30, left: ML, right: MR },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    let y = 30;

    // HEADER BARS
    doc.save();
    doc.rect(0, 0, PW, 8).fill(C.navy);
    doc.rect(0, 8, PW, 3).fill(C.ice);
    doc.restore();

    y = 20;

    // GK MONOGRAM + COMPANY INFO
    const monoX = ML;
    const monoY = y;
    const monoSize = 35;

    doc.save();
    doc.roundedRect(monoX, monoY, monoSize, monoSize, 5).fill(C.navy);
    doc.font('Helvetica-Bold').fontSize(18);
    doc.fillColor(C.white).text('G', monoX + 3, monoY + 6, { width: 16, continued: false });
    doc.fillColor(C.ice).text('K', monoX + 17, monoY + 6, { width: 16 });
    doc.restore();

    const infoX = monoX + monoSize + 10;
    doc.fillColor(C.navy).font('Helvetica-Bold').fontSize(16)
      .text(COMPANY.name, infoX, monoY + 1);
    doc.fillColor(C.gray).font('Helvetica').fontSize(8)
      .text(COMPANY.type, infoX, monoY + 19);
    doc.fontSize(7).fillColor(C.gray)
      .text(COMPANY.address, infoX, monoY + 30, { width: 280 });

    const contactY = monoY + 46;
    doc.fontSize(7).fillColor(C.gray)
      .text(
        `Mob: ${COMPANY.mobile}  |  Email: ${COMPANY.email}  |  Web: ${COMPANY.web}`,
        infoX, contactY, { width: 300 },
      );

    doc.fillColor(C.navy).font('Helvetica-Bold').fontSize(14)
      .text('DRIVER LEDGER', PW - MR - 140, monoY + 1, { width: 140, align: 'right' });

    y = contactY + 16;

    doc.save();
    doc.lineWidth(1.5).strokeColor(C.navy)
      .moveTo(ML, y).lineTo(PW - MR, y).stroke();
    doc.restore();
    y += 12;

    // DRIVER NAME + PERIOD HEADING
    doc.fillColor(C.navy).font('Helvetica-Bold').fontSize(16)
      .text(formatDriverLedgerName(driver), ML, y, { width: CW, align: 'center' });
    y += 22;

    doc.fillColor(C.gray).font('Helvetica').fontSize(12)
      .text(periodTitle, ML, y, { width: CW, align: 'center' });
    y += 24;

    // TABLE — 6 columns: Date | Description | Type | Credit | Debit | Status
    const colDate = 58;
    const colType = 68;
    const colCredit = 65;
    const colDebit = 65;
    const colStatus = 52;
    const colDesc = CW - colDate - colType - colCredit - colDebit - colStatus;

    // Table header
    const headerH = 26;
    doc.save();
    doc.rect(ML, y, CW, headerH).fill(C.navy);
    doc.restore();

    doc.font('Helvetica-Bold').fontSize(8).fillColor(C.white);
    let cx = ML;
    doc.text('Date', cx + 4, y + 8, { width: colDate - 4, align: 'left' });
    cx += colDate;
    doc.text('Description', cx + 4, y + 8, { width: colDesc - 4, align: 'left' });
    cx += colDesc;
    doc.text('Type', cx + 3, y + 8, { width: colType - 3, align: 'left' });
    cx += colType;
    doc.text('Credit', cx, y + 8, { width: colCredit - 4, align: 'right' });
    cx += colCredit;
    doc.text('Debit', cx, y + 8, { width: colDebit - 4, align: 'right' });
    cx += colDebit;
    doc.text('Status', cx + 3, y + 8, { width: colStatus - 3, align: 'left' });

    doc.save();
    doc.lineWidth(1).strokeColor(C.navy)
      .rect(ML, y, CW, headerH).stroke();
    doc.restore();

    y += headerH;

    // Table rows
    const minRowH = 20;
    const descPad = 6;

    entries.forEach((entry, idx) => {
      const descText = String(entry.description || '—');
      doc.font('Helvetica').fontSize(8);
      const descH = doc.heightOfString(descText, { width: colDesc - 10 });
      const rowH = Math.max(minRowH, descH + descPad * 2);

      if (y + rowH > 720) {
        doc.addPage();
        y = 40;
      }

      if (idx % 2 === 1) {
        doc.save();
        doc.rect(ML, y, CW, rowH).fill(C.rowAlt);
        doc.restore();
      }

      const amt = Number(entry.amount);
      const side = classifyLedgerSide(entry);
      const textY = y + descPad;

      cx = ML;
      doc.font('Helvetica').fontSize(7).fillColor(C.black);
      doc.text(fmtDate(entry.date), cx + 4, textY, { width: colDate - 4, align: 'left' });
      cx += colDate;
      doc.font('Helvetica').fontSize(8).fillColor(C.black);
      doc.text(descText, cx + 4, textY, { width: colDesc - 10, align: 'left' });
      cx += colDesc;
      doc.font('Helvetica').fontSize(6.5).fillColor(C.gray);
      doc.text(ledgerTypeLabel(entry), cx + 3, textY, { width: colType - 3, align: 'left' });
      cx += colType;
      doc.font('Helvetica').fontSize(8).fillColor(C.black);
      doc.text(side === 'credit' ? fmtCurrency(Math.abs(amt)) : '', cx, textY, { width: colCredit - 4, align: 'right' });
      cx += colCredit;
      doc.text(side === 'debit' ? fmtCurrency(Math.abs(amt)) : '', cx, textY, { width: colDebit - 4, align: 'right' });
      cx += colDebit;
      const statusLabel = entry.isPaid ? 'PAID' : 'PENDING';
      const statusColor = entry.isPaid ? C.green : C.orange;
      doc.font('Helvetica-Bold').fontSize(6.5).fillColor(statusColor);
      doc.text(statusLabel, cx + 3, textY, { width: colStatus - 3, align: 'left' });

      if (entry.isPaid && entry.paidMode) {
        doc.font('Helvetica').fontSize(5.5).fillColor(C.gray);
        doc.text(`(${entry.paidMode})`, cx + 3, textY + 9, { width: colStatus - 3, align: 'left' });
      }

      doc.save();
      doc.lineWidth(0.5).strokeColor(C.border)
        .moveTo(ML, y + rowH).lineTo(ML + CW, y + rowH).stroke();
      doc.restore();

      y += rowH;
    });

    // Totals row
    doc.save();
    doc.lineWidth(1.5).strokeColor(C.navy)
      .moveTo(ML, y).lineTo(ML + CW, y).stroke();
    doc.restore();
    y += 1;

    const totalRowH = minRowH + 2;
    doc.save();
    doc.rect(ML, y, CW, totalRowH).fill(C.bg);
    doc.restore();

    doc.font('Helvetica-Bold').fontSize(9).fillColor(C.navy);
    cx = ML;
    doc.text('Total', cx + 4, y + 6, { width: colDate + colDesc + colType - 4, align: 'left' });
    cx = ML + colDate + colDesc + colType;
    doc.text(fmtCurrency(totalCredits), cx, y + 6, { width: colCredit - 4, align: 'right' });
    cx += colCredit;
    doc.text(fmtCurrency(totalDebits), cx, y + 6, { width: colDebit - 4, align: 'right' });

    doc.save();
    doc.lineWidth(1).strokeColor(C.navy)
      .rect(ML, y, CW, totalRowH).stroke();
    doc.restore();

    y += totalRowH + 4;

    // NET row
    const net = totalCredits - totalDebits;
    const netRowH = minRowH + 4;
    if (y + netRowH > 760) { doc.addPage(); y = 40; }

    doc.save();
    doc.rect(ML, y, CW, netRowH).fill(C.navy);
    doc.restore();
    doc.font('Helvetica-Bold').fontSize(11).fillColor(C.white);
    doc.text('Net (Credits − Debits)', ML + 6, y + 7, { width: CW * 0.6 });
    doc.text(fmtCurrency(net), ML + CW * 0.6, y + 7, { width: CW * 0.4 - 6, align: 'right' });
    doc.save();
    doc.lineWidth(1).strokeColor(C.navy).rect(ML, y, CW, netRowH).stroke();
    doc.restore();

    y += netRowH + 10;

    // PAID / UNPAID SUMMARY
    if (y + 30 > 720) { doc.addPage(); y = 40; }
    doc.font('Helvetica').fontSize(8).fillColor(C.gray);
    doc.text(
      `Paid entries: ${paidCount} entries (\u20B9${fmtCurrency(paidAmount)} settled)    |    Unpaid entries: ${unpaidCount} entries (\u20B9${fmtCurrency(unpaidAmount)} pending for salary)`,
      ML, y, { width: CW, align: 'center' },
    );

    y += 26;

    // SIGNATURE
    if (y > 720) { doc.addPage(); y = 40; }

    const sigBlockX = PW - MR - 140;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(C.navy)
      .text('For G K ENTERPRISE', sigBlockX, y, { width: 140, align: 'center' });
    y += 14;

    const sigImgPath = resolveSignaturePath();
    if (sigImgPath) {
      try {
        doc.image(sigImgPath, sigBlockX + 40, y, { width: 60, height: 40 });
      } catch {
        doc.font('Helvetica-Oblique').fontSize(10).fillColor(C.gray)
          .text('Sd/-', sigBlockX, y + 10, { width: 140, align: 'center' });
      }
    } else {
      doc.font('Helvetica-Oblique').fontSize(10).fillColor(C.gray)
        .text('Sd/-', sigBlockX, y + 10, { width: 140, align: 'center' });
    }
    y += 44;

    doc.save();
    doc.lineWidth(0.5).strokeColor(C.gray)
      .moveTo(sigBlockX, y).lineTo(PW - MR, y).stroke();
    doc.restore();
    y += 4;

    doc.font('Helvetica').fontSize(7.5).fillColor(C.gray)
      .text('Proprietor', sigBlockX, y, { width: 140, align: 'center' });

    // FOOTER BARS
    const pageH = 841.89;
    doc.save();
    doc.rect(0, pageH - 11, PW, 3).fill(C.ice);
    doc.rect(0, pageH - 8, PW, 8).fill(C.navy);
    doc.restore();

    doc.end();
    return done;
  }
}
