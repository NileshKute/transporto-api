import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { FuelService } from './fuel.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Fuel')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('fuel')
export class FuelController {
  constructor(private fuelService: FuelService) {}

  @Get()
  @ApiOperation({ summary: 'List all fuel entries with filters and pagination' })
  @ApiQuery({ name: 'vehicleId', required: false })
  @ApiQuery({ name: 'driverId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(@Query() query: any) {
    return this.fuelService.findAll(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get fuel aggregated statistics (total liters, cost, avg rate)' })
  @ApiQuery({ name: 'vehicleId', required: false })
  getStats(@Query() query: any) {
    return this.fuelService.getStats(query);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Create fuel entry with auto number and rate per liter' })
  create(@Body() dto: any) {
    return this.fuelService.create(dto);
  }
}
