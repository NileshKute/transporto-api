import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { GpsService } from './gps.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('GPS')
@Controller('gps')
export class GpsController {
  constructor(private readonly gpsService: GpsService) {}

  @Get('live')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @RequirePermission('vehicles', 'view')
  @ApiOperation({ summary: 'Live GPS rows from GpsLive (dashboard)' })
  async getLiveData() {
    return this.gpsService.getLiveData();
  }

  @Get('history')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @RequirePermission('vehicles', 'view')
  @ApiOperation({
    summary: 'Historical GPS pings (vehicleId UUID or reg fragment)',
  })
  async getHistory(
    @Query('vehicleId') vehicleId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (!vehicleId || !startDate || !endDate) {
      throw new BadRequestException(
        'vehicleId, startDate, endDate required',
      );
    }
    return this.gpsService.getHistory(
      vehicleId,
      startDate,
      endDate,
      Number(page) || 1,
      Number(limit) || 100,
    );
  }

  @Get('route-report')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @RequirePermission('vehicles', 'view')
  @ApiProduces('application/pdf')
  @ApiOperation({
    summary: 'Cold chain compliance PDF report for a single day',
  })
  @ApiQuery({ name: 'vehicleId', required: true })
  @ApiQuery({ name: 'date', required: true, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'clientName', required: false })
  async getRouteReport(
    @Query('vehicleId') vehicleId: string,
    @Query('date') date: string,
    @Query('clientName') clientName: string | undefined,
    @Res({ passthrough: false }) res: Response,
  ) {
    if (!vehicleId || !date) {
      throw new BadRequestException('vehicleId and date required');
    }
    const pdfBuffer = await this.gpsService.generateRouteReport(
      vehicleId,
      date,
      clientName,
    );
    const meta = await this.gpsService.getVehicleById(vehicleId);
    const regSafe =
      (meta?.regNumber || 'vehicle').replace(/[^\w.-]+/g, '_') || 'vehicle';
    const filename = `Route_Report_${regSafe}_${date}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  }

  @Get('route')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @RequirePermission('vehicles', 'view')
  @ApiOperation({ summary: 'Ordered points for map polyline replay' })
  async getRouteTrail(
    @Query('vehicleId') vehicleId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!vehicleId || !startDate || !endDate) {
      throw new BadRequestException(
        'vehicleId, startDate, endDate required',
      );
    }
    return this.gpsService.getRouteTrail(vehicleId, startDate, endDate);
  }

  @Post('share')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @RequirePermission('vehicles', 'create')
  @ApiOperation({ summary: 'Create public share link for live tracking' })
  async createShare(
    @Body()
    body: {
      vehicleId: string;
      clientId?: string;
      label?: string;
      expiresInHours?: number;
    },
  ) {
    return this.gpsService.createShareSession(
      body.vehicleId,
      body.clientId,
      body.label,
      body.expiresInHours,
    );
  }

  @Get('share/list')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @RequirePermission('vehicles', 'view')
  @ApiOperation({ summary: 'List active share sessions' })
  async listShares() {
    return this.gpsService.listShareSessions();
  }

  @Post('share/:id/stop')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @RequirePermission('vehicles', 'edit')
  @ApiOperation({ summary: 'Deactivate a share session' })
  async stopShare(@Param('id') id: string) {
    return this.gpsService.stopShareSession(id);
  }

  @Public()
  @Get('track/:token')
  @ApiOperation({
    summary: 'Public live tracking by share token (no auth)',
  })
  async getSharedData(@Param('token') token: string) {
    return this.gpsService.getSharedLiveData(token);
  }
}
