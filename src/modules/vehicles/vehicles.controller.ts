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
