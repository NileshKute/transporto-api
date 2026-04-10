import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { JwtGlobalAuthGuard } from './common/guards/jwt-global.guard';
import { PermissionGuard } from './common/guards/permission.guard';
import { PermissionsModule } from './modules/permissions/permissions.module';
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
import { ClientModule } from './modules/client/client.module';
import { InvoiceModule } from './modules/invoice/invoice.module';
import { QuotationsModule } from './modules/quotations/quotations.module';
import { DriverLedgerModule } from './modules/driver-ledger/driver-ledger.module';
import { BpclModule } from './modules/bpcl/bpcl.module';
import { TollModule } from './modules/toll/toll.module';
import { VehicleMaintenanceModule } from './modules/vehicle-maintenance/vehicle-maintenance.module';
import { GpsModule } from './modules/gps/gps.module';
import { SurepassModule } from './modules/surepass/surepass.module';
import { LocationsModule } from './modules/locations/locations.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    SurepassModule,
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
    ClientModule,
    InvoiceModule,
    QuotationsModule,
    DriverLedgerModule,
    BpclModule,
    TollModule,
    VehicleMaintenanceModule,
    GpsModule,
    LocationsModule,
    PermissionsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtGlobalAuthGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
})
export class AppModule {}
