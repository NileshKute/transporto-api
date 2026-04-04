import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { GpsService } from './gps.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@ApiTags('GPS')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('gps')
export class GpsController {
  constructor(private readonly gpsService: GpsService) {}

  @Get('live')
  @RequirePermission('vehicles', 'view')
  @ApiOperation({
    summary: 'Live locations from GeoTrackers (no DB sync)',
  })
  async getLiveLocations() {
    return this.gpsService.fetchLiveLocations();
  }

  @Get('sync')
  @RequirePermission('vehicles', 'view')
  @ApiOperation({
    summary: 'Fetch GeoTrackers and sync GPS fields / auto-create vehicles',
  })
  async syncVehicles() {
    return this.gpsService.syncVehicles();
  }
}
