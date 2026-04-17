import { Controller, Get, Post, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { DocumentExpiryService } from './document-expiry.service';

@ApiTags('DocumentExpiry')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('document-expiry')
export class DocumentExpiryController {
  constructor(private readonly service: DocumentExpiryService) {}

  @Get('alerts')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER')
  @ApiOperation({ summary: 'List document expiry alerts with filters' })
  @ApiQuery({ name: 'severity', required: false })
  @ApiQuery({ name: 'entityType', required: false })
  @ApiQuery({ name: 'acknowledged', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getAlerts(
    @Query('severity') severity?: string,
    @Query('entityType') entityType?: string,
    @Query('acknowledged') acknowledged?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getAllAlerts({
      severity,
      entityType,
      acknowledged:
        acknowledged === 'true'
          ? true
          : acknowledged === 'false'
            ? false
            : undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  @Get('summary')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER')
  @ApiOperation({ summary: 'Alert count summary by severity' })
  getSummary() {
    return this.service.getAlertsSummary();
  }

  @Post('acknowledge/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER')
  @ApiOperation({ summary: 'Acknowledge a single alert' })
  acknowledge(
    @Param('id') id: string,
    @Req() req: { user: { id: string } },
  ) {
    return this.service.acknowledgeAlert(id, req.user.id);
  }

  @Post('acknowledge-all')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER')
  @ApiOperation({ summary: 'Acknowledge all unacknowledged alerts' })
  acknowledgeAll(@Req() req: { user: { id: string } }) {
    return this.service.acknowledgeAll(req.user.id);
  }

  @Post('unacknowledge/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER')
  @ApiOperation({ summary: 'Un-acknowledge an alert (undo accidental ack)' })
  unacknowledge(@Param('id') id: string) {
    return this.service.unacknowledgeAlert(id);
  }

  @Post('check-now')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Manually trigger the expiry check (testing)' })
  runCheck() {
    return this.service.runExpiryCheck();
  }
}
