import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MobileTripController } from './mobile-trip.controller';
import { MobileTripService } from './mobile-trip.service';

@Module({
  imports: [PrismaModule],
  controllers: [MobileTripController],
  providers: [MobileTripService],
  exports: [MobileTripService],
})
export class MobileTripModule {}
