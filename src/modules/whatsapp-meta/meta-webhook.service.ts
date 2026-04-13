import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';
import type {
  MetaWebhookPayload,
  MetaWebhookChangeValue,
  MetaInboundMessage,
} from './dto/webhook-payload.dto';
import { MetaTripParserService } from './meta-trip-parser.service';
import { WhatsappMetaService } from './whatsapp-meta.service';

@Injectable()
export class MetaWebhookService {
  private readonly logger = new Logger(MetaWebhookService.name);

  constructor(
    private config: ConfigService,
    private whatsappMeta: WhatsappMetaService,
    private tripParser: MetaTripParserService,
  ) {}

  verifySignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
    const secret = this.config.get<string>('WHATSAPP_META_APP_SECRET')?.trim();
    if (!secret) {
      this.logger.error('WHATSAPP_META_APP_SECRET not set');
      return false;
    }
    if (!signatureHeader?.startsWith('sha256=')) return false;
    const expectedHex = signatureHeader.slice('sha256='.length);
    const expected = Buffer.from(expectedHex, 'hex');
    const hmac = createHmac('sha256', secret);
    hmac.update(rawBody);
    const digest = hmac.digest();
    if (expected.length !== digest.length) return false;
    return timingSafeEqual(expected, digest);
  }

  async handleEvent(payload: MetaWebhookPayload): Promise<void> {
    const entries = payload.entry ?? [];
    for (const entry of entries) {
      const changes = entry.changes ?? [];
      for (const change of changes) {
        if (change.field !== 'messages') continue;
        const value = change.value;
        if (!value) continue;
        await this.processChangeValue(value);
      }
    }
  }

  private async processChangeValue(value: MetaWebhookChangeValue) {
    const contacts = value.contacts ?? [];
    const nameByWa = new Map<string, string>();
    for (const c of contacts) {
      const wa = c.wa_id
        ? WhatsappMetaService.normalizeDigits(c.wa_id)
        : '';
      const name = c.profile?.name;
      if (wa && name) nameByWa.set(wa, name);
    }

    for (const msg of value.messages ?? []) {
      try {
        await this.handleInboundMessage(msg, nameByWa, value);
      } catch (e) {
        this.logger.error(`Inbound message error: ${String(e)}`);
      }
    }

    for (const st of value.statuses ?? []) {
      try {
        const id = st.id;
        const status = st.status;
        if (!id || !status) continue;
        let err: { code?: string; message?: string } | undefined;
        if (st.errors?.length) {
          err = {
            code: String(st.errors[0].code ?? ''),
            message: st.errors[0].title,
          };
        }
        await this.whatsappMeta.updateMessageStatus(id, status, err);
      } catch (e) {
        this.logger.error(`Status update error: ${String(e)}`);
      }
    }
  }

  private async handleInboundMessage(
    msg: MetaInboundMessage,
    nameByWa: Map<string, string>,
    value: MetaWebhookChangeValue,
  ) {
    const from = msg.from
      ? WhatsappMetaService.normalizeDigits(msg.from)
      : '';
    if (!from) return;

    const displayName = nameByWa.get(from);
    const contact = await this.whatsappMeta.findOrCreateContact(
      from,
      displayName,
    );

    const rawPayload: Prisma.InputJsonValue = {
      message: msg as Prisma.InputJsonValue,
      metadata: value.metadata as Prisma.InputJsonValue,
    };

    const saved = await this.whatsappMeta.saveInboundMessage(
      contact.id,
      msg,
      rawPayload,
    );
    if (saved?.created && saved.message.type === 'text') {
      void this.tripParser.parseAndCreateTrips(saved.message.id).catch((err) => {
        this.logger.error(
          `Trip parse background task failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    }
  }
}
