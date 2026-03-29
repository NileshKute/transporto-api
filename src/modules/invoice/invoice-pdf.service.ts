import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as path from 'path';
import * as fs from 'fs';

const COMPANY = {
  name: 'G K ENTERPRISE',
  type: 'FLEET OWNERS & COLD CHAIN LOGISTICS SPECIALISTS',
  proprietor: 'Ganesh Kute',
  address:
    'Office 402, SHREE GANESH CHS LTD, PLOT NO 151, PHASE II, NAVDE, TALOJA, PANVEL, NAVI MUMBAI 410208',
  mobile: '+91 9324540988',
  email: 'ganesh@gkenterprise.in',
  web: 'www.gkenterprise.in',
  pan: 'AWCPK8573C',
  gst: '27AWCPK8573C1ZG',
  bank: 'IDBI BANK',
  branch: 'KAMOTHE, NAVI MUMBAI',
  accountNo: '1043102000008549',
  ifsc: 'IBKL0001043',
  hsnsac: '996511',
};

const C = {
  navy: '#0D2847',
  royal: '#1565C0',
  ice: '#42A5F5',
  white: '#FFFFFF',
  bg: '#F4F6F8',
  rowAlt: '#F8F9FA',
  border: '#E0E8F0',
  bankBg: '#E3F2FD',
  gray: '#6B7B8D',
  black: '#1A1A1A',
};

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
export class InvoicePdfService {
  async generate(invoice: any): Promise<Buffer> {
    const client = invoice.client;
    const lineItems: any[] = invoice.lineItems || [];
    const deductions: any[] = invoice.deductions || [];

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
    // 1. HEADER BARS
    // ═══════════════════════════════════════════
    doc.save();
    doc.rect(0, 0, PW, 8).fill(C.navy);
    doc.rect(0, 8, PW, 3).fill(C.ice);
    doc.restore();

    y = 20;

    // ═══════════════════════════════════════════
    // 2. GK MONOGRAM + COMPANY INFO + TAX INVOICE
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
      .text('TAX INVOICE', rightX - 140, monoY + 1, { width: 140, align: 'right' });
    doc.fillColor(C.gray).font('Helvetica').fontSize(8)
      .text(`GSTIN: ${COMPANY.gst}`, rightX - 140, monoY + 19, { width: 140, align: 'right' });
    doc.text(`PAN: ${COMPANY.pan}`, rightX - 140, monoY + 30, { width: 140, align: 'right' });

    y = contactY + 16;

    doc.save();
    doc.lineWidth(1.5).strokeColor(C.navy)
      .moveTo(ML, y).lineTo(PW - MR, y).stroke();
    doc.restore();
    y += 8;

    // ═══════════════════════════════════════════
    // 3. BILL INFO
    // ═══════════════════════════════════════════
    const billH = 52;
    doc.save();
    doc.rect(ML, y, CW, billH).fill(C.bg);
    doc.restore();

    const billPad = 10;
    const bY = y + billPad;

    doc.fillColor(C.navy).font('Helvetica-Bold').fontSize(9)
      .text('Invoice No:', ML + billPad, bY, { continued: true })
      .font('Helvetica').text(`  ${invoice.invoiceNumber || '—'}`);
    doc.font('Helvetica-Bold')
      .text('Date:', ML + billPad, bY + 14, { continued: true })
      .font('Helvetica').text(`  ${fmtDate(invoice.issueDate)}`);
    doc.font('Helvetica-Bold')
      .text('Due Date:', ML + billPad, bY + 28, { continued: true })
      .font('Helvetica').text(`  ${fmtDate(invoice.dueDate)}`);

    const clientX = ML + CW / 2 + 10;
    doc.fillColor(C.navy).font('Helvetica-Bold').fontSize(9)
      .text('M/S:', clientX, bY, { continued: true })
      .font('Helvetica').text(`  ${client?.name || '—'}`);
    doc.font('Helvetica-Bold')
      .text('GSTIN:', clientX, bY + 14, { continued: true })
      .font('Helvetica').text(`  ${client?.gstNumber || 'N/A'}`);
    if (client?.address) {
      doc.font('Helvetica').fontSize(7).fillColor(C.gray)
        .text(client.address, clientX, bY + 28, { width: CW / 2 - 20 });
    }

    y += billH + 8;

    // ═══════════════════════════════════════════
    // 4. LINE ITEMS TABLE
    // ═══════════════════════════════════════════
    const cols = [
      { label: 'Sr No',       w: 32,  align: 'center' as const },
      { label: 'Vehicle No',  w: 84,  align: 'left' as const },
      { label: 'Particulars', w: 138, align: 'left' as const },
      { label: 'Trips',       w: 38,  align: 'right' as const },
      { label: 'Days',        w: 38,  align: 'right' as const },
      { label: 'Rate (₹)',   w: 62,  align: 'right' as const },
      { label: 'Amount (₹)', w: CW - 32 - 84 - 138 - 38 - 38 - 62, align: 'right' as const },
    ];

    const headerH = 20;
    doc.save();
    doc.rect(ML, y, CW, headerH).fill(C.navy);
    doc.restore();

    let cx = ML;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(C.white);
    for (const c of cols) {
      const pad = c.align === 'left' ? 6 : 0;
      doc.text(c.label, cx + pad, y + 6, { width: c.w - pad, align: c.align });
      cx += c.w;
    }

    y += headerH;

    const rowH = 18;
    doc.font('Helvetica').fontSize(8);

    lineItems.forEach((item: any, idx: number) => {
      if (idx % 2 === 1) {
        doc.save();
        doc.rect(ML, y, CW, rowH).fill(C.rowAlt);
        doc.restore();
      }

      const vals = [
        String(idx + 1),
        (item.vehicleRegNumber || '').toString(),
        (item.description || '').toString().slice(0, 32),
        item.billingType === 'ADHOC' ? String(item.tripCount ?? 0) : '—',
        item.daysCount != null ? String(Number(item.daysCount)) : '—',
        fmt(Number(item.rate ?? 0)),
        fmt(Number(item.amount ?? 0)),
      ];

      cx = ML;
      doc.fillColor(C.black);
      vals.forEach((v, i) => {
        const c = cols[i];
        const pad = c.align === 'left' ? 6 : 0;
        const rpad = c.align === 'right' ? 6 : 0;
        doc.text(v, cx + pad, y + 5, { width: c.w - pad - rpad, align: c.align });
        cx += c.w;
      });

      doc.save();
      doc.lineWidth(0.5).strokeColor(C.border)
        .moveTo(ML, y + rowH).lineTo(ML + CW, y + rowH).stroke();
      doc.restore();

      y += rowH;
    });

    doc.save();
    doc.lineWidth(1).strokeColor(C.navy)
      .moveTo(ML, y).lineTo(ML + CW, y).stroke();
    doc.restore();
    y += 8;

    // ═══════════════════════════════════════════
    // 5. TOTALS
    // ═══════════════════════════════════════════
    const totLabelX = PW - MR - 220;
    const totValX = PW - MR - 90;
    const totValW = 90;

    const subtotal = Number(invoice.subtotal ?? 0);
    const totalAmount = Number(invoice.totalAmount ?? 0);

    doc.font('Helvetica').fontSize(9).fillColor(C.black);
    doc.text('Subtotal:', totLabelX, y, { width: 120, align: 'right' });
    doc.text(`₹ ${fmt(subtotal)}`, totValX, y, { width: totValW, align: 'right' });
    y += 14;

    deductions.forEach((d: any) => {
      const label = `Less: ${(d.description || '').toString()}`;
      doc.fillColor(C.gray).text(label, totLabelX, y, { width: 120, align: 'right' });
      doc.fillColor('#DC2626').text(
        `- ₹ ${fmt(Number(d.amount ?? 0))}`,
        totValX, y, { width: totValW, align: 'right' },
      );
      y += 13;
    });

    doc.save();
    doc.lineWidth(0.5).strokeColor(C.border)
      .moveTo(totLabelX, y).lineTo(PW - MR, y).stroke();
    doc.restore();
    y += 6;

    doc.font('Helvetica-Bold').fontSize(11).fillColor(C.navy);
    doc.text('TOTAL:', totLabelX, y, { width: 120, align: 'right' });
    doc.text(`₹ ${fmt(totalAmount)}`, totValX, y, { width: totValW, align: 'right' });
    y += 18;

    const words = (invoice.amountInWords || '').toString();
    if (words) {
      doc.font('Helvetica-Oblique').fontSize(8).fillColor(C.gray)
        .text(`Amount in words: ${words}`, ML, y, { width: CW });
      y += 16;
    }

    doc.save();
    doc.lineWidth(0.5).strokeColor(C.border)
      .moveTo(ML, y).lineTo(PW - MR, y).stroke();
    doc.restore();
    y += 10;

    // ═══════════════════════════════════════════
    // 6. BANK DETAILS + TERMS
    // ═══════════════════════════════════════════
    const panelW = (CW - 16) / 2;
    const panelH = 68;

    doc.save();
    doc.roundedRect(ML, y, panelW, panelH, 4).fill(C.bankBg);
    doc.restore();

    const bkX = ML + 8;
    let bkY = y + 8;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(C.navy)
      .text('BANK DETAILS', bkX, bkY);
    bkY += 12;
    doc.font('Helvetica').fontSize(7.5).fillColor(C.black);
    doc.text(`Bank: ${COMPANY.bank}`, bkX, bkY); bkY += 11;
    doc.text(`Branch: ${COMPANY.branch}`, bkX, bkY); bkY += 11;
    doc.text(`A/c No: ${COMPANY.accountNo}`, bkX, bkY); bkY += 11;
    doc.text(`IFSC: ${COMPANY.ifsc}`, bkX, bkY);

    const tmX = ML + panelW + 16;
    let tmY = y + 8;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(C.navy)
      .text('TERMS & CONDITIONS', tmX, tmY);
    tmY += 12;
    doc.font('Helvetica').fontSize(7.5).fillColor(C.black);
    const payTerms = invoice.client?.paymentTermsDays ?? 15;
    doc.text(`HSN/SAC Code: ${COMPANY.hsnsac}`, tmX, tmY); tmY += 11;
    doc.text('Payment under Reverse Charge: YES', tmX, tmY); tmY += 11;
    doc.text(`Payment Terms: ${payTerms} days from invoice date`, tmX, tmY); tmY += 11;
    doc.text('Interest @ 18% p.a. on overdue payments', tmX, tmY);

    y += panelH + 16;

    // ═══════════════════════════════════════════
    // 7. SIGNATURE AREA
    // ═══════════════════════════════════════════
    doc.font('Helvetica').fontSize(8).fillColor(C.gray)
      .text('E. & O.E.', ML, y);

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
    // 8. FOOTER BARS
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
