import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WhatsAppService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: any) {
    const { status, parsedType, page = 1, limit = 10 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = {};
    if (status) where.status = status;
    if (parsedType) where.parsedType = parsedType;
    const [data, total] = await Promise.all([
      this.prisma.whatsAppMessage.findMany({
        where,
        skip,
        take: Number(limit),
        include: { driver: { select: { name: true, phone: true } } },
        orderBy: { receivedAt: 'desc' },
      }),
      this.prisma.whatsAppMessage.count({ where }),
    ]);
    return { data, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) };
  }

  async processWebhook(body: any) {
    const fromPhone = body.From || body.from || '';
    const messageText = body.Body || body.body || body.message || '';
    const twilioSid = body.MessageSid || body.messageSid || null;
    const mediaUrl = body.MediaUrl0 || null;

    const normalizedPhone = fromPhone.replace(/\D/g, '').slice(-10);

    const driver = await this.prisma.driver.findFirst({
      where: { phone: { endsWith: normalizedPhone } },
    });

    const lowerMsg = messageText.toLowerCase();
    let parsedType = 'general';
    let parsedData: any = {};
    let confidence = 0.5;

    if (/fuel|diesel|petrol|cng|litre|liter|pump|bhara|bharwaya/.test(lowerMsg)) {
      parsedType = 'fuel';
      const litersMatch = messageText.match(/(\d+(?:\.\d+)?)\s*(?:l|litre|liter|L)/i);
      const costMatch = messageText.match(/(\d+(?:\.\d+)?)\s*(?:rupay|rs|₹|rupees|cost)/i);
      const kmMatch = messageText.match(/(?:odometer|km|kilometer)\s*[:\-]?\s*(\d+)/i);
      parsedData = {
        liters: litersMatch ? parseFloat(litersMatch[1]) : null,
        totalCost: costMatch ? parseFloat(costMatch[1]) : null,
        odometer: kmMatch ? parseInt(kmMatch[1]) : null,
      };
      confidence = 0.88;
    } else if (/puncture|accident|breakdown|emergency|engine|fire|theft|brake/.test(lowerMsg)) {
      parsedType = 'emergency';
      let emergencyType = 'OTHER';
      if (/puncture|tyre|tire/.test(lowerMsg)) emergencyType = 'PUNCTURE';
      else if (/accident/.test(lowerMsg)) emergencyType = 'ACCIDENT';
      else if (/breakdown|break down/.test(lowerMsg)) emergencyType = 'BREAKDOWN';
      else if (/engine/.test(lowerMsg)) emergencyType = 'ENGINE_FAILURE';
      else if (/fire/.test(lowerMsg)) emergencyType = 'FIRE';
      else if (/theft|chori/.test(lowerMsg)) emergencyType = 'THEFT';
      parsedData = { type: emergencyType, rawMessage: messageText };
      confidence = 0.85;
    } else if (/trip|pahunch|reached|completed|deliver|unload|km/.test(lowerMsg)) {
      parsedType = 'trip';
      const kmMatch = messageText.match(/(\d{4,6})\s*(?:km|kilometer)?/i);
      parsedData = {
        status: 'completed',
        endKm: kmMatch ? parseInt(kmMatch[1]) : null,
      };
      confidence = 0.80;
    }

    const message = await this.prisma.whatsAppMessage.create({
      data: {
        driverId: driver?.id || null,
        fromPhone,
        message: messageText,
        mediaUrl,
        parsedType,
        parsedData,
        confidence,
        status: 'PROCESSED',
        processedAt: new Date(),
        twilioSid,
      },
    });

    return { success: true, messageId: message.id, parsed: { type: parsedType, data: parsedData, confidence } };
  }
}
