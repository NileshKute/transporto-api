import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { TripsModule } from './modules/trips/trips.module';
import { FuelModule } from './modules/fuel/fuel.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { EmergenciesModule } from './modules/emergencies/emergencies.module';
import { InsuranceModule } from './modules/insurance/insurance.module';
import { ColdStorageModule } from './modules/cold-storage/cold-storage.module';
import { ShiftsModule } from './modules/shifts/shifts.module';
import { WhatsAppModule } from './modules/whatsapp/whatsapp.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    DashboardModule,
    VehiclesModule,
    DriversModule,
    TripsModule,
    FuelModule,
    MaintenanceModule,
    EmergenciesModule,
    InsuranceModule,
    ColdStorageModule,
    ShiftsModule,
    WhatsAppModule,
  ],
})
export class AppModule {}
