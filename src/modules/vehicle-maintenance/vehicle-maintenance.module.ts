import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { VehicleMaintenanceController } from './vehicle-maintenance.controller';
import { VehicleMaintenanceService } from './vehicle-maintenance.service';

@Module({
  imports: [PrismaModule],
  controllers: [VehicleMaintenanceController],
  providers: [VehicleMaintenanceService],
  exports: [VehicleMaintenanceService],
})
export class VehicleMaintenanceModule {}
