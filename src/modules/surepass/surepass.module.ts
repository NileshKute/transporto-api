import { Global, Module } from '@nestjs/common';
import { SurepassService } from './surepass.service';

@Global()
@Module({
  providers: [SurepassService],
  exports: [SurepassService],
})
export class SurepassModule {}
