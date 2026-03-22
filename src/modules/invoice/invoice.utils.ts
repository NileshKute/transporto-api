/**
 * Convert amount to Indian Rupee words (Crore, Lakh, Thousand, Hundred).
 * e.g. 305238 → "RUPEES THREE LAKH FIVE THOUSAND TWO HUNDRED THIRTY EIGHT ONLY"
 *
 * "ONLY" appears exactly once, at the end.
 */
export function amountInWords(amount: number | string): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (!Number.isFinite(n) || n <= 0) return 'RUPEES ZERO ONLY';

  const ones = [
    '', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN',
    'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN',
    'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN',
  ];
  const tens = [
    '', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY',
    'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY',
  ];

  function convert(num: number): string {
    if (num === 0) return '';
    if (num < 20) return ones[num];
    if (num < 100) {
      return (tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '')).trim();
    }
    if (num < 1000) {
      return (ones[Math.floor(num / 100)] + ' HUNDRED' + (num % 100 ? ' ' + convert(num % 100) : '')).trim();
    }
    if (num < 100000) {
      return (convert(Math.floor(num / 1000)) + ' THOUSAND' + (num % 1000 ? ' ' + convert(num % 1000) : '')).trim();
    }
    if (num < 10000000) {
      return (convert(Math.floor(num / 100000)) + ' LAKH' + (num % 100000 ? ' ' + convert(num % 100000) : '')).trim();
    }
    return (convert(Math.floor(num / 10000000)) + ' CRORE' + (num % 10000000 ? ' ' + convert(num % 10000000) : '')).trim();
  }

  const rupees = Math.floor(n);
  const paise = Math.round((n - rupees) * 100);

  const parts: string[] = ['RUPEES'];

  if (rupees > 0) {
    parts.push(convert(rupees));
  } else {
    parts.push('ZERO');
  }

  if (paise > 0) {
    parts.push('AND', convert(paise), 'PAISE');
  }

  parts.push('ONLY');

  return parts
    .filter(Boolean)
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Format number in Indian style (e.g. 3,07,838) */
export function formatIndianNumber(n: number): string {
  const s = Math.round(n).toString();
  if (s.length <= 3) return s;
  const lastThree = s.slice(-3);
  const rest = s.slice(0, -3);
  const withComma = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return withComma + ',' + lastThree;
}
