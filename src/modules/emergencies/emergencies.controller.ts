import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { EmergenciesService } from './emergencies.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@ApiTags('Emergencies')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('emergencies')
export class EmergenciesController {
  constructor(private emergenciesService: EmergenciesService) {}

  @Get()
  @RequirePermission('emergencies', 'view')
  @ApiOperation({ summary: 'List all emergencies with status filter and pagination' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(@Query() query: any) {
    return this.emergenciesService.findAll(query);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER', 'ACCOUNTANT', 'DRIVER', 'COLD_STORAGE_OPERATOR', 'VIEWER')
  @RequirePermission('emergencies', 'create')
  @ApiOperation({ summary: 'Report a new emergency' })
  create(@Body() dto: any) {
    return this.emergenciesService.create(dto);
  }

  @Put(':id/resolve')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER', 'ACCOUNTANT', 'DRIVER', 'COLD_STORAGE_OPERATOR', 'VIEWER')
  @RequirePermission('emergencies', 'edit')
  @ApiOperation({ summary: 'Resolve an emergency with resolution notes' })
  resolve(@Param('id') id: string, @Body() dto: any) {
    return this.emergenciesService.resolve(id, dto);
  }
}
