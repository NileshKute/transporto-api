import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as PDFDocument from 'pdfkit';
import * as path from 'path';
import * as fs from 'fs';

const COMPANY = {
  name: 'G K ENTERPRISE',
  type: 'FLEET OWNERS & TRANSPORT CONTRACTORS',
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
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function fmt(n: number): string {
  return Math.round(n).toLocaleString('en-IN');
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

    const entries = await this.prisma.driverLedger.findMany({
      where: { driverId, month, year },
      orderBy: { date: 'asc' },
    });

    const baseSalary = Number(driver.baseSalary ?? driver.salary ?? 0);

    let totalExtraDuty = 0;
    let totalAdvances = 0;
    for (const e of entries) {
      const amt = Number(e.amount);
      if (e.type === 'EXTRA_DUTY') totalExtraDuty += amt;
      if (e.type === 'ADVANCE_RECOVERY' || e.type === 'FUEL_ADVANCE') {
        totalAdvances += amt;
      }
    }

    const salaryPlusExtra = baseSalary + totalExtraDuty;
    const payable = salaryPlusExtra - totalAdvances;
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

    // ═══════════════════════════════════════════
    // HEADER BARS
    // ═══════════════════════════════════════════
    doc.save();
    doc.rect(0, 0, PW, 8).fill(C.navy);
    doc.rect(0, 8, PW, 3).fill(C.ice);
    doc.restore();

    y = 20;

    // ═══════════════════════════════════════════
    // GK MONOGRAM + COMPANY INFO
    // ═══════════════════════════════════════════
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

    // ═══════════════════════════════════════════
    // DRIVER NAME + MONTH HEADING (centered)
    // ═══════════════════════════════════════════
    doc.fillColor(C.navy).font('Helvetica-Bold').fontSize(16)
      .text(driver.name, ML, y, { width: CW, align: 'center' });
    y += 22;

    doc.fillColor(C.gray).font('Helvetica').fontSize(12)
      .text(`${monthLabel} Ledger`, ML, y, { width: CW, align: 'center' });
    y += 24;

    // ═══════════════════════════════════════════
    // TABLE HEADER
    // ═══════════════════════════════════════════
    const colDate = 80;
    const colDesc = CW - 80 - 110 - 110;
    const colDenar = 110;
    const colDile = 110;

    const headerH = 28;
    doc.save();
    doc.rect(ML, y, CW, headerH).fill(C.navy);
    doc.restore();

    doc.font('Helvetica-Bold').fontSize(9).fillColor(C.white);
    let cx = ML;
    doc.text('Date', cx + 6, y + 9, { width: colDate - 6, align: 'left' });
    cx += colDate;
    doc.text('Description', cx + 6, y + 9, { width: colDesc - 6, align: 'left' });
    cx += colDesc;
    doc.text('देणार आहे', cx, y + 9, { width: colDenar, align: 'right' });
    cx += colDenar;
    doc.text('दिले आहेत', cx, y + 9, { width: colDile - 6, align: 'right' });

    y += headerH;

    // ═══════════════════════════════════════════
    // TABLE ROWS
    // ═══════════════════════════════════════════
    const rowH = 20;
    doc.font('Helvetica').fontSize(8);

    entries.forEach((entry, idx) => {
      if (y > 720) {
        doc.addPage();
        y = 40;
      }

      if (idx % 2 === 1) {
        doc.save();
        doc.rect(ML, y, CW, rowH).fill(C.rowAlt);
        doc.restore();
      }

      const amt = Number(entry.amount);
      const isDenar = entry.type === 'EXTRA_DUTY';
      const isDile = !isDenar;

      cx = ML;
      doc.fillColor(C.black);
      doc.text(fmtDate(entry.date), cx + 6, y + 6, { width: colDate - 6, align: 'left' });
      cx += colDate;
      doc.text(String(entry.description || '').slice(0, 40), cx + 6, y + 6, { width: colDesc - 12, align: 'left' });
      cx += colDesc;
      doc.text(isDenar ? `₹ ${fmt(amt)}` : '', cx, y + 6, { width: colDenar, align: 'right' });
      cx += colDenar;
      doc.text(isDile ? `₹ ${fmt(amt)}` : '', cx, y + 6, { width: colDile - 6, align: 'right' });

      doc.save();
      doc.lineWidth(0.5).strokeColor(C.border)
        .moveTo(ML, y + rowH).lineTo(ML + CW, y + rowH).stroke();
      doc.restore();

      y += rowH;
    });

    // ═══════════════════════════════════════════
    // TOTALS ROW
    // ═══════════════════════════════════════════
    doc.save();
    doc.lineWidth(1).strokeColor(C.navy)
      .moveTo(ML, y).lineTo(ML + CW, y).stroke();
    doc.restore();
    y += 2;

    doc.save();
    doc.rect(ML, y, CW, rowH).fill(C.bg);
    doc.restore();

    doc.font('Helvetica-Bold').fontSize(9).fillColor(C.navy);
    cx = ML;
    doc.text('Total', cx + 6, y + 6, { width: colDate - 6, align: 'left' });
    cx += colDate + colDesc;
    doc.text(`₹ ${fmt(totalExtraDuty)}`, cx, y + 6, { width: colDenar, align: 'right' });
    cx += colDenar;
    doc.text(`₹ ${fmt(totalAdvances)}`, cx, y + 6, { width: colDile - 6, align: 'right' });
    y += rowH + 4;

    // ═══════════════════════════════════════════
    // FOOTER SUMMARY
    // ═══════════════════════════════════════════
    const summaryRows = [
      { label: `${monthLabel} Salary`, value: `₹ ${fmt(baseSalary)}` },
      { label: 'Salary + Extra Working Amount', value: `₹ ${fmt(salaryPlusExtra)}` },
      { label: 'Salary Against Advance', value: `₹ ${fmt(totalAdvances)}` },
      { label: 'Payable', value: `₹ ${fmt(payable)}`, bold: true },
      { label: 'Payment Date', value: '' },
    ];

    const labelW = CW * 0.6;
    const valW = CW * 0.4;

    for (const row of summaryRows) {
      if (y > 760) {
        doc.addPage();
        y = 40;
      }

      if (row.bold) {
        doc.save();
        doc.rect(ML, y, CW, rowH + 2).fill(C.navy);
        doc.restore();
        doc.font('Helvetica-Bold').fontSize(10).fillColor(C.white);
        doc.text(row.label, ML + 6, y + 6, { width: labelW });
        doc.text(row.value, ML + labelW, y + 6, { width: valW - 6, align: 'right' });
        y += rowH + 2;
      } else {
        doc.save();
        doc.rect(ML, y, CW, rowH).fill(C.bg);
        doc.restore();
        doc.font('Helvetica').fontSize(9).fillColor(C.black);
        doc.text(row.label, ML + 6, y + 6, { width: labelW });
        doc.font('Helvetica-Bold').fillColor(C.navy);
        doc.text(row.value, ML + labelW, y + 6, { width: valW - 6, align: 'right' });
        y += rowH;
      }

      doc.save();
      doc.lineWidth(0.5).strokeColor(C.border)
        .moveTo(ML, y).lineTo(ML + CW, y).stroke();
      doc.restore();
    }

    y += 20;

    // ═══════════════════════════════════════════
    // SIGNATURE
    // ═══════════════════════════════════════════
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

    // ═══════════════════════════════════════════
    // FOOTER BARS
    // ═══════════════════════════════════════════
    const pageH = 841.89;
    doc.save();
    doc.rect(0, pageH - 11, PW, 3).fill(C.ice);
    doc.rect(0, pageH - 8, PW, 8).fill(C.navy);
    doc.restore();

    doc.end();
    return done;
  }
}
