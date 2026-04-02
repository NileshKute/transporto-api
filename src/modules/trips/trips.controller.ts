import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { TripsService } from './trips.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@ApiTags('Trips')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('trips')
export class TripsController {
  constructor(private tripsService: TripsService) {}

  @Get()
  @RequirePermission('trips', 'view')
  @ApiOperation({ summary: 'List all trips with filters and pagination' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'vehicleId', required: false })
  @ApiQuery({ name: 'driverId', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(@Query() query: any) {
    return this.tripsService.findAll(query);
  }

  @Get(':id')
  @RequirePermission('trips', 'view')
  @ApiOperation({ summary: 'Get trip detail with vehicle, driver, and expenses' })
  findOne(@Param('id') id: string) {
    return this.tripsService.findOne(id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER', 'ACCOUNTANT', 'DRIVER', 'COLD_STORAGE_OPERATOR', 'VIEWER')
  @RequirePermission('trips', 'create')
  @ApiOperation({ summary: 'Create a new trip with auto-generated trip number' })
  create(@Body() dto: any) {
    return this.tripsService.create(dto);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER', 'ACCOUNTANT', 'DRIVER', 'COLD_STORAGE_OPERATOR', 'VIEWER')
  @RequirePermission('trips', 'edit')
  @ApiOperation({ summary: 'Update trip details' })
  update(@Param('id') id: string, @Body() dto: any) {
    return this.tripsService.update(id, dto);
  }

  @Put(':id/complete')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER', 'ACCOUNTANT', 'DRIVER', 'COLD_STORAGE_OPERATOR', 'VIEWER')
  @RequirePermission('trips', 'edit')
  @ApiOperation({ summary: 'Mark trip as completed, compute distance and set end time' })
  complete(@Param('id') id: string, @Body() dto: any) {
    return this.tripsService.complete(id, dto);
  }
}
