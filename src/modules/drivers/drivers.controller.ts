import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DriversService } from './drivers.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@ApiTags('Drivers')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('drivers')
export class DriversController {
  constructor(private driversService: DriversService) {}

  @Get()
  @RequirePermission('drivers', 'view')
  @ApiOperation({ summary: 'List all drivers with filters and pagination' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(@Query() query: any) {
    return this.driversService.findAll(query);
  }

  @Get(':id')
  @RequirePermission('drivers', 'view')
  @ApiOperation({ summary: 'Get driver detail with trips, shifts, vehicle assignment' })
  findOne(@Param('id') id: string) {
    return this.driversService.findOne(id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER', 'ACCOUNTANT', 'DRIVER', 'COLD_STORAGE_OPERATOR', 'VIEWER')
  @RequirePermission('drivers', 'create')
  @ApiOperation({ summary: 'Create a new driver (Admin/Manager only)' })
  create(@Body() dto: any) {
    return this.driversService.create(dto);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER', 'ACCOUNTANT', 'DRIVER', 'COLD_STORAGE_OPERATOR', 'VIEWER')
  @RequirePermission('drivers', 'edit')
  @ApiOperation({ summary: 'Update driver (Admin/Manager only)' })
  update(@Param('id') id: string, @Body() dto: any) {
    return this.driversService.update(id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER', 'ACCOUNTANT', 'DRIVER', 'COLD_STORAGE_OPERATOR', 'VIEWER')
  @RequirePermission('drivers', 'delete')
  @ApiOperation({ summary: 'Soft delete driver (Admin only)' })
  remove(@Param('id') id: string) {
    return this.driversService.remove(id);
  }
}
