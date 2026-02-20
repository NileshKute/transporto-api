import { Module } from '@nestjs/common';
import { ColdStorageController } from './cold-storage.controller';
import { ColdStorageService } from './cold-storage.service';

@Module({
  controllers: [ColdStorageController],
  providers: [ColdStorageService],
})
export class ColdStorageModule {}
