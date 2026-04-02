import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { InsuranceService } from './insurance.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@ApiTags('Insurance')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('insurance')
export class InsuranceController {
  constructor(private insuranceService: InsuranceService) {}

  @Get()
  @RequirePermission('insurance', 'view')
  @ApiOperation({ summary: 'List all insurance policies with filters' })
  @ApiQuery({ name: 'vehicleId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(@Query() query: any) {
    return this.insuranceService.findAll(query);
  }

  @Get('expiring')
  @RequirePermission('insurance', 'view')
  @ApiOperation({ summary: 'Get insurance policies expiring within 30 days' })
  findExpiring() {
    return this.insuranceService.findExpiring();
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER', 'ACCOUNTANT', 'DRIVER', 'COLD_STORAGE_OPERATOR', 'VIEWER')
  @RequirePermission('insurance', 'create')
  @ApiOperation({ summary: 'Create a new insurance policy' })
  create(@Body() dto: any) {
    return this.insuranceService.create(dto);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER', 'ACCOUNTANT', 'DRIVER', 'COLD_STORAGE_OPERATOR', 'VIEWER')
  @RequirePermission('insurance', 'edit')
  @ApiOperation({ summary: 'Update an insurance policy' })
  update(@Param('id') id: string, @Body() dto: any) {
    return this.insuranceService.update(id, dto);
  }
}
