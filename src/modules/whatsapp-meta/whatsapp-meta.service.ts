import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, WhatsappMetaMessage } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { MetaInboundMessage } from './dto/webhook-payload.dto';

@Injectable()
export class WhatsappMetaService {
  private readonly logger = new Logger(WhatsappMetaService.name);

  constructor(private prisma: PrismaService) {}

  /** Digits only — WhatsApp wa_id / phone keys */
  static normalizeDigits(s: string): string {
    return String(s ?? '').replace(/\D/g, '');
  }

  async findOrCreateContact(waId: string, displayName?: string | null) {
    const id = WhatsappMetaService.normalizeDigits(waId);
    if (!id) {
      throw new Error('Invalid waId');
    }

    let contact = await this.prisma.whatsappMetaContact.findUnique({
      where: { waId: id },
    });

    if (!contact) {
      let driverId: string | null = null;
      let clientId: string | null = null;

      const drivers = await this.prisma.driver.findMany({
        where: { isDeleted: false },
        select: { id: true, phone: true, altPhone: true },
      });
      for (const d of drivers) {
        if (
          WhatsappMetaService.normalizeDigits(d.phone) === id ||
          (d.altPhone &&
            WhatsappMetaService.normalizeDigits(d.altPhone) === id)
        ) {
          driverId = d.id;
          break;
        }
      }

      if (!driverId) {
        const clients = await this.prisma.client.findMany({
          where: { isActive: true },
          select: { id: true, contactPhone: true },
        });
        for (const c of clients) {
          if (
            c.contactPhone &&
            WhatsappMetaService.normalizeDigits(c.contactPhone) === id
          ) {
            clientId = c.id;
            break;
          }
        }
      }

      contact = await this.prisma.whatsappMetaContact.create({
        data: {
          waId: id,
          displayName: displayName?.trim() || null,
          driverId,
          clientId,
        },
      });
    } else if (displayName?.trim() && !contact.displayName) {
      contact = await this.prisma.whatsappMetaContact.update({
        where: { id: contact.id },
        data: { displayName: displayName.trim() },
      });
    }

    return contact;
  }

  async saveInboundMessage(
    contactId: string,
    msg: MetaInboundMessage,
    rawPayload: Prisma.InputJsonValue,
  ): Promise<{ message: WhatsappMetaMessage; created: boolean } | null> {
    const metaMessageId = msg.id;
    if (!metaMessageId) return null;

    const existing = await this.prisma.whatsappMetaMessage.findUnique({
      where: { metaMessageId },
    });
    if (existing) return { message: existing, created: false };

    const ts = msg.timestamp
      ? new Date(parseInt(msg.timestamp, 10) * 1000)
      : new Date();

    const type = String(msg.type ?? 'unknown');
    let text: string | null = null;
    let mediaUrl: string | null = null;
    let mediaMimeType: string | null = null;
    let mediaSha256: string | null = null;
    let latitude: number | null = null;
    let longitude: number | null = null;

    if (type === 'text' && msg.text?.body) {
      text = msg.text.body;
    } else if (type === 'image' && msg.image?.id) {
      mediaUrl = msg.image.id;
      mediaMimeType = msg.image.mime_type ?? null;
      mediaSha256 = msg.image.sha256 ?? null;
    } else if (type === 'document' && msg.document?.id) {
      mediaUrl = msg.document.id;
      mediaMimeType = msg.document.mime_type ?? null;
      mediaSha256 = msg.document.sha256 ?? null;
    } else if (type === 'audio' && msg.audio?.id) {
      mediaUrl = msg.audio.id;
      mediaMimeType = msg.audio.mime_type ?? null;
    } else if (type === 'video' && msg.video?.id) {
      mediaUrl = msg.video.id;
      mediaMimeType = msg.video.mime_type ?? null;
    } else if (type === 'location' && msg.location) {
      latitude = msg.location.latitude ?? null;
      longitude = msg.location.longitude ?? null;
    }

    const row = await this.prisma.whatsappMetaMessage.create({
      data: {
        metaMessageId,
        contactId,
        direction: 'INBOUND',
        type,
        text,
        mediaUrl,
        mediaMimeType,
        mediaSha256,
        latitude,
        longitude,
        status: 'delivered',
        rawPayload,
        timestamp: ts,
      },
    });

    await this.prisma.whatsappMetaContact.update({
      where: { id: contactId },
      data: { lastMessageAt: ts },
    });

    return { message: row, created: true };
  }

  async updateMessageStatus(
    metaMessageId: string,
    status: string,
    error?: { code?: string; message?: string },
  ) {
    await this.prisma.whatsappMetaMessage.updateMany({
      where: { metaMessageId },
      data: {
        status,
        errorCode: error?.code ?? null,
        errorMessage: error?.message ?? null,
      },
    });
  }

  async getContactsList(query: {
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;
    const search = query.search?.trim();

    const where: Prisma.WhatsappMetaContactWhereInput = search
      ? {
          OR: [
            { waId: { contains: search, mode: 'insensitive' } },
            { displayName: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.whatsappMetaContact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { lastMessageAt: 'desc' },
        include: {
          driver: { select: { id: true, name: true, phone: true } },
          client: { select: { id: true, name: true, contactPhone: true } },
          messages: {
            orderBy: { timestamp: 'desc' },
            take: 1,
            select: {
              id: true,
              text: true,
              type: true,
              direction: true,
              timestamp: true,
            },
          },
        },
      }),
      this.prisma.whatsappMetaContact.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getThread(contactId: string, page = 1, limit = 50) {
    const c = await this.prisma.whatsappMetaContact.findUnique({
      where: { id: contactId },
    });
    if (!c) throw new NotFoundException('Contact not found');

    const skip = (page - 1) * limit;
    const where = { contactId };
    const [messages, total] = await Promise.all([
      this.prisma.whatsappMetaMessage.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.whatsappMetaMessage.count({ where }),
    ]);

    return {
      contact: c,
      messages,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async linkContact(
    contactId: string,
    driverId?: string | null,
    clientId?: string | null,
  ) {
    const c = await this.prisma.whatsappMetaContact.findUnique({
      where: { id: contactId },
    });
    if (!c) throw new NotFoundException('Contact not found');

    return this.prisma.whatsappMetaContact.update({
      where: { id: contactId },
      data: {
        driverId: driverId ?? null,
        clientId: clientId ?? null,
      },
      include: {
        driver: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
      },
    });
  }

  async saveOutboundFromSend(
    contactId: string,
    metaMessageId: string,
    type: string,
    text: string | null,
    templateName: string | null,
    rawPayload: Prisma.InputJsonValue,
  ) {
    const ts = new Date();
    const row = await this.prisma.whatsappMetaMessage.create({
      data: {
        metaMessageId,
        contactId,
        direction: 'OUTBOUND',
        type,
        text,
        templateName,
        status: 'sent',
        rawPayload,
        timestamp: ts,
      },
    });
    await this.prisma.whatsappMetaContact.update({
      where: { id: contactId },
      data: { lastMessageAt: ts },
    });
    return row;
  }
}
