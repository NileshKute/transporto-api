import { Module } from '@nestjs/common';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppParserService } from './whatsapp-parser.service';

@Module({
  controllers: [WhatsAppController],
  providers: [WhatsAppService, WhatsAppParserService],
})
export class WhatsAppModule {}
