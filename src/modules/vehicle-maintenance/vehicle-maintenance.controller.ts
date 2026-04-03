import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { VehicleMaintenanceService } from './vehicle-maintenance.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@ApiTags('Vehicle Maintenance Book')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('vehicle-maintenance')
export class VehicleMaintenanceController {
  constructor(private readonly service: VehicleMaintenanceService) {}

  @Get('types')
  @RequirePermission('maintenance', 'view')
  @ApiOperation({ summary: 'List maintenance types (optionally by category)' })
  @ApiQuery({ name: 'category', required: false })
  async getAllTypes(@Query('category') category?: string) {
    if (category) return this.service.getTypesByCategory(category);
    return this.service.getAllTypes();
  }

  @Post('types')
  @RequirePermission('maintenance', 'create')
  @ApiOperation({ summary: 'Create maintenance type' })
  async createType(
    @Body() body: { name: string; category: string; icon?: string },
  ) {
    return this.service.createType(body);
  }

  @Put('types/:id')
  @RequirePermission('maintenance', 'edit')
  @ApiOperation({ summary: 'Update maintenance type' })
  async updateType(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      icon?: string;
      isActive?: boolean;
      sortOrder?: number;
    },
  ) {
    return this.service.updateType(id, body);
  }

  @Delete('types/:id')
  @RequirePermission('maintenance', 'delete')
  @ApiOperation({ summary: 'Deactivate maintenance type' })
  async deleteType(@Param('id') id: string) {
    return this.service.deleteType(id);
  }

  @Get('reminders')
  @RequirePermission('maintenance', 'view')
  @ApiOperation({ summary: 'Upcoming and overdue next-service reminders' })
  @ApiQuery({ name: 'days', required: false })
  async getReminders(@Query('days') days?: string) {
    return this.service.getUpcomingReminders(
      parseInt(days || '30', 10) || 30,
    );
  }

  @Get('cost-summary/:vehicleId')
  @RequirePermission('maintenance', 'view')
  @ApiOperation({ summary: 'Truck vs reefer cost summary for a vehicle' })
  async getCostSummary(@Param('vehicleId') vehicleId: string) {
    return this.service.getVehicleCostSummary(vehicleId);
  }

  @Get('vehicle/:vehicleId')
  @RequirePermission('maintenance', 'view')
  @ApiOperation({ summary: 'Maintenance book records for one vehicle' })
  async getByVehicle(
    @Param('vehicleId') vehicleId: string,
    @Query('category') category?: string,
    @Query('typeId') typeId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getRecordsByVehicle(vehicleId, {
      category,
      typeId,
      startDate,
      endDate,
      page: parseInt(page || '1', 10) || 1,
      limit: parseInt(limit || '50', 10) || 50,
    });
  }

  @Get('records')
  @RequirePermission('maintenance', 'view')
  @ApiOperation({ summary: 'All maintenance book records (admin)' })
  async getAllRecords(
    @Query('vehicleId') vehicleId?: string,
    @Query('category') category?: string,
    @Query('typeId') typeId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getAllRecords({
      vehicleId,
      category,
      typeId,
      startDate,
      endDate,
      page: parseInt(page || '1', 10) || 1,
      limit: parseInt(limit || '50', 10) || 50,
    });
  }

  @Get('records/:id')
  @RequirePermission('maintenance', 'view')
  @ApiOperation({ summary: 'Get one maintenance book record' })
  async getRecord(@Param('id') id: string) {
    return this.service.getRecordById(id);
  }

  @Post('records')
  @RequirePermission('maintenance', 'create')
  @ApiOperation({ summary: 'Create maintenance book record' })
  async createRecord(@Body() body: Record<string, unknown>) {
    return this.service.createRecord(body as any);
  }

  @Put('records/:id')
  @RequirePermission('maintenance', 'edit')
  @ApiOperation({ summary: 'Update maintenance book record' })
  async updateRecord(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.updateRecord(id, body);
  }

  @Delete('records/:id')
  @RequirePermission('maintenance', 'delete')
  @ApiOperation({ summary: 'Delete maintenance book record' })
  async deleteRecord(@Param('id') id: string) {
    return this.service.deleteRecord(id);
  }
}
