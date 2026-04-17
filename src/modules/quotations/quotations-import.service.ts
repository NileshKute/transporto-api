import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { QuotationStatus, VehicleQuoteType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import * as fs from 'fs';

type ImportRow = Record<string, unknown>;

@Injectable()
export class QuotationsImportService {
  private readonly logger = new Logger(QuotationsImportService.name);

  constructor(private prisma: PrismaService) {}

  async importFromBuffer(buffer: Buffer) {
    let data: unknown;
    try {
      data = JSON.parse(buffer.toString('utf-8'));
    } catch {
      throw new BadRequestException('Invalid JSON file');
    }
    if (!Array.isArray(data)) {
      throw new BadRequestException('JSON root must be an array');
    }
    return this.importRows(data as ImportRow[]);
  }

  async importFromJsonFile(filePath: string) {
    if (!fs.existsSync(filePath)) {
      throw new BadRequestException(`File not found: ${filePath}`);
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw) as ImportRow[];
    if (!Array.isArray(data)) {
      throw new BadRequestException('JSON root must be an array');
    }
    return this.importRows(data);
  }

  private async importRows(data: ImportRow[]) {
    let imported = 0;
    let skipped = 0;
    const errors: { item: string; error: string }[] = [];

    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      const label =
        (item.source_folder as string) ||
        (item.source_file as string) ||
        `row-${i + 1}`;
      try {
        const quoteDateRaw = item.quote_date;
        const quoteDate = quoteDateRaw
          ? new Date(String(quoteDateRaw))
          : new Date();
        const year = Number.isNaN(quoteDate.getTime())
          ? new Date().getFullYear()
          : quoteDate.getFullYear();
        const quoteNumber = `QT/${year}/HIST-${String(i + 1).padStart(3, '0')}`;

        const sourceFile =
          item.source_file != null ? String(item.source_file) : null;
        const sourceFolder =
          item.source_folder != null ? String(item.source_folder) : null;

        if (sourceFile && sourceFolder) {
          const existing = await this.prisma.quotation.findFirst({
            where: { sourceFile, sourceFolder },
          });
          if (existing) {
            skipped++;
            continue;
          }
        }

        let clientId: string | null = null;
        const clientNameRaw = item.client_name as string | undefined;
        if (clientNameRaw || sourceFolder) {
          const client = await this.prisma.client.findFirst({
            where: {
              OR: [
                ...(clientNameRaw
                  ? [
                      {
                        name: {
                          contains: clientNameRaw,
                          mode: 'insensitive' as const,
                        },
                      },
                    ]
                  : []),
                ...(sourceFolder
                  ? [
                      {
                        name: {
                          contains: sourceFolder,
                          mode: 'insensitive' as const,
                        },
                      },
                    ]
                  : []),
              ],
            },
          });
          if (client) {
            clientId = client.id;
          } else {
            const allClients = await this.prisma.client.findMany({
              select: { id: true, name: true },
            });
            const matched = this.findMatchingClient(
              clientNameRaw || sourceFolder || '',
              allClients,
            );
            if (matched) clientId = matched.id;
          }
        }

        const vehicleCategory = this.mapVehicleType(
          item.vehicle_type != null ? String(item.vehicle_type) : null,
        );
        const validityDays =
          item.validity_days != null ? Number(item.validity_days) : 30;
        const validUntil = new Date(
          quoteDate.getTime() + Math.max(0, validityDays) * 86_400_000,
        );

        const loadLocations = Array.isArray(item.load_locations)
          ? (item.load_locations as unknown[]).map(String)
          : [];

        const lineRows = Array.isArray(item.line_items)
          ? (item.line_items as ImportRow[])
          : [];

        const lineCreates =
          lineRows.length > 0
            ? lineRows.map((li, idx) => ({
                srNo: Number(li.sr_no ?? li.srNo ?? idx + 1),
                description: String(li.description ?? item.vehicle_type ?? 'Line'),
                vehicleNumber:
                  li.vehicle_number != null
                    ? String(li.vehicle_number)
                    : li.vehicleNumber != null
                      ? String(li.vehicleNumber)
                      : null,
                fixedKm:
                  li.fixed_km != null
                    ? Number(li.fixed_km)
                    : li.fixedKm != null
                      ? Number(li.fixedKm)
                      : null,
                fixedCharges: Number(li.fixed_charges ?? li.fixedCharges ?? 0) || 0,
                additionalCost:
                  li.additional_cost != null
                    ? Number(li.additional_cost)
                    : li.additionalCost != null
                      ? Number(li.additionalCost)
                      : null,
                remark:
                  li.remark != null ? String(li.remark) : null,
              }))
            : [
                {
                  srNo: 1,
                  description: String(
                    item.vehicle_type ?? 'Quoted vehicle / service',
                  ),
                  vehicleNumber: null,
                  fixedKm:
                    item.fixed_km != null ? Number(item.fixed_km) : null,
                  fixedCharges: Number(item.monthly_rate ?? 0) || 0,
                  additionalCost:
                    item.additional_per_km != null
                      ? Number(item.additional_per_km)
                      : null,
                  remark: null,
                },
              ];

        await this.prisma.quotation.create({
          data: {
            quoteNumber,
            clientId,
            clientName: String(
              clientNameRaw || sourceFolder || 'Imported client',
            ),
            attnPerson:
              item.attn_person != null ? String(item.attn_person) : null,
            subject: item.subject != null ? String(item.subject) : null,
            quoteDate: Number.isNaN(quoteDate.getTime()) ? new Date() : quoteDate,
            validityDays,
            validUntil,
            vehicleType: String(item.vehicle_type || 'Unknown'),
            vehicleCategory,
            loadingCapacityKg:
              item.loading_capacity_kg != null
                ? Number(item.loading_capacity_kg)
                : null,
            temperatureC:
              item.temperature_c != null ? Number(item.temperature_c) : null,
            monthlyRate:
              item.monthly_rate != null ? Number(item.monthly_rate) : null,
            fixedKm: item.fixed_km != null ? Number(item.fixed_km) : null,
            additionalPerKm:
              item.additional_per_km != null
                ? Number(item.additional_per_km)
                : null,
            tollIncluded: Boolean(item.toll_included),
            loadLocations,
            status: QuotationStatus.ACCEPTED,
            acceptedDate: new Date(),
            sourceType: 'imported',
            sourceFolder,
            sourceFile,
            rawText: item.raw_text != null ? String(item.raw_text) : null,
            lineItems: { create: lineCreates },
            history: {
              create: {
                action: 'imported',
                toStatus: QuotationStatus.ACCEPTED,
              },
            },
          },
        });
        imported++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`Import row ${label}: ${msg}`);
        errors.push({ item: label, error: msg });
      }
    }

    return { imported, skipped, errors, total: data.length };
  }

  /**
   * Re-parse raw text for imported quotations missing rate and/or client link.
   * Idempotent: only fills null monthlyRate / null clientId; never overwrites existing values.
   */
  async reparseHistoricalData(): Promise<{
    totalScanned: number;
    rateUpdated: number;
    clientLinked: number;
  }> {
    const quotes = await this.prisma.quotation.findMany({
      where: {
        sourceType: 'imported',
        rawText: { not: null },
        OR: [{ monthlyRate: null }, { clientId: null }],
      },
    });

    const allClients = await this.prisma.client.findMany({
      select: { id: true, name: true },
    });

    let rateUpdated = 0;
    let clientLinked = 0;

    for (const quote of quotes) {
      const updates: {
        monthlyRate?: number;
        clientId?: string;
      } = {};

      if (quote.monthlyRate == null && quote.rawText) {
        const rate = this.extractMonthlyRate(quote.rawText);
        if (rate != null) {
          updates.monthlyRate = rate;
          rateUpdated++;
        }
      }

      if (quote.clientId == null) {
        const matchedClient = this.findMatchingClient(
          quote.clientName || quote.sourceFolder || '',
          allClients,
        );
        if (matchedClient) {
          updates.clientId = matchedClient.id;
          clientLinked++;
        }
      }

      if (Object.keys(updates).length > 0) {
        await this.prisma.quotation.update({
          where: { id: quote.id },
          data: updates,
        });
      }
    }

    return {
      totalScanned: quotes.length,
      rateUpdated,
      clientLinked,
    };
  }

  private extractMonthlyRate(text: string): number | null {
    if (!text) return null;

    const patterns = [
      // "Rs. 45,000/- per month" or "Rs 45000 per month" or "Rs.45000/- p.m."
      /Rs[\.\s]*(\d{1,3}(?:,\d{2,3})*(?:\.\d+)?)\/?-?\s*(?:per\s+month|p\.?\s*m\.?|monthly)/i,
      // "₹45,000/- per month" or "₹ 45000 monthly"
      /₹\s*(\d{1,3}(?:,\d{2,3})*(?:\.\d+)?)\/?-?\s*(?:per\s+month|p\.?\s*m\.?|monthly)/i,
      // "Monthly rate/hire/charges of Rs. 45,000" or "Monthly: Rs 45000"
      /monthly\s*(?:rate|hire|charge|rental|rent|cost)s?\s*(?:of\s+|:\s*|-\s*)?(?:Rs[\.\s]*|₹\s*)?(\d{1,3}(?:,\d{2,3})*(?:\.\d+)?)/i,
      // "Rate: Rs. 45,000/- per month"
      /rate\s*(?:of\s+|:\s*|-\s*)?(?:Rs[\.\s]*|₹\s*)?(\d{1,3}(?:,\d{2,3})*(?:\.\d+)?)\/?-?\s*(?:per\s+month|p\.?\s*m\.?|monthly)/i,
      // "45,000/- per month" (no Rs prefix)
      /(\d{1,3}(?:,\d{2,3})*(?:\.\d+)?)\/?-?\s*per\s+month/i,
      // "45000/- monthly" or "45,000 monthly"
      /(\d{1,3}(?:,\d{2,3})*(?:\.\d+)?)\/?-?\s*monthly/i,
      // Original fallback patterns
      /(?:monthly\s+(?:rate|hire|charge)s?\s+(?:of\s+)?)?Rs[\.\s]*(\d{1,3}(?:,\d{2,3})+(?:\.\d+)?)\/?-?/i,
      /(?:monthly\s+(?:rate|hire|charge)s?\s+(?:of\s+)?)?Rs[\.\s]*(\d{4,7}(?:\.\d+)?)\/?-?/i,
      /fixed\s+monthly\s+(?:rate|hire|charge)s?\s+(?:of\s+)?(?:Rs[\.\s]*)?(\d{1,3}(?:,\d{2,3})+(?:\.\d+)?)/i,
      /monthly[\s\S]{0,80}?Rs[\.\s]*(\d{1,3}(?:,\d{2,3})+(?:\.\d+)?)/i,
    ];

    for (const pat of patterns) {
      const match = text.match(pat);
      if (match) {
        const rate = parseFloat(match[1].replace(/,/g, ''));
        if (rate >= 5000 && rate <= 500000) {
          return rate;
        }
      }
    }
    return null;
  }

  private findMatchingClient(
    searchName: string,
    clients: { id: string; name: string }[],
  ): { id: string; name: string } | null {
    if (!searchName) return null;
    const search = this.normalizeForMatch(searchName);
    if (!search || search.length < 2) return null;

    // Pass 1: Exact normalized match
    for (const client of clients) {
      if (this.normalizeForMatch(client.name) === search) return client;
    }

    // Pass 2: Either contains the other
    for (const client of clients) {
      const cn = this.normalizeForMatch(client.name);
      if (cn.length < 2) continue;
      if (search.includes(cn) || cn.includes(search)) return client;
    }

    // Pass 3: Any single significant word match (>=4 chars)
    for (const client of clients) {
      const cn = this.normalizeForMatch(client.name);
      const clientWords = cn.split(' ').filter((w) => w.length >= 4);
      const searchWords = search.split(' ').filter((w) => w.length >= 4);
      for (const cw of clientWords) {
        for (const sw of searchWords) {
          if (cw === sw) return client;
        }
      }
    }

    // Pass 4: Prefix match on any significant word
    for (const client of clients) {
      const cn = this.normalizeForMatch(client.name);
      const clientWords = cn.split(' ').filter((w) => w.length >= 3);
      const searchWords = search.split(' ').filter((w) => w.length >= 3);
      for (const cw of clientWords) {
        for (const sw of searchWords) {
          if (cw.startsWith(sw) || sw.startsWith(cw)) return client;
        }
      }
    }

    return null;
  }

  private normalizeForMatch(name: string): string {
    return name
      .toLowerCase()
      .replace(/m\/s\.?\s*/gi, '')
      .replace(/pvt\.?\s*ltd\.?/gi, '')
      .replace(/private\s*limited/gi, '')
      .replace(/\b(?:llp|inc|corp|company|co)\b/gi, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private mapVehicleType(text: string | null): VehicleQuoteType {
    if (!text) return VehicleQuoteType.OTHER;
    const lower = text.toLowerCase();
    if (lower.includes('bolero') && lower.includes('maxi')) {
      return VehicleQuoteType.BOLERO_MAXI_TRUCK;
    }
    if (lower.includes('bolero')) return VehicleQuoteType.BOLERO_PICKUP;
    if (lower.includes('mahindra')) return VehicleQuoteType.MAHINDRA_PICKUP;
    if (lower.includes('eicher pro 2080')) {
      return VehicleQuoteType.EICHER_PRO_2080;
    }
    if (
      lower.includes('eicher pro 2059') ||
      lower.includes('eicher 2059')
    ) {
      return VehicleQuoteType.EICHER_PRO_2059;
    }
    if (lower.includes('eicher pro 3015')) {
      return VehicleQuoteType.EICHER_PRO_3015;
    }
    if (lower.includes('eicher')) return VehicleQuoteType.EICHER_2059;
    if (lower.includes('tata 407')) return VehicleQuoteType.TATA_407;
    if (lower.includes('tata 709')) return VehicleQuoteType.TATA_709;
    if (lower.includes('tata lpt')) return VehicleQuoteType.TATA_LPT;
    if (lower.includes('refrigerated')) {
      return VehicleQuoteType.REFRIGERATED_VAN;
    }
    return VehicleQuoteType.OTHER;
  }
}
