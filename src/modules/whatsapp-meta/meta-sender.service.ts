import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { randomUUID } from 'crypto';
import { WhatsappMetaService } from './whatsapp-meta.service';

const GRAPH_VERSION = 'v21.0';
const BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

@Injectable()
export class MetaSenderService {
  private readonly logger = new Logger(MetaSenderService.name);

  constructor(
    private config: ConfigService,
    private whatsappMeta: WhatsappMetaService,
  ) {}

  private get accessToken(): string {
    const t = this.config.get<string>('WHATSAPP_META_ACCESS_TOKEN');
    if (!t?.trim()) {
      throw new ServiceUnavailableException(
        'WHATSAPP_META_ACCESS_TOKEN is not configured',
      );
    }
    return t.trim();
  }

  private get phoneNumberId(): string {
    const id = this.config.get<string>('WHATSAPP_META_PHONE_NUMBER_ID');
    if (!id?.trim()) {
      throw new ServiceUnavailableException(
        'WHATSAPP_META_PHONE_NUMBER_ID is not configured',
      );
    }
    return id.trim();
  }

  private normalizeTo(to: string): string {
    return WhatsappMetaService.normalizeDigits(to);
  }

  async sendText(to: string, text: string) {
    const toNorm = this.normalizeTo(to);
    if (!toNorm || !text?.trim()) {
      throw new BadRequestException('to and text are required');
    }

    const contact = await this.whatsappMeta.findOrCreateContact(toNorm);

    const url = `${BASE}/${this.phoneNumberId}/messages`;
    try {
      const res = await axios.post(
        url,
        {
          messaging_product: 'whatsapp',
          to: toNorm,
          type: 'text',
          text: { body: text },
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 30_000,
        },
      );

      const wamid = res.data?.messages?.[0]?.id as string | undefined;
      if (!wamid) {
        this.logger.warn('Meta sendText: no message id in response');
      }

      const saved = await this.whatsappMeta.saveOutboundFromSend(
        contact.id,
        wamid ?? `pending-${randomUUID()}`,
        'text',
        text,
        null,
        res.data as object,
      );
      return { meta: res.data, message: saved };
    } catch (e: unknown) {
      const ax = axios.isAxiosError(e) ? e : null;
      this.logger.error(
        `sendText failed: ${ax?.response?.data ? JSON.stringify(ax.response.data) : String(e)}`,
      );
      throw new BadRequestException(
        ax?.response?.data ?? { message: 'Meta send failed' },
      );
    }
  }

  async sendTemplate(
    to: string,
    templateName: string,
    languageCode: string,
    components?: unknown,
  ) {
    const toNorm = this.normalizeTo(to);
    if (!toNorm || !templateName?.trim()) {
      throw new BadRequestException('to and templateName are required');
    }

    const contact = await this.whatsappMeta.findOrCreateContact(toNorm);

    const body: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      to: toNorm,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode || 'en' },
      },
    };
    if (components != null) {
      (body.template as Record<string, unknown>).components = components;
    }

    const url = `${BASE}/${this.phoneNumberId}/messages`;
    try {
      const res = await axios.post(url, body, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 30_000,
      });

      const wamid = res.data?.messages?.[0]?.id as string | undefined;
      const saved = await this.whatsappMeta.saveOutboundFromSend(
        contact.id,
        wamid ?? `pending-${randomUUID()}`,
        'template',
        null,
        templateName,
        res.data as object,
      );
      return { meta: res.data, message: saved };
    } catch (e: unknown) {
      const ax = axios.isAxiosError(e) ? e : null;
      this.logger.error(
        `sendTemplate failed: ${ax?.response?.data ? JSON.stringify(ax.response.data) : String(e)}`,
      );
      throw new BadRequestException(
        ax?.response?.data ?? { message: 'Meta template send failed' },
      );
    }
  }

  /** Resolve media URL then download binary (Phase 2: persist to disk/S3). */
  async downloadMedia(mediaId: string): Promise<Buffer> {
    const url = `${BASE}/${mediaId}`;
    const metaRes = await axios.get(url, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
      timeout: 30_000,
    });
    const mediaUrl = metaRes.data?.url as string | undefined;
    if (!mediaUrl) {
      throw new BadRequestException('No media URL from Meta');
    }
    const bin = await axios.get<ArrayBuffer>(mediaUrl, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
      responseType: 'arraybuffer',
      timeout: 60_000,
    });
    return Buffer.from(bin.data);
  }
}
