import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MobileFleetController } from './mobile-fleet.controller';
import { MobileFleetService } from './mobile-fleet.service';

@Module({
  imports: [PrismaModule],
  controllers: [MobileFleetController],
  providers: [MobileFleetService],
  exports: [MobileFleetService],
})
export class MobileFleetModule {}
