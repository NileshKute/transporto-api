import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MobileDriverController } from './mobile-driver.controller';
import { MobileDriverService } from './mobile-driver.service';

@Module({
  imports: [PrismaModule],
  controllers: [MobileDriverController],
  providers: [MobileDriverService],
  exports: [MobileDriverService],
})
export class MobileDriverModule {}
