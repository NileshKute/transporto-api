import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { VehiclesService } from './vehicles.service';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@ApiTags('Vehicles')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('vehicles')
export class VehiclesController {
  constructor(private vehiclesService: VehiclesService) {}

  @Get()
  @RequirePermission('vehicles', 'view')
  @ApiOperation({ summary: 'List all vehicles with filters and pagination' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(@Query() query: any) {
    return this.vehiclesService.findAll(query);
  }

  @Get('stats')
  @RequirePermission('vehicles', 'view')
  @ApiOperation({ summary: 'Get vehicle count statistics by status' })
  getStats() {
    return this.vehiclesService.getStats();
  }

  @Get('expiring-documents')
  @RequirePermission('vehicles', 'view')
  @ApiOperation({ summary: 'Get vehicles with expiring or expired documents' })
  @ApiQuery({ name: 'days', required: false, description: 'Days ahead to check (default 30)' })
  getExpiringDocuments(@Query('days') days?: string) {
    const daysAhead = days ? parseInt(days, 10) : 30;
    return this.vehiclesService.getExpiringDocuments(daysAhead);
  }

  @Get('expiry-summary')
  @RequirePermission('vehicles', 'view')
  @ApiOperation({ summary: 'Get expired/expiring document counts for dashboard' })
  getExpirySummary() {
    return this.vehiclesService.getExpirySummary();
  }

  @Post('verify-rc-number')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER', 'ACCOUNTANT', 'DRIVER', 'COLD_STORAGE_OPERATOR', 'VIEWER')
  @RequirePermission('vehicles', 'view')
  @ApiOperation({ summary: 'Preview RC verification by registration number (SurePass, no DB update)' })
  @ApiBody({ schema: { properties: { vehicleNumber: { type: 'string' } }, required: ['vehicleNumber'] } })
  verifyRCByNumber(@Body() body: { vehicleNumber: string }) {
    return this.vehiclesService.verifyRCByNumber(body.vehicleNumber);
  }

  @Get(':id/challans')
  @RequirePermission('vehicles', 'view')
  @ApiOperation({ summary: 'Fetch pending challans for vehicle reg number (SurePass)' })
  getChallans(@Param('id') id: string) {
    return this.vehiclesService.fetchChallans(id);
  }

  @Get(':id/summary')
  @RequirePermission('vehicles', 'view')
  @ApiOperation({
    summary: 'Vehicle 360° summary — last 30 days rollups, alerts, lifetime totals',
  })
  getVehicle360Summary(@Param('id') id: string) {
    return this.vehiclesService.getVehicle360Summary(id);
  }

  @Get(':id/toll-transactions')
  @RequirePermission('vehicles', 'view')
  @ApiOperation({ summary: 'Paginated toll transactions for this vehicle (newest first)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getVehicleTollTransactions(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.vehiclesService.getVehicleTollTransactions(
      id,
      parseInt(page || '1', 10) || 1,
      parseInt(limit || '50', 10) || 50,
    );
  }

  @Get(':id/fuel-transactions')
  @RequirePermission('vehicles', 'view')
  @ApiOperation({ summary: 'Paginated BPCL fuel transactions for this vehicle (newest first)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getVehicleFuelTransactions(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.vehiclesService.getVehicleFuelTransactions(
      id,
      parseInt(page || '1', 10) || 1,
      parseInt(limit || '50', 10) || 50,
    );
  }

  @Get(':id/trips')
  @RequirePermission('vehicles', 'view')
  @ApiOperation({ summary: 'Paginated trips for this vehicle (newest first)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getVehicleTrips(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.vehiclesService.getVehicleTrips(
      id,
      parseInt(page || '1', 10) || 1,
      parseInt(limit || '50', 10) || 50,
    );
  }

  @Get(':id/gps-history')
  @RequirePermission('vehicles', 'view')
  @ApiOperation({
    summary: 'GPS history points for path rendering (oldest first, default last 7 days)',
  })
  @ApiQuery({
    name: 'hours',
    required: false,
    description: 'Lookback window in hours (default 168 = 7 days)',
  })
  getVehicleGpsHistory(
    @Param('id') id: string,
    @Query('hours') hoursRaw?: string,
  ) {
    const h = Number(hoursRaw);
    const hours = Number.isFinite(h) && h > 0 ? h : 168;
    return this.vehiclesService.getVehicleGpsHistory(id, hours);
  }

  @Get(':id/maintenance-history')
  @RequirePermission('vehicles', 'view')
  @ApiOperation({ summary: 'All maintenance records for this vehicle (newest first)' })
  getVehicleMaintenanceHistory(@Param('id') id: string) {
    return this.vehiclesService.getVehicleMaintenanceHistory(id);
  }

  @Post(':id/verify-rc')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER', 'ACCOUNTANT', 'DRIVER', 'COLD_STORAGE_OPERATOR', 'VIEWER')
  @RequirePermission('vehicles', 'edit')
  @ApiOperation({ summary: 'Verify RC via SurePass and smart-update vehicle fields' })
  verifyRC(@Param('id') id: string) {
    return this.vehiclesService.verifyAndUpdateRC(id);
  }

  @Get(':id')
  @RequirePermission('vehicles', 'view')
  @ApiOperation({ summary: 'Get vehicle detail with trips, fuel, maintenance, insurance' })
  findOne(@Param('id') id: string) {
    return this.vehiclesService.findOne(id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER', 'ACCOUNTANT', 'DRIVER', 'COLD_STORAGE_OPERATOR', 'VIEWER')
  @RequirePermission('vehicles', 'create')
  @ApiOperation({ summary: 'Create a new vehicle (Admin/Manager only)' })
  create(@Body() dto: any) {
    return this.vehiclesService.create(dto);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER', 'ACCOUNTANT', 'DRIVER', 'COLD_STORAGE_OPERATOR', 'VIEWER')
  @RequirePermission('vehicles', 'edit')
  @ApiOperation({ summary: 'Update vehicle (Admin/Manager only)' })
  @ApiBody({
    type: UpdateVehicleDto,
    description:
      'Any vehicle fields; iconType is documented here. Other fields pass through unchanged.',
  })
  update(@Param('id') id: string, @Body() dto: any) {
    return this.vehiclesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER', 'ACCOUNTANT', 'DRIVER', 'COLD_STORAGE_OPERATOR', 'VIEWER')
  @RequirePermission('vehicles', 'delete')
  @ApiOperation({ summary: 'Soft delete vehicle (Admin only)' })
  remove(@Param('id') id: string) {
    return this.vehiclesService.remove(id);
  }
}
