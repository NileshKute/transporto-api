import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiBody } from '@nestjs/swagger';
import { InvoiceService } from './invoice.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Invoices')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('invoices')
export class InvoiceController {
  constructor(private invoiceService: InvoiceService) {}

  @Get()
  @ApiOperation({ summary: 'List invoices with filters' })
  @ApiQuery({ name: 'clientId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'month', required: false })
  @ApiQuery({ name: 'year', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(@Query() query: any) {
    return this.invoiceService.findAll(query);
  }

  @Get('next-number')
  @ApiOperation({ summary: 'Get next invoice number for current financial year' })
  getNextNumber() {
    return this.invoiceService.getNextInvoiceNumber().then((n) => ({ invoiceNumber: n }));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get invoice by ID with line items and deductions' })
  findOne(@Param('id') id: string) {
    return this.invoiceService.findOne(id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Create invoice with line items and deductions' })
  create(@Body() dto: any) {
    return this.invoiceService.create(dto);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Update invoice (DRAFT only)' })
  update(@Param('id') id: string, @Body() dto: any) {
    return this.invoiceService.update(id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Delete invoice (DRAFT only)' })
  remove(@Param('id') id: string) {
    return this.invoiceService.remove(id);
  }

  @Post(':id/generate-pdf')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Generate PDF and return download URL/path' })
  generatePdf(@Param('id') id: string) {
    return this.invoiceService.generatePdf(id);
  }

  @Put(':id/status')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Update invoice status' })
  @ApiBody({ schema: { type: 'object', properties: { status: { type: 'string', enum: ['SENT', 'PAID', 'PARTIAL', 'OVERDUE', 'CANCELLED'] } } } })
  updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.invoiceService.updateStatus(id, body.status);
  }

  @Put(':id/payment')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Record payment' })
  @ApiBody({ schema: { type: 'object', properties: { amount: { type: 'number' } } } })
  recordPayment(@Param('id') id: string, @Body() body: { amount: number }) {
    return this.invoiceService.recordPayment(id, body);
  }

  @Post('auto-generate')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Auto-generate draft invoice from trip data for a client and month' })
  @ApiBody({ schema: { type: 'object', properties: { clientId: { type: 'string' }, billingMonth: { type: 'string', example: '2026-03' } } } })
  autoGenerate(@Body() dto: { clientId: string; billingMonth: string }) {
    return this.invoiceService.autoGenerate(dto);
  }
}
