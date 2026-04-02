import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get aggregated dashboard overview stats' })
  getStats() {
    return this.dashboardService.getStats();
  }

  @Get('recent')
  @ApiOperation({ summary: 'Get recent trips, fuel entries, and emergencies' })
  getRecent() {
    return this.dashboardService.getRecent();
  }
}
