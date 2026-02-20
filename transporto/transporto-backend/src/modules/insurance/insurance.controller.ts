import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { InsuranceService } from './insurance.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Insurance')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('insurance')
export class InsuranceController {
  constructor(private insuranceService: InsuranceService) {}

  @Get()
  @ApiOperation({ summary: 'List all insurance policies with filters' })
  @ApiQuery({ name: 'vehicleId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(@Query() query: any) {
    return this.insuranceService.findAll(query);
  }

  @Get('expiring')
  @ApiOperation({ summary: 'Get insurance policies expiring within 30 days' })
  findExpiring() {
    return this.insuranceService.findExpiring();
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Create a new insurance policy' })
  create(@Body() dto: any) {
    return this.insuranceService.create(dto);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Update an insurance policy' })
  update(@Param('id') id: string, @Body() dto: any) {
    return this.insuranceService.update(id, dto);
  }
}
