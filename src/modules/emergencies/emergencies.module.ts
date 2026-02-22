import { Module } from '@nestjs/common';
import { EmergenciesController } from './emergencies.controller';
import { EmergenciesService } from './emergencies.service';

@Module({
  controllers: [EmergenciesController],
  providers: [EmergenciesService],
})
export class EmergenciesModule {}
