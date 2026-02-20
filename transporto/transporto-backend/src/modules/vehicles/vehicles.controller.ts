import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { VehiclesService } from './vehicles.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Vehicles')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('vehicles')
export class VehiclesController {
  constructor(private vehiclesService: VehiclesService) {}

  @Get()
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
  @ApiOperation({ summary: 'Get vehicle count statistics by status' })
  getStats() {
    return this.vehiclesService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get vehicle detail with trips, fuel, maintenance, insurance' })
  findOne(@Param('id') id: string) {
    return this.vehiclesService.findOne(id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Create a new vehicle (Admin/Manager only)' })
  create(@Body() dto: any) {
    return this.vehiclesService.create(dto);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Update vehicle (Admin/Manager only)' })
  update(@Param('id') id: string, @Body() dto: any) {
    return this.vehiclesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Soft delete vehicle (Admin only)' })
  remove(@Param('id') id: string) {
    return this.vehiclesService.remove(id);
  }
}
