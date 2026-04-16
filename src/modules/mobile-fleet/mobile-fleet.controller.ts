import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { MobileFleetService } from './mobile-fleet.service';

@ApiTags('MobileFleet')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('mobile/fleet')
export class MobileFleetController {
  constructor(private service: MobileFleetService) {}

  @Get('overview')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER')
  @ApiOperation({ summary: 'Fleet overview — vehicle counts + active trips' })
  getOverview() {
    return this.service.getOverview();
  }

  @Get('vehicles')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER')
  @ApiOperation({ summary: 'All vehicles with GPS, driver, active trip' })
  getVehicles() {
    return this.service.getVehicles();
  }

  @Get('drivers')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER')
  @ApiOperation({ summary: 'All drivers with status, trip count, alerts' })
  getDrivers() {
    return this.service.getDrivers();
  }

  @Get('alerts')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER')
  @ApiOperation({ summary: 'Document expiry alerts across entire fleet' })
  getAlerts() {
    return this.service.getAlerts();
  }
}
