import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { GpsController } from './gps.controller';
import { GpsService } from './gps.service';

@Module({
  imports: [PrismaModule],
  controllers: [GpsController],
  providers: [GpsService],
  exports: [GpsService],
})
export class GpsModule {}
