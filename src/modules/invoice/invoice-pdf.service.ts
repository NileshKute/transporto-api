import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';

const COMPANY = {
  name: 'G K ENTERPRISE',
  type: 'FLEET OWNERS & TRANSPORT CONTRACTORS',
  address: 'Office 402, SHREE GANESH CHS LTD, PLOT NO 151 PHASE 11, NAVDE, TALOJA, PANVEL, NAVI MUMBAI 410208',
  proprietor: 'Ganesh Kute',
  mobile: '9324540988',
  email: 'ganesh@gkenterprise.in',
  pan: 'AWCPK8573C',
  gst: '27AWCPK8573C1ZG',
  bank: 'IDBI BANK',
  branch: 'KAMOTHE NAVI MUMBAI',
  accountNo: '1043102000008549',
  ifsc: 'IBKL0001043',
  hsnsac: '996511',
};

function formatIndianNumber(n: number): string {
  const s = Math.round(n).toString();
  if (s.length <= 3) return s;
  const lastThree = s.slice(-3);
  const rest = s.slice(0, -3);
  const withComma = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return withComma + ',' + lastThree;
}

function formatDate(d: Date): string {
  const x = new Date(d);
  const day = String(x.getDate()).padStart(2, '0');
  const month = String(x.getMonth() + 1).padStart(2, '0');
  const year = x.getFullYear();
  return `${day}/${month}/${year}`;
}

@Injectable()
export class InvoicePdfService {
  private uploadsDir: string;

  constructor() {
    this.uploadsDir = path.join(process.cwd(), 'uploads', 'invoices');
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  async generate(invoice: any): Promise<{ path: string; url: string }> {
    const client = invoice.client;
    const lineItems = invoice.lineItems || [];
    const deductions = invoice.deductions || [];
    const safeNumber = (invoice.invoiceNumber || '').replace(/\//g, '-');
    const filename = `invoice-${safeNumber}.pdf`;
    const filePath = path.join(this.uploadsDir, filename);

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    const pageWidth = 595.28;
    const col = (x: number) => 40 + x;

    // Header
    doc.fontSize(18).font('Helvetica-Bold').text(COMPANY.name, 40, 40, { align: 'center', width: pageWidth - 80 });
    doc.fontSize(10).font('Helvetica').text(COMPANY.type, 40, 60, { align: 'center', width: pageWidth - 80 });
    doc.fontSize(9).text(COMPANY.address, 40, 76, { align: 'center', width: pageWidth - 80 });
    doc.text(`Mob: ${COMPANY.mobile}  |  ${COMPANY.email}`, 40, 92, { align: 'center', width: pageWidth - 80 });
    doc.text(`GSTIN: ${COMPANY.gst}  |  PAN: ${COMPANY.pan}`, 40, 104, { align: 'center', width: pageWidth - 80 });

    doc.moveDown();
    doc.moveTo(40, 125).lineTo(pageWidth - 40, 125).stroke();
    doc.moveDown(0.5);

    // Bill details
    doc.fontSize(10).font('Helvetica-Bold').text(`Bill No: ${invoice.invoiceNumber}`, 40, 132);
    doc.font('Helvetica').text(`Date: ${formatDate(invoice.issueDate)}`, pageWidth - 140, 132);
    doc.font('Helvetica').text(`M/S: ${client?.name || ''}`, 40, 148);
    doc.text(`GSTIN: ${client?.gstNumber || 'N/A'}`, 40, 160);

    doc.moveDown(0.5);
    doc.moveTo(40, 178).lineTo(pageWidth - 40, 178).stroke();

    // Table header
    const tableTop = 188;
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('Sr', col(0), tableTop, { width: 18 });
    doc.text('Veh No', col(20), tableTop, { width: 68 });
    doc.text('Particulars', col(90), tableTop, { width: 120 });
    doc.text('Trip', col(212), tableTop, { width: 28 });
    doc.text('Days', col(242), tableTop, { width: 38 });
    doc.text('Rate', col(282), tableTop, { width: 48 });
    doc.text('Amount', col(332), tableTop, { width: 80 });

    doc.moveTo(40, tableTop + 14).lineTo(pageWidth - 40, tableTop + 14).stroke();

    let y = tableTop + 20;
    doc.font('Helvetica');

    lineItems.forEach((item: any, idx: number) => {
      const sr = idx + 1;
      const veh = (item.vehicleRegNumber || '').toString();
      const desc = (item.description || '').toString().slice(0, 28);
      const trip = item.billingType === 'ADHOC' ? String(item.tripCount ?? 0) : '-';
      const days = item.daysCount != null ? String(Number(item.daysCount)) : '-';
      const rate = formatIndianNumber(Number(item.rate ?? 0));
      const amt = formatIndianNumber(Number(item.amount ?? 0));

      doc.fontSize(9).text(String(sr), col(0), y, { width: 18 });
      doc.text(veh, col(20), y, { width: 68 });
      doc.text(desc, col(90), y, { width: 120 });
      doc.text(trip, col(212), y, { width: 28 });
      doc.text(days, col(242), y, { width: 38 });
      doc.text(rate, col(282), y, { width: 48 });
      doc.text(amt, col(332), y, { width: 80 });
      y += 18;
    });

    doc.moveTo(40, y).lineTo(pageWidth - 40, y).stroke();
    y += 12;

    const subtotal = Number(invoice.subtotal ?? 0);
    const totalDeductions = Number(invoice.totalDeductions ?? 0);
    const totalAmount = Number(invoice.totalAmount ?? 0);

    doc.text(`Subtotal:`, pageWidth - 220, y);
    doc.text(formatIndianNumber(subtotal), pageWidth - 120, y, { width: 80 });
    y += 16;

    deductions.forEach((d: any) => {
      doc.text(`${(d.description || '').toString()}:`, pageWidth - 220, y);
      doc.text(`-${formatIndianNumber(Number(d.amount ?? 0))}`, pageWidth - 120, y, { width: 80 });
      y += 14;
    });

    doc.font('Helvetica-Bold');
    doc.text(`TOTAL:`, pageWidth - 220, y);
    doc.text(formatIndianNumber(totalAmount), pageWidth - 120, y, { width: 80 });
    y += 20;

    doc.moveTo(40, y).lineTo(pageWidth - 40, y).stroke();
    y += 10;

    doc.font('Helvetica').fontSize(9);
    const words = (invoice.amountInWords || '').toString();
    doc.text('Amount in words: ' + words, 40, y, { width: pageWidth - 80 });
    y += 24;

    doc.moveTo(40, y).lineTo(pageWidth - 40, y).stroke();
    y += 14;

    doc.fontSize(9).text(`Bank: ${COMPANY.bank}, ${COMPANY.branch}`, 40, y);
    y += 12;
    doc.text(`A/c: ${COMPANY.accountNo}  |  IFSC: ${COMPANY.ifsc}`, 40, y);
    y += 12;
    doc.text(`HSN/SAC: ${COMPANY.hsnsac}`, 40, y);
    y += 12;
    doc.text('Note: Payment under reverse charge', 40, y);
    y += 12;
    doc.text(`Terms: Payment within ${invoice.client?.paymentTermsDays ?? 15} days`, 40, y);
    y += 20;

    doc.moveTo(40, y).lineTo(pageWidth - 40, y).stroke();
    y += 14;

    doc.text('E&OE', 40, y);
    doc.text('For G K ENTERPRISE', pageWidth - 160, y);
    y += 12;
    doc.text('Proprietor', pageWidth - 160, y);

    doc.end();

    await new Promise<void>((resolve, reject) => {
      stream.on('finish', () => resolve());
      stream.on('error', reject);
    });

    const url = `/uploads/invoices/${filename}`;
    return { path: filePath, url };
  }
}
