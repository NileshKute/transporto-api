import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ColdStorageService } from './cold-storage.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Cold Storage')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('cold-storage')
export class ColdStorageController {
  constructor(private coldStorageService: ColdStorageService) {}

  @Get()
  @ApiOperation({ summary: 'List all cold storage units with clients and latest temp' })
  findAll() {
    return this.coldStorageService.findAll();
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Get all unresolved cold storage alerts' })
  getAlerts() {
    return this.coldStorageService.getAlerts();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get cold storage unit detail with clients, logs, alerts' })
  findOne(@Param('id') id: string) {
    return this.coldStorageService.findOne(id);
  }

  @Get(':id/logs')
  @ApiOperation({ summary: 'Get temperature logs for unit (default: last 24 hours)' })
  @ApiQuery({ name: 'hours', required: false })
  getLogs(@Param('id') id: string, @Query('hours') hours: string) {
    return this.coldStorageService.getTemperatureLogs(id, Number(hours) || 24);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Create a new cold storage unit' })
  create(@Body() dto: any) {
    return this.coldStorageService.create(dto);
  }

  @Post(':id/temperature')
  @ApiOperation({ summary: 'Log temperature reading with auto-alert on deviation' })
  logTemperature(@Param('id') id: string, @Body() dto: any) {
    return this.coldStorageService.logTemperature(id, dto);
  }
}
