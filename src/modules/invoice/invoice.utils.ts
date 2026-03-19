/**
 * Convert amount to Indian Rupee words (Lakh, Thousand, Hundred).
 * e.g. 307838 → "RUPEES THREE LAKH SEVEN THOUSAND EIGHT HUNDRED THIRTY EIGHT ONLY"
 */
export function amountInWords(amount: number): string {
  const ones = [
    '',
    'ONE',
    'TWO',
    'THREE',
    'FOUR',
    'FIVE',
    'SIX',
    'SEVEN',
    'EIGHT',
    'NINE',
    'TEN',
    'ELEVEN',
    'TWELVE',
    'THIRTEEN',
    'FOURTEEN',
    'FIFTEEN',
    'SIXTEEN',
    'SEVENTEEN',
    'EIGHTEEN',
    'NINETEEN',
  ];
  const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];

  if (amount === 0) return 'ZERO ONLY';

  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);

  function convertToWords(n: number): string {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' HUNDRED' + (n % 100 ? ' ' + convertToWords(n % 100) : '');
    if (n < 100000) return convertToWords(Math.floor(n / 1000)) + ' THOUSAND' + (n % 1000 ? ' ' + convertToWords(n % 1000) : '');
    if (n < 10000000) return convertToWords(Math.floor(n / 100000)) + ' LAKH' + (n % 100000 ? ' ' + convertToWords(n % 100000) : '');
    return convertToWords(Math.floor(n / 10000000)) + ' CRORE' + (n % 10000000 ? ' ' + convertToWords(n % 10000000) : '');
  }

  let result = 'RUPEES ' + convertToWords(rupees);
  if (paise > 0) result += ' AND ' + convertToWords(paise) + ' PAISE';
  return result + ' ONLY';
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
