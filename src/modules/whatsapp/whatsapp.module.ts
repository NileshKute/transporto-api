import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { TripsModule } from '../trips/trips.module';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppParserService } from './whatsapp-parser.service';
import { OcrService } from './ocr.service';
import { DataProcessorService } from './data-processor.service';

@Module({
  imports: [PrismaModule, TripsModule],
  controllers: [WhatsAppController],
  providers: [
    WhatsAppService,
    WhatsAppParserService,
    OcrService,
    DataProcessorService,
  ],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
