import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { MobileTripService } from './mobile-trip.service';

class StartTripDto {
  @IsOptional() @IsString() clientId?: string;
  @IsOptional() @IsString() clientName?: string;
  @IsOptional() @IsString() pickupLocationId?: string;
  @IsNotEmpty() @IsString() pickupName: string;
  @IsOptional() @IsString() dropLocationId?: string;
  @IsNotEmpty() @IsString() dropName: string;
  @IsOptional() @IsNumber() pickupLat?: number;
  @IsOptional() @IsNumber() pickupLng?: number;
}

class EndTripDto {
  @IsOptional() @IsNumber() dropLat?: number;
  @IsOptional() @IsNumber() dropLng?: number;
}

class GpsPointItem {
  @IsNumber() lat: number;
  @IsNumber() lng: number;
  @IsOptional() @IsNumber() speed?: number;
  @IsOptional() @IsNumber() accuracy?: number;
  @IsNotEmpty() @IsString() timestamp: string;
}

class AddGpsPointsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GpsPointItem)
  points: GpsPointItem[];
}

@ApiTags('MobileTrip')
@ApiBearerAuth()
@Controller('mobile/trips')
export class MobileTripController {
  constructor(private service: MobileTripService) {}

  @Post('start')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER', 'DRIVER')
  @ApiOperation({ summary: 'Start a new trip (driver)' })
  start(@Req() req: { user: { id: string } }, @Body() dto: StartTripDto) {
    return this.service.startTrip(req.user.id, dto);
  }

  @Post(':tripId/end')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER', 'DRIVER')
  @ApiOperation({ summary: 'End an active trip' })
  end(
    @Req() req: { user: { id: string } },
    @Param('tripId') tripId: string,
    @Body() dto: EndTripDto,
  ) {
    return this.service.endTrip(req.user.id, tripId, dto);
  }

  @Post(':tripId/gps-points')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER', 'DRIVER')
  @ApiOperation({ summary: 'Batch insert GPS points for an active trip' })
  addGpsPoints(
    @Req() req: { user: { id: string } },
    @Param('tripId') tripId: string,
    @Body() dto: AddGpsPointsDto,
  ) {
    return this.service.addGpsPoints(req.user.id, tripId, dto.points);
  }

  @Get('active')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER', 'DRIVER')
  @ApiOperation({ summary: 'Get current active trip for driver' })
  getActive(@Req() req: { user: { id: string } }) {
    return this.service.getActiveTrip(req.user.id);
  }

  @Get('today')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER', 'DRIVER')
  @ApiOperation({ summary: "Get today's trips and stats for driver" })
  getToday(@Req() req: { user: { id: string } }) {
    return this.service.getTodayTrips(req.user.id);
  }

  @Get('history')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER', 'ACCOUNTANT', 'DRIVER')
  @ApiOperation({ summary: 'Trip history (driver sees own, admin sees all)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'driverId', required: false })
  @ApiQuery({ name: 'vehicleId', required: false })
  @ApiQuery({ name: 'clientId', required: false })
  getHistory(
    @Req() req: { user: { id: string; role: string } },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('driverId') driverId?: string,
    @Query('vehicleId') vehicleId?: string,
    @Query('clientId') clientId?: string,
  ) {
    return this.service.getHistory(req.user.id, req.user.role, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      from,
      to,
      driverId,
      vehicleId,
      clientId,
    });
  }

  @Get(':tripId/route')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER', 'DRIVER')
  @ApiOperation({ summary: 'Get GPS route points for a trip' })
  getRoute(
    @Req() req: { user: { id: string; role: string } },
    @Param('tripId') tripId: string,
  ) {
    return this.service.getRoute(req.user.id, req.user.role, tripId);
  }
}
