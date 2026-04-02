import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ColdStorageService } from './cold-storage.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@ApiTags('Cold Storage')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('cold-storage')
export class ColdStorageController {
  constructor(private coldStorageService: ColdStorageService) {}

  @Get()
  @RequirePermission('cold-storage', 'view')
  @ApiOperation({ summary: 'List all cold storage units with clients and latest temp' })
  findAll() {
    return this.coldStorageService.findAll();
  }

  @Get('alerts')
  @RequirePermission('cold-storage', 'view')
  @ApiOperation({ summary: 'Get all unresolved cold storage alerts' })
  getAlerts() {
    return this.coldStorageService.getAlerts();
  }

  @Get(':id')
  @RequirePermission('cold-storage', 'view')
  @ApiOperation({ summary: 'Get cold storage unit detail with clients, logs, alerts' })
  findOne(@Param('id') id: string) {
    return this.coldStorageService.findOne(id);
  }

  @Get(':id/logs')
  @RequirePermission('cold-storage', 'view')
  @ApiOperation({ summary: 'Get temperature logs for unit (default: last 24 hours)' })
  @ApiQuery({ name: 'hours', required: false })
  getLogs(@Param('id') id: string, @Query('hours') hours: string) {
    return this.coldStorageService.getTemperatureLogs(id, Number(hours) || 24);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER', 'ACCOUNTANT', 'DRIVER', 'COLD_STORAGE_OPERATOR', 'VIEWER')
  @RequirePermission('cold-storage', 'create')
  @ApiOperation({ summary: 'Create a new cold storage unit' })
  create(@Body() dto: any) {
    return this.coldStorageService.create(dto);
  }

  @Post(':id/temperature')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER', 'ACCOUNTANT', 'DRIVER', 'COLD_STORAGE_OPERATOR', 'VIEWER')
  @RequirePermission('cold-storage', 'edit')
  @ApiOperation({ summary: 'Log temperature reading with auto-alert on deviation' })
  logTemperature(@Param('id') id: string, @Body() dto: any) {
    return this.coldStorageService.logTemperature(id, dto);
  }
}
