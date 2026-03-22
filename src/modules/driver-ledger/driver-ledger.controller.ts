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
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DriverLedgerService } from './driver-ledger.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Driver Ledger')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller()
export class DriverLedgerController {
  constructor(private svc: DriverLedgerService) {}

  // ── Ledger Entries ──────────────────────────

  @Get('driver-ledger')
  @ApiOperation({ summary: 'List ledger entries with filters' })
  @ApiQuery({ name: 'driverId', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiQuery({ name: 'month', required: false })
  @ApiQuery({ name: 'year', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAllEntries(@Query() query: any) {
    return this.svc.findAllEntries(query);
  }

  @Get('driver-ledger/summary/:driverId')
  @ApiOperation({ summary: 'Monthly summary for a driver' })
  @ApiQuery({ name: 'month', required: false })
  @ApiQuery({ name: 'year', required: false })
  getDriverSummary(
    @Param('driverId') driverId: string,
    @Query() query: any,
  ) {
    return this.svc.getDriverSummary(driverId, query);
  }

  @Get('driver-ledger/balance/:driverId')
  @ApiOperation({ summary: 'Outstanding advance balance for a driver' })
  getDriverBalance(@Param('driverId') driverId: string) {
    return this.svc.getDriverBalance(driverId);
  }

  @Get('driver-ledger/:id')
  @ApiOperation({ summary: 'Get single ledger entry' })
  findOneEntry(@Param('id') id: string) {
    return this.svc.findOneEntry(id);
  }

  @Post('driver-ledger')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Create ledger entry' })
  createEntry(@Body() dto: any) {
    return this.svc.createEntry(dto);
  }

  @Post('driver-ledger/advance')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Quick: Give advance to driver' })
  giveAdvance(@Body() dto: { driverId: string; amount: number; description?: string; date?: string }) {
    return this.svc.giveAdvance(dto);
  }

  @Post('driver-ledger/extra-duty')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Quick: Record extra duty payment' })
  recordExtraDuty(
    @Body() dto: { driverId: string; amount: number; tripId?: string; description?: string; date?: string },
  ) {
    return this.svc.recordExtraDuty(dto);
  }

  @Put('driver-ledger/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Update ledger entry' })
  updateEntry(@Param('id') id: string, @Body() dto: any) {
    return this.svc.updateEntry(id, dto);
  }

  @Delete('driver-ledger/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Delete ledger entry' })
  deleteEntry(@Param('id') id: string) {
    return this.svc.deleteEntry(id);
  }

  // ── Salary Management ──────────────────────

  @Get('driver-salary')
  @ApiOperation({ summary: 'List salary records' })
  @ApiQuery({ name: 'driverId', required: false })
  @ApiQuery({ name: 'month', required: false })
  @ApiQuery({ name: 'year', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAllSalaries(@Query() query: any) {
    return this.svc.findAllSalaries(query);
  }

  @Get('driver-salary/:id')
  @ApiOperation({ summary: 'Get salary record detail' })
  findOneSalary(@Param('id') id: string) {
    return this.svc.findOneSalary(id);
  }

  @Post('driver-salary/calculate')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Calculate salary for one driver for a month' })
  calculateSalary(@Body() dto: { driverId: string; month: number; year: number }) {
    return this.svc.calculateSalary(dto);
  }

  @Post('driver-salary/calculate-all')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Calculate salary for ALL drivers for a month' })
  calculateAll(@Body() dto: { month: number; year: number }) {
    return this.svc.calculateAllSalaries(dto);
  }

  @Put('driver-salary/:id/approve')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Approve salary' })
  approveSalary(@Param('id') id: string) {
    return this.svc.approveSalary(id);
  }

  @Put('driver-salary/:id/pay')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Mark salary as paid' })
  paySalary(
    @Param('id') id: string,
    @Body() dto: { paidAmount: number; paidDate?: string; notes?: string },
  ) {
    return this.svc.paySalary(id, dto);
  }
}
