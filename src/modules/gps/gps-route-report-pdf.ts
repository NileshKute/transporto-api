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
  gst: '27AWCPK8573C1ZG',
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
  green: '#16a34a',
  red: '#dc2626',
};

const TARGET_TEMP_MAX_C = 10;
const MAX_SEGMENT_KM = 5;
const HALT_RADIUS_KM = 0.1;
const OVERSPEED_KMH = 60;
const MIN_HALT_MINUTES = 2;

const ML = 40;
const MR = 40;
const PW = 595.28;
const CW = PW - ML - MR;
const PAGE_BOTTOM = 780;

export interface RouteReportPoint {
  latitude: number;
  longitude: number;
  speed: number;
  temperature: number | null;
  status: string;
  location: string | null;
  recordedAt: Date;
}

export interface RouteReportVehicle {
  regNumber: string;
  make: string;
  model: string;
  type: string;
  iconType: string;
}

export interface HaltEventRow {
  start: Date;
  end: Date;
  durationMin: number;
  location: string;
}

export interface SpeedViolationRow {
  time: Date;
  speed: number;
  location: string;
}

export interface TempLogRow {
  time: Date;
  location: string;
  temp: number;
  ok: boolean;
}

export interface RouteReportStats {
  totalDistanceKm: number;
  durationMs: number;
  maxSpeed: number;
  avgSpeed: number;
  stopCount: number;
  minTemp: number | null;
  maxTemp: number | null;
  avgTemp: number | null;
  compliancePct: number;
  compliant: boolean;
  timeInRangePct: number;
  timeOutRangePct: number;
  haltEvents: HaltEventRow[];
  speedViolations: SpeedViolationRow[];
  tempLogRows: TempLogRow[];
}

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isHalted(p: RouteReportPoint): boolean {
  return (
    p.status === 'HALTED' ||
    p.status === 'LONG_HALT' ||
    p.speed < 2
  );
}

function isValidTemp(t: number | null | undefined): t is number {
  return t != null && !Number.isNaN(t) && t !== 0;
}

function isMovingForAvg(p: RouteReportPoint): boolean {
  if (p.status === 'OFFLINE') return false;
  return !(
    p.status === 'HALTED' ||
    p.status === 'LONG_HALT' ||
    p.speed < 2
  );
}

export function computeRouteReportStats(
  points: RouteReportPoint[],
): RouteReportStats {
  const n = points.length;
  let totalDistanceKm = 0;
  for (let i = 0; i < n - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const d = haversineKm(a.latitude, a.longitude, b.latitude, b.longitude);
    if (d <= MAX_SEGMENT_KM) {
      totalDistanceKm += d;
    }
  }

  const first = points[0].recordedAt.getTime();
  const last = points[n - 1].recordedAt.getTime();
  const durationMs = Math.max(0, last - first);

  const speeds = points.map((p) => p.speed);
  const maxSpeed = speeds.length ? Math.max(...speeds) : 0;
  const movingPts = points.filter(isMovingForAvg);
  const avgSpeed =
    movingPts.length > 0
      ? movingPts.reduce((s, p) => s + p.speed, 0) / movingPts.length
      : 0;

  const haltClusters: { start: number; end: number }[] = [];
  let i = 0;
  while (i < n) {
    if (!isHalted(points[i])) {
      i++;
      continue;
    }
    const startIdx = i;
    const anchor = points[startIdx];
    i++;
    while (i < n && isHalted(points[i])) {
      const dist = haversineKm(
        anchor.latitude,
        anchor.longitude,
        points[i].latitude,
        points[i].longitude,
      );
      if (dist <= HALT_RADIUS_KM) {
        i++;
      } else {
        break;
      }
    }
    const endIdx = i - 1;
    haltClusters.push({ start: startIdx, end: endIdx });
  }

  const stopCount = haltClusters.length;

  const haltEvents: HaltEventRow[] = [];
  for (const c of haltClusters) {
    const s = points[c.start].recordedAt.getTime();
    const e = points[c.end].recordedAt.getTime();
    const durationMin = (e - s) / 60000;
    if (durationMin >= MIN_HALT_MINUTES) {
      haltEvents.push({
        start: points[c.start].recordedAt,
        end: points[c.end].recordedAt,
        durationMin: Math.round(durationMin),
        location: points[c.start].location || '—',
      });
    }
  }

  const speedViolations: SpeedViolationRow[] = [];
  let j = 0;
  while (j < n) {
    if (points[j].speed <= OVERSPEED_KMH) {
      j++;
      continue;
    }
    const t0 = points[j].recordedAt;
    let maxSp = points[j].speed;
    const loc = points[j].location || '—';
    j++;
    while (j < n && points[j].speed > OVERSPEED_KMH) {
      maxSp = Math.max(maxSp, points[j].speed);
      j++;
    }
    speedViolations.push({ time: t0, speed: Math.round(maxSp), location: loc });
  }

  const validTemps = points
    .map((p) => p.temperature)
    .filter((t): t is number => isValidTemp(t));
  let minTemp: number | null = null;
  let maxTemp: number | null = null;
  let avgTemp: number | null = null;
  if (validTemps.length > 0) {
    minTemp = Math.min(...validTemps);
    maxTemp = Math.max(...validTemps);
    avgTemp =
      validTemps.reduce((a, b) => a + b, 0) / validTemps.length;
  }

  const inRange = validTemps.filter((t) => t <= TARGET_TEMP_MAX_C).length;
  const compliancePct =
    validTemps.length > 0 ? (inRange / validTemps.length) * 100 : 100;
  const compliant = compliancePct >= 90;
  const timeInRangePct = compliancePct;
  const timeOutRangePct = validTemps.length > 0 ? 100 - timeInRangePct : 0;

  const tempLogRows = sampleTempLog(points);

  return {
    totalDistanceKm,
    durationMs,
    maxSpeed,
    avgSpeed,
    stopCount,
    minTemp,
    maxTemp,
    avgTemp,
    compliancePct,
    compliant,
    timeInRangePct,
    timeOutRangePct,
    haltEvents,
    speedViolations,
    tempLogRows,
  };
}

function sampleTempLog(points: RouteReportPoint[]): TempLogRow[] {
  if (points.length === 0) return [];
  const dateStr = points[0].recordedAt.toISOString().slice(0, 10);
  const dayStart = new Date(`${dateStr}T00:00:00.000Z`).getTime();
  const rows: TempLogRow[] = [];
  const fifteen = 15 * 60 * 1000;

  for (let slot = 0; slot < 96; slot++) {
    const wStart = dayStart + slot * fifteen;
    const wEnd = wStart + fifteen;
    const center = wStart + fifteen / 2;
    const inWin = points.filter((p) => {
      const t = p.recordedAt.getTime();
      return t >= wStart && t < wEnd;
    });
    if (inWin.length === 0) continue;
    let best = inWin[0];
    let bestD = Math.abs(best.recordedAt.getTime() - center);
    for (const p of inWin) {
      const d = Math.abs(p.recordedAt.getTime() - center);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (!isValidTemp(best.temperature)) continue;
    rows.push({
      time: best.recordedAt,
      location: (best.location || '—').slice(0, 36),
      temp: best.temperature as number,
      ok: (best.temperature as number) <= TARGET_TEMP_MAX_C,
    });
  }
  return rows;
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function fmtDateLong(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00.000Z`);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function fmtDuration(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function resolveSignaturePath(): string | null {
  const names = ['signature.png', 'signature.jpeg', 'signature.jpg'];
  const roots = [
    path.join(process.cwd(), 'src', 'assets'),
    path.join(__dirname, '..', '..', 'assets'),
    path.join(process.cwd(), 'assets'),
  ];
  for (const root of roots) {
    for (const name of names) {
      const p = path.join(root, name);
      try {
        if (fs.existsSync(p)) return p;
      } catch {
        /* skip */
      }
    }
  }
  return null;
}

function ensureSpace(
  doc: InstanceType<typeof PDFDocument>,
  y: number,
  need: number,
): number {
  if (y + need > PAGE_BOTTOM) {
    doc.addPage();
    return 40;
  }
  return y;
}

export function buildColdChainRouteReportPdf(params: {
  vehicle: RouteReportVehicle;
  stats: RouteReportStats;
  date: string;
  clientName?: string;
  points: RouteReportPoint[];
}): Promise<Buffer> {
  const { vehicle, stats, date, clientName } = params;
  const points = params.points;
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
  doc.fontSize(7)
    .text(`Mob: ${COMPANY.mobile}  |  Email: ${COMPANY.email}  |  Web: ${COMPANY.web}`, infoX, contactY, { width: 300 });
  doc.text(`GSTIN: ${COMPANY.gst}`, infoX, contactY + 10, { width: 300 });

  y = contactY + 24;
  doc.save();
  doc.lineWidth(1.5).strokeColor(C.navy).moveTo(ML, y).lineTo(PW - MR, y).stroke();
  doc.restore();
  y += 10;

  doc.fillColor(C.navy).font('Helvetica-Bold').fontSize(18)
    .text('COLD CHAIN DELIVERY REPORT', ML, y, { width: CW, align: 'center' });
  y += 28;
  doc.save();
  doc.lineWidth(1).strokeColor(C.border).moveTo(ML, y).lineTo(PW - MR, y).stroke();
  doc.restore();
  y += 12;

  const vehLabel = `${vehicle.regNumber} (${[vehicle.make, vehicle.model].filter(Boolean).join(' ').trim() || '—'})`;

  const section = (title: string) => {
    y = ensureSpace(doc, y, 28);
    doc.fillColor(C.royal).font('Helvetica-Bold').fontSize(12).text(title, ML, y);
    y += 16;
  };

  const drawKeyValTable = (rows: [string, string][]) => {
    const rowH = 18;
    const colW = CW / 2;
    y = ensureSpace(doc, y, rows.length * rowH + 8);
    doc.save();
    doc.rect(ML, y, CW, rows.length * rowH).strokeColor(C.border).lineWidth(0.5).stroke();
    doc.restore();
    let ry = y;
    rows.forEach(([k, v], idx) => {
      if (idx % 2 === 1) {
        doc.save();
        doc.rect(ML, ry, CW, rowH).fill(C.bg);
        doc.restore();
      }
      doc.font('Helvetica-Bold').fontSize(9).fillColor(C.navy).text(k, ML + 8, ry + 5, { width: colW - 16 });
      doc.font('Helvetica').fontSize(9).fillColor('#1A1A1A').text(v, ML + colW, ry + 5, { width: colW - 16 });
      doc.save();
      doc.moveTo(ML + colW, ry).lineTo(ML + colW, ry + rowH).strokeColor(C.border).lineWidth(0.3).stroke();
      doc.restore();
      ry += rowH;
    });
    y = ry + 10;
  };

  section('TRIP DETAILS');
  drawKeyValTable([
    ['Vehicle', vehLabel.toUpperCase()],
    ['Date', fmtDateLong(date)],
    ['Client', clientName || '—'],
    ['Start Time', fmtTime(points[0].recordedAt)],
    ['End Time', fmtTime(points[points.length - 1].recordedAt)],
    ['Duration', fmtDuration(stats.durationMs)],
  ]);

  section('ROUTE SUMMARY');
  const sumRowH = 22;
  y = ensureSpace(doc, y, sumRowH + 24);
  const w4 = CW / 4;
  doc.save();
  doc.rect(ML, y, CW, sumRowH).fill(C.navy);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(C.white);
  ['Distance', 'Max Speed', 'Avg Speed', 'Stops'].forEach((h, idx) => {
    doc.text(h, ML + idx * w4 + 4, y + 7, { width: w4 - 8, align: 'center' });
  });
  doc.restore();
  y += sumRowH;
  doc.save();
  doc.rect(ML, y, CW, sumRowH).strokeColor(C.border).lineWidth(0.5).stroke();
  doc.restore();
  doc.font('Helvetica').fontSize(9).fillColor(C.navy);
  doc.text(`${stats.totalDistanceKm.toFixed(1)} km`, ML + 4, y + 7, { width: w4 - 8, align: 'center' });
  doc.text(`${Math.round(stats.maxSpeed)} km/h`, ML + w4 + 4, y + 7, { width: w4 - 8, align: 'center' });
  doc.text(`${Math.round(stats.avgSpeed)} km/h`, ML + 2 * w4 + 4, y + 7, { width: w4 - 8, align: 'center' });
  doc.text(String(stats.stopCount), ML + 3 * w4 + 4, y + 7, { width: w4 - 8, align: 'center' });
  y += sumRowH + 14;

  section('TEMPERATURE COMPLIANCE');
  y = ensureSpace(doc, y, 70);
  const compColor = stats.compliant ? C.green : C.red;
  const compLabel = stats.compliant ? 'COMPLIANT' : 'NON-COMPLIANT';
  doc.save();
  doc.rect(ML, y, CW, 62).fill(C.bg).strokeColor(C.border).lineWidth(0.5).stroke();
  doc.restore();
  doc.font('Helvetica-Bold').fontSize(11).fillColor(C.navy).text('Status: ', ML + 10, y + 8, { continued: true });
  doc.fillColor(compColor).text(compLabel);
  doc.font('Helvetica').fontSize(9).fillColor(C.navy);
  const minT = stats.minTemp != null ? `${stats.minTemp.toFixed(1)}°C` : '—';
  const maxT = stats.maxTemp != null ? `${stats.maxTemp.toFixed(1)}°C` : '—';
  const avgT = stats.avgTemp != null ? `${stats.avgTemp.toFixed(1)}°C` : '—';
  doc.text(`Min Temp: ${minT}  |  Max Temp: ${maxT}`, ML + 10, y + 26);
  doc.text(`Avg Temp: ${avgT}  |  Target: At or below ${TARGET_TEMP_MAX_C}°C`, ML + 10, y + 40);
  doc.text(
    `Time in Range: ${stats.timeInRangePct.toFixed(0)}%  |  Time Out of Range: ${stats.timeOutRangePct.toFixed(0)}%`,
    ML + 10,
    y + 52,
  );
  y += 72;

  section('TEMPERATURE LOG (sampled every 15 minutes)');
  const tCols = [50, 200, 60, 40];
  const tHeaders = ['Time', 'Location', 'Temp°C', 'OK'];
  const tRowH = 16;
  const drawTableHeader = (headers: string[], widths: number[]) => {
    y = ensureSpace(doc, y, tRowH + 4);
    doc.save();
    doc.rect(ML, y, CW, tRowH).fill(C.navy);
    doc.restore();
    let cx = ML;
    headers.forEach((h, idx) => {
      doc.font('Helvetica-Bold').fontSize(8).fillColor(C.white)
        .text(h, cx + 4, y + 5, { width: widths[idx] - 8 });
      cx += widths[idx];
    });
    y += tRowH;
  };
  drawTableHeader(tHeaders, tCols);
  stats.tempLogRows.forEach((row, idx) => {
    y = ensureSpace(doc, y, tRowH);
    if (idx % 2 === 1) {
      doc.save();
      doc.rect(ML, y, CW, tRowH).fill(C.rowAlt);
      doc.restore();
    }
    doc.save();
    doc.rect(ML, y, CW, tRowH).strokeColor(C.border).lineWidth(0.2).stroke();
    doc.restore();
    let cx = ML;
    const vals = [
      fmtTime(row.time),
      row.location,
      row.temp.toFixed(1),
      row.ok ? 'OK' : '!',
    ];
    vals.forEach((cell, cidx) => {
      doc.font('Helvetica').fontSize(8)
        .fillColor(cidx === 3 ? (row.ok ? C.green : C.red) : C.navy)
        .text(cell, cx + 4, y + 4, { width: tCols[cidx] - 8 });
      cx += tCols[cidx];
    });
    y += tRowH;
  });
  y += 10;

  section('HALT POINTS');
  const hCols = [120, 60, CW - 180];
  drawTableHeader(['Time', 'Duration', 'Location'], hCols);
  if (stats.haltEvents.length === 0) {
    y = ensureSpace(doc, y, tRowH);
    doc.font('Helvetica').fontSize(8).fillColor(C.gray).text('No halts over 2 minutes recorded.', ML + 6, y + 4);
    y += tRowH + 6;
  } else {
    stats.haltEvents.forEach((h, idx) => {
      y = ensureSpace(doc, y, tRowH);
      if (idx % 2 === 1) {
        doc.save();
        doc.rect(ML, y, CW, tRowH).fill(C.rowAlt);
        doc.restore();
      }
      doc.save();
      doc.rect(ML, y, CW, tRowH).strokeColor(C.border).lineWidth(0.2).stroke();
      doc.restore();
      const timeStr = `${fmtTime(h.start)} - ${fmtTime(h.end)}`;
      doc.font('Helvetica').fontSize(8).fillColor(C.navy).text(timeStr, ML + 4, y + 4, { width: hCols[0] - 8 });
      doc.text(`${h.durationMin} min`, ML + hCols[0] + 4, y + 4, { width: hCols[1] - 8 });
      doc.text((h.location || '—').slice(0, 42), ML + hCols[0] + hCols[1] + 4, y + 4, { width: hCols[2] - 8 });
      y += tRowH;
    });
    y += 6;
  }

  section('SPEED VIOLATIONS (>60 km/h)');
  const sCols = [70, 70, CW - 140];
  drawTableHeader(['Time', 'Speed', 'Location'], sCols);
  if (stats.speedViolations.length === 0) {
    y = ensureSpace(doc, y, tRowH);
    doc.font('Helvetica').fontSize(8).fillColor(C.navy).text('No speed violations recorded.', ML + 6, y + 4);
    y += tRowH + 6;
  } else {
    stats.speedViolations.forEach((s, idx) => {
      y = ensureSpace(doc, y, tRowH);
      if (idx % 2 === 1) {
        doc.save();
        doc.rect(ML, y, CW, tRowH).fill(C.rowAlt);
        doc.restore();
      }
      doc.save();
      doc.rect(ML, y, CW, tRowH).strokeColor(C.border).lineWidth(0.2).stroke();
      doc.restore();
      doc.font('Helvetica').fontSize(8).fillColor(C.navy).text(fmtTime(s.time), ML + 4, y + 4, { width: sCols[0] - 8 });
      doc.fillColor(C.red).text(`${s.speed} km/h`, ML + sCols[0] + 4, y + 4, { width: sCols[1] - 8 });
      doc.fillColor(C.navy).text((s.location || '—').slice(0, 40), ML + sCols[0] + sCols[1] + 4, y + 4, { width: sCols[2] - 8 });
      y += tRowH;
    });
    y += 6;
  }

  y = ensureSpace(doc, y, 90);
  doc.save();
  doc.lineWidth(1).strokeColor(C.border).moveTo(ML, y).lineTo(PW - MR, y).stroke();
  doc.restore();
  y += 10;

  const sigPath = resolveSignaturePath();
  if (sigPath) {
    try {
      doc.image(sigPath, ML, y, { width: 100 });
      y += 55;
    } catch {
      y += 10;
    }
  } else {
    doc.font('Helvetica').fontSize(7).fillColor(C.gray).text('Signature: ___________________________', ML, y);
    y += 22;
  }

  doc.font('Helvetica').fontSize(7).fillColor(C.gray)
    .text('Generated by G K Enterprise Fleet Management System', ML, y, { width: CW, align: 'center' });
  y += 12;
  doc.text(
    `${COMPANY.web} | Report Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`,
    ML,
    y,
    { width: CW, align: 'center' },
  );
  y += 24;

  const pageH = doc.page.height;
  doc.save();
  doc.rect(0, pageH - 11, PW, 3).fill(C.ice);
  doc.rect(0, pageH - 8, PW, 8).fill(C.navy);
  doc.restore();

  doc.end();
  return done;
}
