import { Module } from '@nestjs/common';
import { DriverLedgerController } from './driver-ledger.controller';
import { DriverLedgerService } from './driver-ledger.service';

@Module({
  controllers: [DriverLedgerController],
  providers: [DriverLedgerService],
  exports: [DriverLedgerService],
})
export class DriverLedgerModule {}
