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
  Req,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { TripsService } from './trips.service';
import { DailyTripService } from './daily-trip.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@ApiTags('Trips')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('trips')
export class TripsController {
  constructor(
    private tripsService: TripsService,
    private dailyTripService: DailyTripService,
  ) {}

  @Get('daily-summary')
  @RequirePermission('trips', 'view')
  @ApiOperation({ summary: 'Daily trip log summary for date range' })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  async dailySummary(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate required');
    }
    return this.dailyTripService.summary(startDate, endDate);
  }

  @Get('daily-logs')
  @RequirePermission('trips', 'view')
  @ApiOperation({ summary: 'List daily trip logs' })
  @ApiQuery({ name: 'date', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'driverId', required: false })
  @ApiQuery({ name: 'vehicleId', required: false })
  @ApiQuery({ name: 'vehicleReg', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  listDailyLogs(@Query() query: Record<string, string | undefined>) {
    return this.dailyTripService.findAll({
      date: query.date,
      startDate: query.startDate,
      endDate: query.endDate,
      driverId: query.driverId,
      vehicleId: query.vehicleId,
      vehicleReg: query.vehicleReg,
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });
  }

  @Post('daily-log')
  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'CEO',
    'MANAGER',
    'ACCOUNTANT',
    'DRIVER',
    'COLD_STORAGE_OPERATOR',
    'VIEWER',
  )
  @RequirePermission('trips', 'create')
  @ApiOperation({ summary: 'Create or replace daily trip log (per vehicle per day)' })
  createDailyLog(@Body() body: Record<string, unknown>, @Req() req: Request) {
    const user = req.user as { id?: string } | undefined;
    return this.dailyTripService.createOrReplace(body as any, user?.id ?? null);
  }

  @Get('daily-logs/:id')
  @RequirePermission('trips', 'view')
  @ApiOperation({ summary: 'Get one daily trip log with entries' })
  getDailyLog(@Param('id') id: string) {
    return this.dailyTripService.findOne(id);
  }

  @Put('daily-logs/:id')
  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'CEO',
    'MANAGER',
    'ACCOUNTANT',
    'DRIVER',
    'COLD_STORAGE_OPERATOR',
    'VIEWER',
  )
  @RequirePermission('trips', 'edit')
  @ApiOperation({ summary: 'Update daily trip log (replace trips if provided)' })
  updateDailyLog(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    const user = req.user as { id?: string } | undefined;
    return this.dailyTripService.update(id, body as any, user?.id ?? null);
  }

  @Delete('daily-logs/:id')
  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'CEO',
    'MANAGER',
    'ACCOUNTANT',
    'DRIVER',
    'COLD_STORAGE_OPERATOR',
    'VIEWER',
  )
  @RequirePermission('trips', 'delete')
  @ApiOperation({ summary: 'Delete daily trip log' })
  removeDailyLog(@Param('id') id: string) {
    return this.dailyTripService.remove(id);
  }

  @Get('pending')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER', 'ACCOUNTANT')
  @RequirePermission('trips', 'view')
  @ApiOperation({ summary: 'Get all trips pending verification' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getPendingTrips(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.tripsService.getPendingTrips(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

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
  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'CEO',
    'MANAGER',
    'ACCOUNTANT',
    'DRIVER',
    'COLD_STORAGE_OPERATOR',
    'VIEWER',
  )
  @RequirePermission('trips', 'create')
  @ApiOperation({ summary: 'Create a new trip with auto-generated trip number' })
  create(@Body() dto: any) {
    return this.tripsService.create(dto);
  }

  @Put(':id/complete')
  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'CEO',
    'MANAGER',
    'ACCOUNTANT',
    'DRIVER',
    'COLD_STORAGE_OPERATOR',
    'VIEWER',
  )
  @RequirePermission('trips', 'edit')
  @ApiOperation({
    summary: 'Mark trip as completed, compute distance and set end time',
  })
  complete(@Param('id') id: string, @Body() dto: any) {
    return this.tripsService.complete(id, dto);
  }

  @Put(':id')
  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'CEO',
    'MANAGER',
    'ACCOUNTANT',
    'DRIVER',
    'COLD_STORAGE_OPERATOR',
    'VIEWER',
  )
  @RequirePermission('trips', 'edit')
  @ApiOperation({ summary: 'Update trip details' })
  update(@Param('id') id: string, @Body() dto: any) {
    return this.tripsService.update(id, dto);
  }

  @Post(':id/approve')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER', 'ACCOUNTANT')
  @RequirePermission('trips', 'edit')
  @ApiOperation({ summary: 'Approve a pending trip' })
  approveTrip(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() body?: { notes?: string },
  ) {
    const user = req.user as { id: string } | undefined;
    return this.tripsService.approveTrip(id, user?.id ?? '', body?.notes);
  }

  @Post(':id/reject')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER', 'ACCOUNTANT')
  @RequirePermission('trips', 'edit')
  @ApiOperation({ summary: 'Reject a pending trip' })
  rejectTrip(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() body: { reason: string },
  ) {
    const user = req.user as { id: string } | undefined;
    return this.tripsService.rejectTrip(id, user?.id ?? '', body.reason);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER')
  @RequirePermission('trips', 'delete')
  @ApiOperation({ summary: 'Delete a trip record' })
  remove(@Param('id') id: string) {
    return this.tripsService.remove(id);
  }
}
