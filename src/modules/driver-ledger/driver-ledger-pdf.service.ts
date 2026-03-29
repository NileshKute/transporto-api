import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as PDFDocument from 'pdfkit';
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
};

const MONTHS = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const CREDIT_TYPES = ['EXTRA_DUTY', 'BONUS'];
const DEBIT_TYPES = ['ADVANCE_RECOVERY', 'PENALTY', 'FOOD', 'FUEL_ADVANCE', 'TOLL', 'MAINTENANCE'];

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

const ML = 40;
const MR = 40;
const PW = 595.28;
const CW = PW - ML - MR;

@Injectable()
export class DriverLedgerPdfService {
  constructor(private prisma: PrismaService) {}

  async generate(driverId: string, month: number, year: number): Promise<Buffer> {
    const driver = await this.prisma.driver.findFirst({
      where: { id: driverId, isDeleted: false },
    });
    if (!driver) throw new NotFoundException('Driver not found');

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const entries = await this.prisma.driverLedger.findMany({
      where: {
        driverId,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: 'asc' },
    });

    const baseSalary = Number(driver.baseSalary ?? driver.salary ?? 0);

    let totalCredits = 0;
    let totalDebits = 0;

    for (const e of entries) {
      const amt = Number(e.amount);
      if (CREDIT_TYPES.includes(e.type)) {
        totalCredits += amt;
      } else if (DEBIT_TYPES.includes(e.type)) {
        totalDebits += amt;
      } else if (e.type === 'OTHER') {
        if (amt >= 0) totalCredits += amt;
        else totalDebits += Math.abs(amt);
      }
    }

    const salaryPlusCredits = baseSalary + totalCredits;
    const netPayable = salaryPlusCredits - totalDebits;
    const monthLabel = `${MONTHS[month]} ${year}`;

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

    const rightX = PW - MR;
    doc.fillColor(C.navy).font('Helvetica-Bold').fontSize(14)
      .text('DRIVER LEDGER', rightX - 140, monoY + 1, { width: 140, align: 'right' });

    y = contactY + 16;

    doc.save();
    doc.lineWidth(1.5).strokeColor(C.navy)
      .moveTo(ML, y).lineTo(PW - MR, y).stroke();
    doc.restore();
    y += 12;

    // DRIVER NAME + MONTH HEADING
    doc.fillColor(C.navy).font('Helvetica-Bold').fontSize(16)
      .text(driver.name, ML, y, { width: CW, align: 'center' });
    y += 22;

    doc.fillColor(C.gray).font('Helvetica').fontSize(12)
      .text(`${monthLabel} Ledger`, ML, y, { width: CW, align: 'center' });
    y += 24;

    // TABLE
    const colDate = 70;
    const colCredit = 80;
    const colDebit = 80;
    const colDesc = CW - colDate - colCredit - colDebit;

    // Table header
    const headerH = 26;
    doc.save();
    doc.rect(ML, y, CW, headerH).fill(C.navy);
    doc.restore();

    doc.font('Helvetica-Bold').fontSize(9).fillColor(C.white);
    let cx = ML;
    doc.text('Date', cx + 6, y + 8, { width: colDate - 6, align: 'left' });
    cx += colDate;
    doc.text('Description', cx + 6, y + 8, { width: colDesc - 6, align: 'left' });
    cx += colDesc;
    doc.text('Credit', cx, y + 8, { width: colCredit - 6, align: 'right' });
    cx += colCredit;
    doc.text('Debit', cx, y + 8, { width: colDebit - 6, align: 'right' });

    // Table border
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
      doc.font('Helvetica').fontSize(9);
      const descH = doc.heightOfString(descText, { width: colDesc - 12 });
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
      const isCredit = CREDIT_TYPES.includes(entry.type) || (entry.type === 'OTHER' && amt >= 0);
      const isDebit = DEBIT_TYPES.includes(entry.type) || (entry.type === 'OTHER' && amt < 0);

      const textY = y + descPad;

      cx = ML;
      doc.font('Helvetica').fontSize(8).fillColor(C.black);
      doc.text(fmtDate(entry.date), cx + 6, textY, { width: colDate - 6, align: 'left' });
      cx += colDate;
      doc.font('Helvetica').fontSize(9).fillColor(C.black);
      doc.text(descText, cx + 6, textY, { width: colDesc - 12, align: 'left' });
      cx += colDesc;
      doc.font('Helvetica').fontSize(8).fillColor(C.black);
      doc.text(isCredit ? fmtCurrency(amt) : '', cx, textY, { width: colCredit - 6, align: 'right' });
      cx += colCredit;
      doc.text(isDebit ? fmtCurrency(Math.abs(amt)) : '', cx, textY, { width: colDebit - 6, align: 'right' });

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
    doc.text('Total', cx + 6, y + 6, { width: colDate + colDesc - 6, align: 'left' });
    cx = ML + colDate + colDesc;
    doc.text(fmtCurrency(totalCredits), cx, y + 6, { width: colCredit - 6, align: 'right' });
    cx += colCredit;
    doc.text(fmtCurrency(totalDebits), cx, y + 6, { width: colDebit - 6, align: 'right' });

    doc.save();
    doc.lineWidth(1).strokeColor(C.navy)
      .rect(ML, y, CW, totalRowH).stroke();
    doc.restore();

    y += totalRowH + 4;

    // SUMMARY SECTION
    const summaryRows = [
      { label: `Base Salary (${monthLabel})`, value: fmtCurrency(baseSalary) },
      { label: 'Salary + Extra Duty Amount', value: fmtCurrency(salaryPlusCredits) },
      { label: 'Total Deductions', value: fmtCurrency(totalDebits) },
      { label: 'NET PAYABLE', value: fmtCurrency(netPayable), bold: true },
      { label: 'Payment Date', value: '' },
    ];

    const labelW = CW * 0.6;
    const valW = CW * 0.4;

    for (const row of summaryRows) {
      if (y > 760) {
        doc.addPage();
        y = 40;
      }

      const rH = row.bold ? minRowH + 4 : minRowH;

      if (row.bold) {
        doc.save();
        doc.rect(ML, y, CW, rH).fill(C.navy);
        doc.restore();
        doc.font('Helvetica-Bold').fontSize(11).fillColor(C.white);
        doc.text(row.label, ML + 6, y + 7, { width: labelW });
        doc.text(row.value, ML + labelW, y + 7, { width: valW - 6, align: 'right' });
      } else {
        doc.save();
        doc.rect(ML, y, CW, rH).fill(C.bg);
        doc.restore();
        doc.font('Helvetica').fontSize(9).fillColor(C.black);
        doc.text(row.label, ML + 6, y + 6, { width: labelW });
        doc.font('Helvetica-Bold').fillColor(C.navy);
        doc.text(row.value, ML + labelW, y + 6, { width: valW - 6, align: 'right' });
      }

      doc.save();
      doc.lineWidth(0.5).strokeColor(C.border)
        .rect(ML, y, CW, rH).stroke();
      doc.restore();

      y += rH;
    }

    y += 20;

    // SIGNATURE
    if (y > 720) {
      doc.addPage();
      y = 40;
    }

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
