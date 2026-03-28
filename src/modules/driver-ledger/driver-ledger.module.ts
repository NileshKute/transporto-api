import { Module } from '@nestjs/common';
import { DriverLedgerController } from './driver-ledger.controller';
import { DriverLedgerService } from './driver-ledger.service';
import { DriverLedgerPdfService } from './driver-ledger-pdf.service';

@Module({
  controllers: [DriverLedgerController],
  providers: [DriverLedgerService, DriverLedgerPdfService],
  exports: [DriverLedgerService],
})
export class DriverLedgerModule {}
