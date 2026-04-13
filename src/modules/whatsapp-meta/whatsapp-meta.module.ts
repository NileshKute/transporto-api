import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { WhatsappMetaController } from './whatsapp-meta.controller';
import { WhatsappMetaService } from './whatsapp-meta.service';
import { MetaSenderService } from './meta-sender.service';
import { MetaWebhookService } from './meta-webhook.service';
import { MetaTripParserService } from './meta-trip-parser.service';
import { MetaPhotoOcrService } from './meta-photo-ocr.service';

@Module({
  imports: [PrismaModule],
  controllers: [WhatsappMetaController],
  providers: [
    WhatsappMetaService,
    MetaSenderService,
    MetaTripParserService,
    MetaPhotoOcrService,
    MetaWebhookService,
  ],
  exports: [
    WhatsappMetaService,
    MetaSenderService,
    MetaWebhookService,
    MetaTripParserService,
    MetaPhotoOcrService,
  ],
})
export class WhatsappMetaModule {}
