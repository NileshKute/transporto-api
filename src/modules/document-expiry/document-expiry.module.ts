import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { WhatsappMetaModule } from '../whatsapp-meta/whatsapp-meta.module';
import { DocumentExpiryService } from './document-expiry.service';
import { DocumentExpiryController } from './document-expiry.controller';
import { DocumentExpiryCron } from './document-expiry.cron';

@Module({
  imports: [PrismaModule, WhatsappMetaModule],
  controllers: [DocumentExpiryController],
  providers: [DocumentExpiryService, DocumentExpiryCron],
  exports: [DocumentExpiryService],
})
export class DocumentExpiryModule {}
