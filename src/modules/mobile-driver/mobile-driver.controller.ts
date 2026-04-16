import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { MobileDriverService } from './mobile-driver.service';

@ApiTags('MobileDriver')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('mobile/driver')
export class MobileDriverController {
  constructor(private service: MobileDriverService) {}

  @Get('profile')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER', 'DRIVER')
  @ApiOperation({ summary: 'Get driver profile + assigned vehicle + alerts' })
  getProfile(@Req() req: { user: { id: string } }) {
    return this.service.getProfile(req.user.id);
  }

  @Get('salary')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER', 'ACCOUNTANT', 'DRIVER')
  @ApiOperation({ summary: 'Get driver salary breakdown for a month' })
  @ApiQuery({ name: 'month', required: false, description: 'YYYY-MM format' })
  getSalary(
    @Req() req: { user: { id: string } },
    @Query('month') month?: string,
  ) {
    return this.service.getSalary(req.user.id, month);
  }

  @Get('ledger')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER', 'ACCOUNTANT', 'DRIVER')
  @ApiOperation({ summary: 'Get driver ledger entries' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'driverId', required: false })
  getLedger(
    @Req() req: { user: { id: string; role: string } },
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('driverId') driverId?: string,
  ) {
    return this.service.getLedger(req.user.id, req.user.role, { from, to, driverId });
  }

  @Get('documents')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER', 'DRIVER')
  @ApiOperation({ summary: 'Get driver documents and license info' })
  getDocuments(@Req() req: { user: { id: string } }) {
    return this.service.getDocuments(req.user.id);
  }
}
