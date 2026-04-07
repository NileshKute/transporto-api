import { Module } from '@nestjs/common';
import { QuotationsController } from './quotations.controller';
import { QuotationsService } from './quotations.service';
import { QuotationsPdfService } from './quotations-pdf.service';
import { QuotationsImportService } from './quotations-import.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { InvoiceModule } from '../invoice/invoice.module';

@Module({
  imports: [PrismaModule, InvoiceModule],
  controllers: [QuotationsController],
  providers: [
    QuotationsService,
    QuotationsPdfService,
    QuotationsImportService,
  ],
  exports: [QuotationsService],
})
export class QuotationsModule {}
