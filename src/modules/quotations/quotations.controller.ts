import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { QuotationsService } from './quotations.service';
import { QuotationsPdfService } from './quotations-pdf.service';
import { QuotationsImportService } from './quotations-import.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { QuotationStatus } from '@prisma/client';

@ApiTags('Quotations')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('quotations')
export class QuotationsController {
  constructor(
    private readonly quotationsService: QuotationsService,
    private readonly pdfService: QuotationsPdfService,
    private readonly importService: QuotationsImportService,
  ) {}

  @Get('stats')
  @RequirePermission('quotations', 'view')
  @ApiOperation({ summary: 'Quotation statistics' })
  getStats() {
    return this.quotationsService.getStats();
  }

  @Get()
  @RequirePermission('quotations', 'view')
  @ApiOperation({ summary: 'List quotations' })
  findAll(@Query() query: Record<string, unknown>) {
    return this.quotationsService.findAll(query);
  }

  @Post('import')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT')
  @RequirePermission('quotations', 'import')
  @ApiOperation({ summary: 'Bulk import quotations from JSON file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async importJson(@UploadedFile() file: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('JSON file is required');
    }
    return this.importService.importFromBuffer(file.buffer);
  }

  @Post('admin/reparse-historical')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @RequirePermission('quotations', 'import')
  @ApiOperation({
    summary:
      'Re-parse imported quotations: extract monthly rates and link clients from raw text',
  })
  reparseHistorical() {
    return this.importService.reparseHistoricalData();
  }

  @Post('admin/reparse-rates-from-zip')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @RequirePermission('quotations', 'import')
  @ApiOperation({ summary: 'Extract rates from .docx ZIP and update quotations (dryRun=true to preview)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async reparseRatesFromZip(
    @UploadedFile() file: Express.Multer.File,
    @Query('dryRun') dryRun?: string,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('ZIP file is required');
    }
    return this.quotationsService.reparseRatesFromZip(
      file.buffer,
      dryRun === 'true',
    );
  }

  @Post('relink-clients')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @RequirePermission('quotations', 'import')
  @ApiOperation({ summary: 'Fuzzy auto-link clients for unmatched quotations (autoCreate=false for dry run)' })
  relinkClients(@Query('autoCreate') autoCreate?: string) {
    return this.quotationsService.relinkClientsForUnmatched(autoCreate !== 'false');
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
  @RequirePermission('quotations', 'create')
  @ApiOperation({ summary: 'Create quotation' })
  create(@Body() dto: Record<string, unknown>, @Req() req: Request & { user?: { id: string } }) {
    return this.quotationsService.create(dto, req.user?.id);
  }

  @Get(':id/pdf')
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
  @RequirePermission('quotations', 'download')
  @ApiOperation({ summary: 'Download quotation PDF' })
  async downloadPdf(@Param('id') id: string, @Res() res: Response) {
    const quotation = await this.quotationsService.findOne(id);
    const pdfBuffer = await this.pdfService.generate(quotation as Record<string, unknown>);
    const safe = String(quotation.quoteNumber || id).replace(/\//g, '-');
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="quotation-${safe}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  }

  @Get(':id')
  @RequirePermission('quotations', 'view')
  @ApiOperation({ summary: 'Get quotation by id' })
  findOne(@Param('id') id: string) {
    return this.quotationsService.findOne(id);
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
  @RequirePermission('quotations', 'edit')
  @ApiOperation({ summary: 'Update quotation' })
  update(
    @Param('id') id: string,
    @Body() dto: Record<string, unknown>,
    @Req() req: Request & { user?: { id: string } },
  ) {
    return this.quotationsService.update(id, dto, req.user?.id);
  }

  @Patch(':id/status')
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
  @RequirePermission('quotations', 'edit')
  @ApiOperation({ summary: 'Update quotation status' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['status'],
      properties: {
        status: { type: 'string', enum: Object.values(QuotationStatus) },
        notes: { type: 'string' },
        rejectedReason: { type: 'string' },
      },
    },
  })
  updateStatus(
    @Param('id') id: string,
    @Body()
    body: { status: QuotationStatus; notes?: string; rejectedReason?: string },
    @Req() req: Request & { user?: { id: string } },
  ) {
    return this.quotationsService.updateStatus(id, body.status, {
      notes: body.notes,
      rejectedReason: body.rejectedReason,
      changedBy: req.user?.id,
    });
  }

  @Post(':id/convert-to-invoice')
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
  @RequirePermission('quotations', 'edit')
  @ApiOperation({ summary: 'Convert accepted/sent quotation to draft invoice' })
  convertToInvoice(
    @Param('id') id: string,
    @Req() req: Request & { user?: { id: string } },
  ) {
    return this.quotationsService.convertToInvoice(id, req.user?.id);
  }

  @Delete(':id')
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
  @RequirePermission('quotations', 'delete')
  @ApiOperation({ summary: 'Delete quotation (DRAFT only)' })
  remove(@Param('id') id: string) {
    return this.quotationsService.delete(id);
  }
}
