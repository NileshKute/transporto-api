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
};

const C = {
  navy: '#0D2847',
  ice: '#42A5F5',
  white: '#FFFFFF',
  bg: '#F4F6F8',
  rowAlt: '#F8F9FA',
  border: '#E0E8F0',
  gray: '#6B7B8D',
  black: '#1A1A1A',
};

function fmt(n: number): string {
  return Math.round(n).toLocaleString('en-IN');
}

function fmtDate(d: Date | string | null | undefined): string {
  if (d == null) return '—';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '—';
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
    } catch {
      /* skip */
    }
  }
  return null;
}

const ML = 40;
const MR = 40;
const PW = 595.28;
/** A4 height (points); used for fixed footer/signature on page 1 */
const PAGE_H = 841.89;
const CW = PW - ML - MR;

@Injectable()
export class QuotationsPdfService {
  async generate(quotation: Record<string, unknown>): Promise<Buffer> {
    const lineItems = (quotation.lineItems as Record<string, unknown>[]) || [];
    const client = quotation.client as Record<string, unknown> | null;

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 30, bottom: 92, left: ML, right: MR },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    let y = 30;

    doc.save();
    doc.rect(0, 0, PW, 8).fill(C.navy);
    doc.rect(0, 8, PW, 3).fill(C.ice);
    doc.restore();

    y = 20;
    const monoX = ML;
    const monoY = y;
    const monoSize = 35;

    doc.save();
    doc.roundedRect(monoX, monoY, monoSize, monoSize, 5).fill(C.navy);
    doc.font('Helvetica-Bold').fontSize(18);
    doc.fillColor(C.white).text('G', monoX + 3, monoY + 6, { width: 16 });
    doc.fillColor(C.ice).text('K', monoX + 17, monoY + 6, { width: 16 });
    doc.restore();

    const infoX = monoX + monoSize + 10;
    doc.fillColor(C.navy).font('Helvetica-Bold').fontSize(16).text(COMPANY.name, infoX, monoY + 1);
    doc.fillColor(C.gray).font('Helvetica').fontSize(8).text(COMPANY.type, infoX, monoY + 19);
    doc.fontSize(7).fillColor(C.gray).text(COMPANY.address, infoX, monoY + 30, { width: 280 });

    const contactY = monoY + 46;
    doc.fontSize(7).fillColor(C.gray).text(
      `Mob: ${COMPANY.mobile}  |  Email: ${COMPANY.email}  |  Web: ${COMPANY.web}`,
      infoX,
      contactY,
      { width: 300 },
    );

    const rightX = PW - MR;
    doc.fillColor(C.navy).font('Helvetica-Bold').fontSize(14).text('QUOTATION', rightX - 140, monoY + 1, {
      width: 140,
      align: 'right',
    });
    doc.fillColor(C.gray).font('Helvetica').fontSize(8).text(`GSTIN: ${COMPANY.gst}`, rightX - 140, monoY + 19, {
      width: 140,
      align: 'right',
    });
    doc.text(`PAN: ${COMPANY.pan}`, rightX - 140, monoY + 30, { width: 140, align: 'right' });

    y = contactY + 16;
    doc.save();
    doc.lineWidth(1.5).strokeColor(C.navy).moveTo(ML, y).lineTo(PW - MR, y).stroke();
    doc.restore();
    y += 8;

    const billH = 62;
    doc.save();
    doc.rect(ML, y, CW, billH).fill(C.bg);
    doc.restore();

    const billPad = 10;
    const bY = y + billPad;
    const displayName = String(quotation.clientName || client?.name || '—');
    const attn = quotation.attnPerson != null ? String(quotation.attnPerson) : '';
    const subject = quotation.subject != null ? String(quotation.subject) : '';

    doc.fillColor(C.navy).font('Helvetica-Bold').fontSize(9).text('Quote No:', ML + billPad, bY, { continued: true })
      .font('Helvetica').text(`  ${quotation.quoteNumber || '—'}`);
    doc.font('Helvetica-Bold').text('Quote Date:', ML + billPad, bY + 14, { continued: true })
      .font('Helvetica').text(`  ${fmtDate(quotation.quoteDate as Date)}`);
    doc.font('Helvetica-Bold').text('Valid Until:', ML + billPad, bY + 28, { continued: true })
      .font('Helvetica').text(`  ${fmtDate(quotation.validUntil as Date)}`);
    doc.font('Helvetica-Bold').text('Validity (days):', ML + billPad, bY + 42, { continued: true })
      .font('Helvetica').text(`  ${quotation.validityDays ?? '—'}`);

    const clientX = ML + CW / 2 + 10;
    doc.fillColor(C.navy).font('Helvetica-Bold').fontSize(9).text('M/S:', clientX, bY, { continued: true })
      .font('Helvetica').text(`  ${displayName}`);
    if (attn) {
      doc.font('Helvetica-Bold').text('Attn:', clientX, bY + 14, { continued: true })
        .font('Helvetica').text(`  ${attn}`);
    }
    if (client && client.gstNumber) {
      doc.font('Helvetica-Bold').text('GSTIN:', clientX, bY + 28, { continued: true })
        .font('Helvetica').text(`  ${client.gstNumber}`);
    }
    if (subject) {
      doc.font('Helvetica').fontSize(7).fillColor(C.gray).text(`Subject: ${subject}`, clientX, bY + 42, {
        width: CW / 2 - 20,
      });
    }

    y += billH + 8;

    const vehicleTypeStr = String(quotation.vehicleType || '—');
    const capacityStr =
      quotation.loadingCapacityKg != null ? String(quotation.loadingCapacityKg) : '—';
    const temperatureStr =
      quotation.temperatureC != null ? String(quotation.temperatureC) : '—';
    const locsPdf = quotation.loadLocations as string[] | undefined;
    const locationsStr = locsPdf?.length ? locsPdf.join(', ') : '—';

    const vehicleSummary = `Vehicle / service: ${vehicleTypeStr} | Loading capacity: ${capacityStr} kg | Temperature: ${temperatureStr} °C | Load locations: ${locationsStr}`;

    doc.fontSize(11).font('Helvetica-Bold').fillColor('#0D2847');
    const vehicleBlockH = doc.heightOfString(vehicleSummary, { width: CW });
    doc.text(vehicleSummary, ML, y, { width: CW, align: 'left' });
    y += vehicleBlockH + 8;

    const cols = [
      { label: 'Sr', w: 28, align: 'center' as const },
      { label: 'Vehicle / Description', w: 200, align: 'left' as const },
      { label: 'Fixed KM', w: 52, align: 'right' as const },
      { label: 'Fixed ₹', w: 72, align: 'right' as const },
      { label: 'Add. / KM ₹', w: CW - 28 - 200 - 52 - 72, align: 'right' as const },
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

    let subtotal = 0;
    lineItems.forEach((item, idx) => {
      if (idx % 2 === 1) {
        doc.save();
        doc.rect(ML, y, CW, rowH).fill(C.rowAlt);
        doc.restore();
      }
      const fixed = Number(item.fixedCharges ?? 0) || 0;
      subtotal += fixed;
      const vals = [
        String(item.srNo ?? idx + 1),
        String(item.description ?? ''),
        item.fixedKm != null ? String(item.fixedKm) : '—',
        fmt(fixed),
        item.additionalCost != null ? fmt(Number(item.additionalCost)) : '—',
      ];
      cx = ML;
      doc.fillColor(C.black);
      vals.forEach((v, i) => {
        const col = cols[i];
        const pad = col.align === 'left' ? 6 : 0;
        const rpad = col.align === 'right' ? 6 : 0;
        doc.text(v, cx + pad, y + 5, { width: col.w - pad - rpad, align: col.align });
        cx += col.w;
      });
      doc.save();
      doc.lineWidth(0.5).strokeColor(C.border).moveTo(ML, y + rowH).lineTo(ML + CW, y + rowH).stroke();
      doc.restore();
      y += rowH;
    });

    if (lineItems.length === 0 && quotation.monthlyRate != null) {
      subtotal = Number(quotation.monthlyRate) || 0;
      doc.text(`Monthly rate (summary): ₹ ${fmt(subtotal)}`, ML + 6, y + 6, { width: CW - 12 });
      y += rowH;
    }

    doc.save();
    doc.lineWidth(1).strokeColor(C.navy).moveTo(ML, y).lineTo(ML + CW, y).stroke();
    doc.restore();
    y += 8;

    /** Bottom of table + divider — left column reference */
    const leftEndY = y;

    const totLabelX = PW - MR - 200;
    const totValX = PW - MR - 90;
    const totValW = 90;
    const monthly = quotation.monthlyRate != null ? Number(quotation.monthlyRate) : null;
    const totalDisplay = monthly != null && monthly > subtotal ? monthly : subtotal;

    const totalRowY = y;
    doc.font('Helvetica-Bold').fontSize(11).fillColor(C.navy);
    doc.text('Total monthly (quoted):', totLabelX, totalRowY, { width: 120, align: 'right' });
    doc.text(`₹ ${fmt(totalDisplay)}`, totValX, totalRowY, { width: totValW, align: 'right' });
    const totalLineH = doc.heightOfString(`₹ ${fmt(totalDisplay)}`, { width: totValW });
    const totalEndY = totalRowY + Math.max(totalLineH, 14) + 4;

    const termsStartY = Math.max(totalEndY, leftEndY + Math.max(totalLineH, 14) + 4) + 10;
    y = termsStartY;

    const terms =
      (quotation.termsAndConditions as string) ||
      'This quotation is subject to our standard terms of service and availability of vehicles.';
    const termLines = terms
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const linesToRender = termLines.length ? termLines : [terms.trim() || terms];

    for (const termsLine of linesToRender) {
      doc.fontSize(11).font('Helvetica').fillColor('#0D2847').text(termsLine, ML, y, {
        width: CW,
        align: 'left',
      });
      y = doc.y + 4;
    }

    const termsBottomY = Math.max(y, doc.y);

    const footerBand = 11;
    const signatureReserve = 88;
    const sigBlockX = PW - MR - 140;
    const desiredSigTop = PAGE_H - 120;
    let sigY = Math.max(termsBottomY + 15, desiredSigTop);
    const sigCeiling = PAGE_H - footerBand - signatureReserve;
    if (sigY > sigCeiling) sigY = sigCeiling;
    if (sigY < termsBottomY + 8) sigY = termsBottomY + 8;

    doc.font('Helvetica').fontSize(8).fillColor(C.gray).text('E. & O.E.', ML, sigY);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(C.navy).text('For G K ENTERPRISE', sigBlockX, sigY, {
      width: 140,
      align: 'center',
    });
    let sigCursorY = sigY + 14;

    const sigImgPath = resolveSignaturePath();
    if (sigImgPath) {
      try {
        doc.image(sigImgPath, sigBlockX + 40, sigCursorY, { width: 60, height: 40 });
      } catch {
        doc.font('Helvetica-Oblique').fontSize(10).fillColor(C.gray).text('Sd/-', sigBlockX, sigCursorY + 10, {
          width: 140,
          align: 'center',
        });
      }
    } else {
      doc.font('Helvetica-Oblique').fontSize(10).fillColor(C.gray).text('Sd/-', sigBlockX, sigCursorY + 10, {
        width: 140,
        align: 'center',
      });
    }
    sigCursorY += 44;

    doc.save();
    doc.lineWidth(0.5).strokeColor(C.gray).moveTo(sigBlockX, sigCursorY).lineTo(PW - MR, sigCursorY).stroke();
    doc.restore();
    sigCursorY += 4;
    doc.font('Helvetica').fontSize(7.5).fillColor(C.gray).text('Proprietor', sigBlockX, sigCursorY, { width: 140, align: 'center' });

    doc.save();
    doc.rect(0, PAGE_H - 11, PW, 3).fill(C.ice);
    doc.rect(0, PAGE_H - 8, PW, 8).fill(C.navy);
    doc.restore();

    doc.font('Helvetica').fontSize(7).fillColor(C.white).text(
      `${COMPANY.mobile}  |  ${COMPANY.email}  |  ${COMPANY.web}`,
      ML,
      PAGE_H - 6,
      { width: CW, align: 'center' },
    );

    doc.end();
    return done;
  }
}
