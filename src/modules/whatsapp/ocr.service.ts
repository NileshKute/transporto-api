import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import fetch from 'node-fetch';

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private client: Anthropic | null = null;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    } else {
      this.logger.warn('ANTHROPIC_API_KEY is not set; OCR will return errors until configured');
    }
  }

  async extractFromImage(
    imageUrl: string,
    documentType?: string,
  ): Promise<Record<string, unknown>> {
    if (!this.client) {
      return {
        type: 'ERROR',
        error: 'OCR is not configured (missing ANTHROPIC_API_KEY)',
      };
    }

    let imageBuffer: Buffer;
    try {
      imageBuffer = await this.downloadImage(imageUrl);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`Image download failed: ${msg}`);
      return { type: 'ERROR', error: msg };
    }

    const base64Image = imageBuffer.toString('base64');
    const mediaType = this.getMediaType(imageUrl);

    const systemPrompt = `You are an OCR expert for Indian vehicle and transport documents. 
Extract ALL text and data from the image. Return ONLY valid JSON, no markdown, no explanation.

Based on the document type, extract relevant fields:

For PUC Certificate:
{"type": "PUC", "vehicleNumber": "", "pucNumber": "", "issueDate": "DD/MM/YYYY", "expiryDate": "DD/MM/YYYY", "emissionResult": "PASS/FAIL", "centerName": "", "readings": ""}

For Insurance:
{"type": "INSURANCE", "vehicleNumber": "", "policyNumber": "", "company": "", "insuredName": "", "startDate": "DD/MM/YYYY", "expiryDate": "DD/MM/YYYY", "premium": 0, "idvValue": 0, "insuranceType": "COMPREHENSIVE/THIRD_PARTY"}

For RC Book (paper certificate OR mParivahan/Vahan app screenshot):
{"type": "RC_BOOK", "vehicleNumber": "", "ownerName": "", "registeringAuthority": "", "vehicleClass": "", "fuelType": "", "emissionNorm": "", "vehicleAge": "", "hypothecated": "", "registrationDate": "DD/MM/YYYY", "fitnessValidUpto": "DD/MM/YYYY", "taxValidUpto": "", "insuranceValidUpto": "DD/MM/YYYY", "puccValidUpto": "DD/MM/YYYY", "permitValidUpto": "DD/MM/YYYY", "make": "", "model": "", "color": "", "engineNumber": "", "chassisNumber": "", "bodyType": "", "seatingCapacity": 0, "grossWeight": 0, "ownerAddress": ""}

IMPORTANT for RC/mParivahan: mParivahan screenshots show dates like '05-Apr-2024' or '26-Mar-2026'. Convert ALL dates in your JSON output to DD/MM/YYYY format (e.g. '05-Apr-2024' -> '05/04/2024', '26-Mar-2026' -> '26/03/2026'). If a field shows 'LTT' or similar codes instead of a date, output that code as a string (not null).

For Driver License:
{"type": "LICENSE", "licenseNumber": "", "name": "", "fatherName": "", "dateOfBirth": "DD/MM/YYYY", "address": "", "issueDate": "DD/MM/YYYY", "expiryDate": "DD/MM/YYYY", "validityNT": "DD/MM/YYYY", "validityTR": "DD/MM/YYYY", "vehicleClasses": "", "bloodGroup": ""}

IMPORTANT: For Indian licenses, the Expiry Date should be the Validity(NT) date, NOT the Issue Date. Look for 'Validity(NT)' field which is the main expiry. 'Validity(TR)' is for transport vehicles only. Put the main non-transport expiry in validityNT; also mirror it in expiryDate for consistency.

For Fuel Receipt:
{"type": "FUEL", "vehicleNumber": "", "date": "DD/MM/YYYY", "fuelType": "DIESEL/PETROL/CNG", "quantity": 0, "ratePerLitre": 0, "totalAmount": 0, "pumpName": "", "odometerReading": 0}

For Speedometer/Odometer Reading:
{"type": "SPEEDOMETER", "odometerReading": 0, "vehicleNumber": ""}

If you cannot determine the document type, set type as "UNKNOWN" and extract whatever text you can see.
If a field is not visible or unclear, set it as null.
Always try to read the vehicle registration number - it's the most important field.`;

    const userPrompt = documentType
      ? `This is a ${documentType} document. Extract all data from this image.`
      : `Identify what type of document this is (PUC, Insurance, RC Book, License, Fuel Receipt, Speedometer) and extract all data.`;

    const model =
      process.env.ANTHROPIC_OCR_MODEL || 'claude-sonnet-4-20250514';

    try {
      const response = await this.client.messages.create({
        model,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                  data: base64Image,
                },
              },
              {
                type: 'text',
                text: userPrompt,
              },
            ],
          },
        ],
        system: systemPrompt,
      });

      const textContent = response.content.find((c) => c.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        return { type: 'ERROR', error: 'No text in model response' };
      }

      const jsonStr = textContent.text
        .replace(/```json\n?/gi, '')
        .replace(/```\n?/g, '')
        .trim();
      return JSON.parse(jsonStr) as Record<string, unknown>;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`OCR Error: ${msg}`);
      return { type: 'ERROR', error: msg };
    }
  }

  private async downloadImage(url: string): Promise<Buffer> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    const response = await fetch(url, {
      headers:
        accountSid && authToken
          ? {
              Authorization:
                'Basic ' +
                Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
            }
          : {},
    });

    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  private getMediaType(url: string): string {
    const lower = url.toLowerCase();
    if (lower.includes('.png') || lower.includes('image/png')) {
      return 'image/png';
    }
    if (lower.includes('.gif')) return 'image/gif';
    if (lower.includes('.webp')) return 'image/webp';
    return 'image/jpeg';
  }
}
