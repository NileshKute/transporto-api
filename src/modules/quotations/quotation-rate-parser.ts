import * as mammoth from 'mammoth';
import * as JSZip from 'jszip';

export interface ParsedQuotationRate {
  fileName: string;
  folderName: string;
  monthlyRate: number | null;
  fixedKm: number | null;
  additionalPerKm: number | null;
  quoteDate: Date | null;
  rawSnippet: string;
  source: 'PARAGRAPH' | 'TABLE' | 'ALT_FORMAT' | 'NOT_FOUND';
}

/**
 * Convert Indian-format number string to a number.
 * Handles: "1,50,000" "90, 000" "1,01,000.00" "90000/-"
 */
function parseIndianNumber(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/[,\s]/g, '')
    .replace(/\/-?$/, '')
    .replace(/\.00$/, '')
    .replace(/[Rr]s\.?/g, '')
    .replace(/₹/g, '')
    .trim();
  const n = parseFloat(cleaned);
  if (isNaN(n) || n < 1000 || n > 10_000_000) return null;
  return Math.round(n);
}

function extractDate(text: string): Date | null {
  const patterns = [
    /Date\s*:\s*(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/i,
    /(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      let [, dd, mm, yyyy] = m;
      if (yyyy.length === 2) yyyy = '20' + yyyy;
      const d = new Date(
        `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`,
      );
      if (!isNaN(d.getTime())) return d;
    }
  }
  return null;
}

export async function parseDocxRate(
  buffer: Buffer,
  fileName: string,
  folderName: string,
): Promise<ParsedQuotationRate> {
  const result: ParsedQuotationRate = {
    fileName,
    folderName,
    monthlyRate: null,
    fixedKm: null,
    additionalPerKm: null,
    quoteDate: null,
    rawSnippet: '',
    source: 'NOT_FOUND',
  };

  try {
    const textResult = await mammoth.extractRawText({ buffer });
    const text = textResult.value || '';

    result.quoteDate = extractDate(text);

    // PATTERN 1: "monthly rate of Rs.<NUMBER>"
    const p1 = text.match(
      /monthly\s+rate\s+of\s+Rs\.?\s*([\d,\s]+?)\/?-/i,
    );
    if (p1) {
      const n = parseIndianNumber(p1[1]);
      if (n) {
        result.monthlyRate = n;
        result.source = 'PARAGRAPH';
        result.rawSnippet = p1[0];
      }
    }

    // PATTERN 1b: alternative phrasing
    if (!result.monthlyRate) {
      const p1b = text.match(
        /(?:fixed\s+)?monthly\s+(?:fee|charge|charges|rate)\s*(?:of|:|=)?\s*Rs\.?\s*([\d,\s]+?)\/?-/i,
      );
      if (p1b) {
        const n = parseIndianNumber(p1b[1]);
        if (n) {
          result.monthlyRate = n;
          result.source = 'PARAGRAPH';
          result.rawSnippet = p1b[0];
        }
      }
    }

    // PATTERN 3: "Fix charges for ... : 90,000/-"
    if (!result.monthlyRate) {
      const p3 = text.match(
        /Fix(?:ed)?\s+charges?[^:\n]*:\s*([\d,\s]+?)\/?-/i,
      );
      if (p3) {
        const n = parseIndianNumber(p3[1]);
        if (n) {
          result.monthlyRate = n;
          result.source = 'ALT_FORMAT';
          result.rawSnippet = p3[0];
        }
      }
    }

    // Extract fixed KM
    const kmMatch = text.match(/(?:maximum of|for)\s*([\d,]+)\s*kms?/i);
    if (kmMatch) {
      const km = parseInt(kmMatch[1].replace(/,/g, ''), 10);
      if (!isNaN(km) && km > 100 && km < 50_000) {
        result.fixedKm = km;
      }
    }

    // Extract additional rate (per km)
    const addMatch = text.match(
      /Rs\.?\s*([\d,]+(?:\.\d+)?)\s*\/?-?\s*per\s*km/i,
    );
    if (addMatch) {
      const r = parseFloat(addMatch[1].replace(/,/g, ''));
      if (!isNaN(r) && r > 0 && r < 1000) {
        result.additionalPerKm = r;
      }
    }

    // PATTERN 2: table extraction via HTML
    if (!result.monthlyRate) {
      const htmlResult = await mammoth.convertToHtml({ buffer });
      const html = htmlResult.value || '';
      const tableMatch = html.match(/<table[\s\S]*?<\/table>/gi);
      if (tableMatch) {
        for (const tableHtml of tableMatch) {
          if (!tableHtml.toLowerCase().includes('fixed charges')) continue;
          const cellRegex = /<td>([^<]+)<\/td>/g;
          let m: RegExpExecArray | null;
          while ((m = cellRegex.exec(tableHtml)) !== null) {
            const cell = m[1].trim();
            if (/^[\d,]+(\.\d+)?$/.test(cell.replace(/\s/g, ''))) {
              const n = parseIndianNumber(cell);
              if (n && n >= 10_000) {
                result.monthlyRate = n;
                result.source = 'TABLE';
                result.rawSnippet = `Table cell: ${cell}`;
                break;
              }
            }
          }
          if (result.monthlyRate) break;
        }
      }
    }

    if (!result.rawSnippet) {
      const idx = text.toLowerCase().indexOf('rate');
      result.rawSnippet =
        idx >= 0
          ? text.substring(Math.max(0, idx - 30), idx + 170)
          : text.substring(0, 200);
    }

    return result;
  } catch (e: any) {
    result.rawSnippet = `ERROR: ${e.message}`;
    return result;
  }
}

export async function parseQuotationZip(
  zipBuffer: Buffer,
): Promise<ParsedQuotationRate[]> {
  const zip = await JSZip.loadAsync(zipBuffer);
  const results: ParsedQuotationRate[] = [];

  for (const [filePath, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    if (!filePath.toLowerCase().endsWith('.docx')) continue;

    const parts = filePath.split('/').filter(Boolean);
    let folderName = '';
    if (parts.length >= 2) {
      folderName = parts[parts.length - 2];
      if (
        parts.length >= 3 &&
        (folderName.toLowerCase() === 'rohan' || folderName === '.')
      ) {
        folderName = parts[parts.length - 3] || folderName;
      }
    }
    const fileName = parts[parts.length - 1];

    const buffer = await file.async('nodebuffer');
    const parsed = await parseDocxRate(buffer, fileName, folderName);
    results.push(parsed);
  }

  return results;
}
