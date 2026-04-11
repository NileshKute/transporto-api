import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { WhatsappMetaController } from './whatsapp-meta.controller';
import { WhatsappMetaService } from './whatsapp-meta.service';
import { MetaSenderService } from './meta-sender.service';
import { MetaWebhookService } from './meta-webhook.service';

@Module({
  imports: [PrismaModule],
  controllers: [WhatsappMetaController],
  providers: [WhatsappMetaService, MetaSenderService, MetaWebhookService],
  exports: [WhatsappMetaService, MetaSenderService, MetaWebhookService],
})
export class WhatsappMetaModule {}
