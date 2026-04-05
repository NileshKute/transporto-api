/**
 * Credit = increases net owed to driver. Debit = reduces it (advances, deductions, etc.).
 * Net outstanding = credits − debits (positive → company owes driver; negative → driver owes company).
 */

export type LedgerEntryLike = {
  type: string;
  amount?: unknown;
  category?: string | null;
  description?: string | null;
  isCredit?: boolean | null;
};

const CREDIT_TYPES = new Set([
  'EXTRA_DUTY',
  'BONUS',
  'ALLOWANCE',
  'SALARY',
]);

const DEBIT_TYPES = new Set([
  'ADVANCE',
  'ADVANCE_RECOVERY',
  'PENALTY',
  'FOOD',
  'FUEL_ADVANCE',
  'TOLL',
  'MAINTENANCE',
]);

export function classifyLedgerSide(entry: LedgerEntryLike): 'credit' | 'debit' {
  const type = (entry.type || '').toString().toUpperCase().trim();
  const text = `${entry.category ?? ''} ${entry.description ?? ''}`.toLowerCase();
  const amt = Number(entry.amount);

  if (
    type === 'OTHER' ||
    type === 'OTHER_CREDIT' ||
    type === 'OTHER_DEBIT'
  ) {
    if (text.includes('salary against advance')) return 'debit';
    if (type === 'OTHER_CREDIT' || /\bother credit\b/.test(text)) return 'credit';
    if (type === 'OTHER_DEBIT' || /\bother debit\b/.test(text)) return 'debit';
    if (entry.isCredit === true) return 'credit';
    if (entry.isCredit === false) return 'debit';
    return !Number.isNaN(amt) && amt >= 0 ? 'credit' : 'debit';
  }

  if (CREDIT_TYPES.has(type)) return 'credit';
  if (DEBIT_TYPES.has(type)) return 'debit';

  if (!Number.isNaN(amt) && amt < 0) return 'debit';
  return 'credit';
}

/** Map UI / legacy labels to Prisma `LedgerEntryType`. */
export function normalizeLedgerCreateType(dto: {
  type?: string;
  category?: string;
  description?: string;
}): string {
  const raw = (dto.type || '').toString().toUpperCase().trim();
  const text = `${dto.category ?? ''} ${dto.description ?? ''}`.toLowerCase();

  if (raw === 'SALARY_AGAINST_ADVANCE' || text.includes('salary against advance')) {
    return 'ADVANCE';
  }
  if (raw === 'OTHER_CREDIT' || raw === 'OTHER_DEBIT') {
    return 'OTHER';
  }
  if (raw === 'DEDUCTION') return 'PENALTY';
  if (raw === 'ALLOWANCE') return 'ALLOWANCE';
  return (dto.type || 'OTHER').toString();
}

/** Salary payment rows are informational; omit from running credit/debit totals. */
export function excludeFromNetTotals(entry: LedgerEntryLike): boolean {
  return (entry.type || '').toString().toUpperCase() === 'SALARY';
}
