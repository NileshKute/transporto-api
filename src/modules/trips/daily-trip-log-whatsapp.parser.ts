export const DAILY_TRIP_SPELLING: Record<string, string> = {
  zopto: 'Zepto',
  bilnkit: 'Blinkit',
  blinkit: 'Blinkit',
  swiggy: 'Swiggy',
  bigbasket: 'BigBasket',
  'big basket': 'BigBasket',
  amazon: 'Amazon',
  sintree: 'Sintree',
  palak: 'Palak',
  mullam: 'Mullam',
  mullamnayaduty: 'Mullam Naya Duty',
};

export interface ParsedDailyTripBlock {
  driverName: string;
  vehicleReg: string;
  trips: {
    fromLocation: string;
    toLocation: string;
    clientName?: string;
    notes?: string;
    tripType?: string;
  }[];
}

function applySpellingPhrase(s: string): string {
  let t = s;
  const keys = Object.keys(DAILY_TRIP_SPELLING).sort(
    (a, b) => b.length - a.length,
  );
  for (const k of keys) {
    const re = new RegExp(
      `\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
      'gi',
    );
    t = t.replace(re, DAILY_TRIP_SPELLING[k]);
  }
  return t;
}

function guessClient(toLocation: string): string | undefined {
  const lower = toLocation.toLowerCase();
  if (lower.includes('zepto')) return 'Zepto';
  if (lower.includes('swiggy')) return 'Swiggy';
  if (lower.includes('blinkit')) return 'Blinkit';
  if (lower.includes('big') && lower.includes('basket')) return 'BigBasket';
  if (lower.includes('amazon')) return 'Amazon';
  if (lower.includes('sintree')) return 'Sintree';
  return undefined;
}

function parseTripLine(line: string): ParsedDailyTripBlock['trips'][0] {
  const raw = applySpellingPhrase(line.trim());
  const m = raw.match(/^(.+?)\s+to\s+(.+)$/i);
  let from = '';
  let to = raw;
  if (m) {
    from = m[1].trim();
    to = m[2].trim();
  }
  from = applySpellingPhrase(from);
  to = applySpellingPhrase(to);

  let clientName = guessClient(to);
  let notes: string | undefined;
  if (to.includes('+')) {
    const [a, ...rest] = to.split('+').map((x) => x.trim());
    to = a;
    notes = rest.join(' + ').trim() || undefined;
    clientName = guessClient(to) || clientName;
  }

  return {
    fromLocation: from,
    toLocation: to,
    clientName,
    notes,
    tripType: 'DELIVERY',
  };
}

function parseColdLine(line: string): ParsedDailyTripBlock['trips'][0] {
  const base = applySpellingPhrase(
    line.replace(/\s+cold\s*$/i, '').trim(),
  );
  const label = `${base} Cold`;
  return {
    fromLocation: 'Palak',
    toLocation: label,
    clientName: base.split(/\s+/)[0] || base,
    tripType: 'COLD',
  };
}

const VEHICLE_RE = /MH\s*\d{2}\s*[A-Z]{2}\s*\d{4}/i;

export function normalizeDailyTripVehicleReg(line: string): string {
  const m = line.match(VEHICLE_RE);
  if (!m) return '';
  return m[0].replace(/\s+/g, '').toUpperCase();
}

/**
 * Detect multi-driver daily trip log: first line date DD/M/YYYY, body has MH reg + "to" trips.
 */
export function tryParseDailyTripLogMessage(body: string): {
  type: 'DAILY_TRIP_LOG';
  parsedData: { dateIso: string; blocks: ParsedDailyTripBlock[] };
  confidence: number;
} | null {
  const trimmed = (body || '').trim();
  if (trimmed.length < 20) return null;
  if (!VEHICLE_RE.test(trimmed)) return null;

  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 3) return null;

  const dateMatch = lines[0].match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/);
  if (!dateMatch) return null;

  const d0 = parseInt(dateMatch[1], 10);
  const m0 = parseInt(dateMatch[2], 10);
  const y0 = parseInt(dateMatch[3], 10);
  if (m0 < 1 || m0 > 12 || d0 < 1 || d0 > 31) return null;
  const dateIso = `${y0}-${String(m0).padStart(2, '0')}-${String(d0).padStart(2, '0')}`;

  const blocks: ParsedDailyTripBlock[] = [];
  let currentDriver: string | null = null;
  let currentTrips: ParsedDailyTripBlock['trips'] = [];

  const flushBlock = (vehicleLine: string) => {
    const vehicleReg = normalizeDailyTripVehicleReg(vehicleLine);
    if (currentDriver && vehicleReg && currentTrips.length > 0) {
      blocks.push({
        driverName: currentDriver,
        vehicleReg,
        trips: [...currentTrips],
      });
    }
    currentTrips = [];
    currentDriver = null;
  };

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    if (VEHICLE_RE.test(line)) {
      flushBlock(line);
      continue;
    }

    const numDriver = line.match(/^\d+[\.)]\s*(.+)$/i);
    if (numDriver) {
      const rest = numDriver[1].trim();
      const segs = rest.split(/\s*-{2,}\s*|\s*—\s*/).map((s) => s.trim());
      const nameRaw = segs[0] || rest;
      currentDriver = nameRaw.replace(/^[\d.\)\s]+/g, '').trim() || nameRaw;
      const tail = segs.slice(1).join(' ').trim();
      if (tail && /\bto\b/i.test(tail)) {
        currentTrips.push(parseTripLine(tail));
      }
      continue;
    }

    if (/\bcold\b/i.test(line) && !/\bto\b/i.test(line)) {
      currentTrips.push(parseColdLine(line));
      continue;
    }

    if (/\bto\b/i.test(line)) {
      currentTrips.push(parseTripLine(line));
    }
  }

  if (blocks.length === 0) return null;

  const hasToKeyword = /\bto\b/i.test(trimmed);
  if (!hasToKeyword && blocks.every((b) => b.trips.every((t) => !t.toLocation)))
    return null;

  return {
    type: 'DAILY_TRIP_LOG',
    parsedData: { dateIso, blocks },
    confidence: 0.88,
  };
}
