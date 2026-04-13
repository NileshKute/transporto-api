import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { MetaSenderService } from './meta-sender.service';

type ClaudeImageMediaType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/gif'
  | 'image/webp';

interface OcrResult {
  documentType: 'FUEL_RECEIPT' | 'TOLL_RECEIPT' | 'OTHER';
  fuel?: {
    stationName?: string;
    city?: string;
    productName?: string;
    volumeLitres?: number;
    ratePerLitre?: number;
    totalAmount?: number;
    transactionId?: string;
    transactionDate?: string;
    vehicleNumber?: string;
  };
  toll?: {
    plazaName?: string;
    plazaCode?: string;
    amount?: number;
    transactionDateTime?: string;
    vehicleNumber?: string;
    uniqueTxnId?: string;
  };
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  rawSummary: string;
}

@Injectable()
export class MetaPhotoOcrService {
  private readonly logger = new Logger(MetaPhotoOcrService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private sender: MetaSenderService,
  ) {}

  /**
   * Called after an inbound WhatsApp image/document message is saved.
   */
  async processPhoto(messageId: string): Promise<void> {
    const message = await this.prisma.whatsappMetaMessage.findUnique({
      where: { id: messageId },
      include: {
        contact: {
          include: {
            driver: {
              include: {
                assignments: {
                  where: { isCurrent: true },
                  include: { vehicle: true },
                },
              },
            },
          },
        },
      },
    });

    if (!message || message.direction !== 'INBOUND') return;
    if (!['image', 'document'].includes(message.type)) return;
    if (!message.mediaUrl) {
      this.logger.warn(`Message ${messageId}: no mediaUrl (mediaId)`);
      return;
    }
    if (!message.contact.driverId) {
      this.logger.log(`Message ${messageId}: driver not linked`);
      return;
    }

    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY')?.trim();
    if (!apiKey) {
      this.logger.warn('ANTHROPIC_API_KEY not set, skipping photo OCR');
      return;
    }

    let buffer: Buffer;
    let mimeType: string;
    try {
      const media = await this.sender.downloadMedia(message.mediaUrl);
      buffer = media.buffer;
      mimeType = media.mimeType;
    } catch (e) {
      this.logger.error(`Download failed ${messageId}: ${String(e)}`);
      await this.safeReply(
        message.contact.waId,
        '⚠️ Could not download your photo. Please resend.',
      );
      return;
    }

    if (mimeType.toLowerCase().includes('pdf')) {
      await this.safeReply(
        message.contact.waId,
        '📄 Please send the receipt as a photo (JPG or PNG), not a PDF.',
      );
      return;
    }

    const ocr = await this.classifyWithClaude(apiKey, buffer, mimeType);

    if (ocr.documentType === 'OTHER') {
      await this.safeReply(
        message.contact.waId,
        "📷 Photo received but I couldn't identify it as a fuel or toll receipt.",
      );
      return;
    }

    const driver = message.contact.driver;
    const currentVehicle = driver?.assignments?.[0]?.vehicle;

    if (ocr.documentType === 'FUEL_RECEIPT' && ocr.fuel) {
      await this.createFuelEntry(ocr.fuel, currentVehicle, message.contact.waId);
      return;
    }

    if (ocr.documentType === 'TOLL_RECEIPT' && ocr.toll) {
      await this.createTollEntry(ocr.toll, currentVehicle, message.contact.waId);
      return;
    }
  }

  private claudeImageMediaType(mime: string): ClaudeImageMediaType {
    const m = mime.toLowerCase().split(';')[0].trim();
    if (
      m === 'image/png' ||
      m === 'image/gif' ||
      m === 'image/webp'
    ) {
      return m;
    }
    return 'image/jpeg';
  }

  private async classifyWithClaude(
    apiKey: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<OcrResult> {
    const anthropic = new Anthropic({ apiKey });
    const base64 = buffer.toString('base64');
    const mediaType = this.claudeImageMediaType(mimeType);

    const systemPrompt = `You are an OCR extractor for Indian fleet receipts. Classify the photo and extract structured data.

Return STRICT JSON:
{
  "documentType": "FUEL_RECEIPT" | "TOLL_RECEIPT" | "OTHER",
  "fuel": { "stationName", "city", "productName", "volumeLitres", "ratePerLitre", "totalAmount", "transactionId", "transactionDate" (ISO), "vehicleNumber" } OR null,
  "toll": { "plazaName", "plazaCode", "amount", "transactionDateTime" (ISO), "vehicleNumber", "uniqueTxnId" } OR null,
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "rawSummary": "one-line summary"
}

Rules:
- FUEL_RECEIPT: petrol/diesel pump receipt (BPCL, HP, IOC, Shell, etc)
- TOLL_RECEIPT: FASTag receipt or toll plaza slip
- OTHER: anything else (trip bill, document, random photo)
- Numeric fields as numbers, not strings. Date format ISO YYYY-MM-DDTHH:mm:ss
- Return ONLY JSON, no markdown`;

    try {
      const resp = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64,
                },
              },
              { type: 'text', text: 'Extract data from this receipt.' },
            ],
          },
        ],
      });
      const content = resp.content[0];
      if (content.type !== 'text') throw new Error('Non-text response');
      const cleaned = content.text.replace(/```json|```/g, '').trim();
      return JSON.parse(cleaned) as OcrResult;
    } catch (e) {
      this.logger.error(`Claude Vision failed: ${String(e)}`);
      return {
        documentType: 'OTHER',
        confidence: 'LOW',
        rawSummary: 'Parse failed',
      };
    }
  }

  private async resolveBpclCard(
    vehicleId: string | null | undefined,
    vehicleNumber: string,
  ): Promise<{ cardNumber: string; cardName: string | null }> {
    const norm = vehicleNumber.replace(/\s/g, '').toUpperCase();
    if (vehicleId) {
      const byVehicle = await this.prisma.bpclCard.findFirst({
        where: { vehicleId },
      });
      if (byVehicle) {
        return { cardNumber: byVehicle.cardNumber, cardName: byVehicle.cardName };
      }
    }
    const byReg = await this.prisma.bpclCard.findFirst({
      where: {
        vehicleNumber: { equals: norm, mode: 'insensitive' },
      },
    });
    if (byReg) {
      return { cardNumber: byReg.cardNumber, cardName: byReg.cardName };
    }
    return { cardNumber: 'WHATSAPP_META', cardName: 'WhatsApp Meta OCR' };
  }

  private async createFuelEntry(
    fuel: NonNullable<OcrResult['fuel']>,
    vehicle: { id: string; regNumber: string } | null | undefined,
    waId: string,
  ): Promise<void> {
    const vehicleId = vehicle?.id ?? null;
    const vehicleNumber =
      (fuel.vehicleNumber || vehicle?.regNumber || 'UNKNOWN').trim() || 'UNKNOWN';

    const litres = fuel.volumeLitres ?? 0;
    const rate = fuel.ratePerLitre ?? 0;
    let totalAmount = fuel.totalAmount ?? 0;
    if (totalAmount <= 0 && litres > 0 && rate > 0) {
      totalAmount = Math.round(litres * rate * 100) / 100;
    }
    const amount = totalAmount;

    if (litres <= 0 && totalAmount <= 0) {
      await this.safeReply(
        waId,
        '⚠️ Could not read fuel quantity or amount from the receipt. Try a clearer photo.',
      );
      return;
    }

    const { cardNumber, cardName } = await this.resolveBpclCard(
      vehicleId,
      vehicleNumber,
    );

    const txnIdRaw =
      fuel.transactionId?.replace(/[^\w.-]/g, '') ||
      `WAMETA-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const txnId = txnIdRaw.slice(0, 120);

    const txnDate = fuel.transactionDate
      ? new Date(fuel.transactionDate)
      : new Date();

    try {
      const row = await this.prisma.bpclTransaction.create({
        data: {
          txnId,
          txnDate,
          txnTime: null,
          cardNumber,
          cardName,
          vehicleNumber,
          vehicleId,
          mobileNumber: null,
          product: (fuel.productName || 'Diesel').trim() || 'Diesel',
          litres,
          rate,
          amount,
          totalAmount,
          stationName: fuel.stationName?.trim() || null,
          stationCity: fuel.city?.trim() || null,
          stationId: null,
          stationState: null,
          txnMode: null,
          txnType: null,
          txnCategory: null,
          creditDebit: null,
          slipNumber: null,
          importBatchId: null,
          source: 'WHATSAPP_META',
        },
      });
      const shortId = row.id.slice(0, 8);
      const msg = `⛽ Fuel logged\n${fuel.stationName || 'Pump'}${fuel.city ? ', ' + fuel.city : ''}\n${litres || '?'} L × ₹${rate || '?'} = ₹${totalAmount || '?'}\nReply "cancel ${shortId}" within 10 min to undo.`;
      await this.safeReply(waId, msg);
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      this.logger.error(`Fuel create failed: ${err}`);
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        await this.safeReply(
          waId,
          '⚠️ This fuel receipt may already be logged (duplicate transaction id).',
        );
        return;
      }
      await this.safeReply(waId, `⚠️ Could not save fuel entry: ${err}`);
    }
  }

  private async createTollEntry(
    toll: NonNullable<OcrResult['toll']>,
    vehicle: { id: string; regNumber: string } | null | undefined,
    waId: string,
  ): Promise<void> {
    const vehicleId = vehicle?.id ?? null;
    const txnSanitized = toll.uniqueTxnId?.replace(/[^\w.-]/g, '') ?? '';
    const uniqueTxnId =
      txnSanitized.length > 0
        ? txnSanitized.slice(0, 100)
        : `OCR-TOLL-${Date.now()}-${randomUUID().slice(0, 8)}`;

    const debit = toll.amount ?? 0;
    if (debit <= 0) {
      await this.safeReply(
        waId,
        '⚠️ Could not read toll amount from the receipt. Try a clearer photo.',
      );
      return;
    }

    try {
      const row = await this.prisma.tollTransaction.create({
        data: {
          vehicleId,
          uniqueTxnId,
          plazaCode: toll.plazaCode?.trim() || null,
          plazaName: toll.plazaName?.trim() || null,
          debitAmt: new Prisma.Decimal(String(debit)),
          creditAmt: new Prisma.Decimal(0),
          transactionType: 'Toll Txn',
          transactionDateTime: toll.transactionDateTime
            ? new Date(toll.transactionDateTime)
            : new Date(),
          importBatchId: null,
          rawRow: {
            source: 'WHATSAPP_META',
            vehicleNumber: toll.vehicleNumber || vehicle?.regNumber,
          } as Prisma.InputJsonValue,
        },
      });
      const shortId = row.id.slice(0, 8);
      const msg = `🛣️ Toll logged\n${toll.plazaName || 'Plaza'}\n₹${debit}\nReply "cancel ${shortId}" within 10 min to undo.`;
      await this.safeReply(waId, msg);
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      this.logger.error(`Toll create failed: ${err}`);
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        await this.safeReply(
          waId,
          '⚠️ This toll may already be logged (duplicate transaction id).',
        );
        return;
      }
      await this.safeReply(waId, `⚠️ Could not save toll entry: ${err}`);
    }
  }

  private async safeReply(waId: string, text: string): Promise<void> {
    try {
      await this.sender.sendText(waId, text);
    } catch (e) {
      this.logger.warn(`Reply failed: ${String(e)}`);
    }
  }
}
