import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { DailyTripService } from './daily-trip.service';

@Module({
  imports: [PrismaModule],
  controllers: [TripsController],
  providers: [TripsService, DailyTripService],
  exports: [TripsService, DailyTripService],
})
export class TripsModule {}
