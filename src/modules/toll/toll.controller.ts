import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { TollService } from './toll.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@ApiTags('Toll')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('toll')
export class TollController {
  constructor(private readonly tollService: TollService) {}

  @Post('import')
  @RequirePermission('fuel', 'create')
  @ApiOperation({ summary: 'Upload Kotak FASTag Excel (Statement sheet)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  async importExcel(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: { user?: { id?: string } },
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('No file uploaded');
    }
    return this.tollService.importExcel(
      file.buffer,
      file.originalname,
      req.user?.id,
    );
  }

  @Get('transactions')
  @RequirePermission('fuel', 'view')
  @ApiOperation({ summary: 'List toll transactions with filters' })
  async getTransactions(
    @Query('vehicleId') vehicleId?: string,
    @Query('vehicleNumber') vehicleNumber?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('plazaCode') plazaCode?: string,
    @Query('plaza') plaza?: string,
    @Query('type') type?: string,
    @Query('txnType') txnType?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const effectiveFrom = startDate ?? from;
    const effectiveTo = endDate ?? to;
    return this.tollService.getTransactions({
      vehicleId,
      vehicleNumber,
      from: effectiveFrom,
      to: effectiveTo,
      plazaCode,
      plaza,
      type,
      txnType,
      sortBy,
      sortDir,
      page: parseInt(page || '1', 10) || 1,
      limit: parseInt(limit || '50', 10) || 50,
    });
  }

  @Get('summary')
  @RequirePermission('fuel', 'view')
  @ApiOperation({
    summary: 'Toll dashboard: period totals, top plazas, top vehicle',
  })
  async getSummary() {
    return this.tollService.getSummary();
  }

  @Get('by-vehicle')
  @RequirePermission('fuel', 'view')
  @ApiOperation({ summary: 'Toll totals grouped by vehicle' })
  async getByVehicle() {
    return this.tollService.getByVehicle();
  }

  @Get('by-plaza')
  @RequirePermission('fuel', 'view')
  @ApiOperation({ summary: 'Toll totals grouped by plaza' })
  async getByPlaza() {
    return this.tollService.getByPlaza();
  }

  @Get('by-month')
  @RequirePermission('fuel', 'view')
  @ApiOperation({ summary: 'Toll totals grouped by calendar month' })
  async getByMonth() {
    return this.tollService.getByMonth();
  }

  @Get('import-history')
  @RequirePermission('fuel', 'view')
  @ApiOperation({ summary: 'Toll import batches' })
  async getImportHistory() {
    return this.tollService.getImportHistory();
  }

  @Delete('batch/:id')
  @RequirePermission('fuel', 'delete')
  @ApiOperation({ summary: 'Delete an import batch and its transactions' })
  async deleteBatch(@Param('id') id: string) {
    return this.tollService.deleteBatch(id);
  }

  @Delete('import-history/:id')
  @RequirePermission('fuel', 'delete')
  @ApiOperation({
    summary: 'Delete an import batch (alias for frontend compatibility)',
  })
  deleteBatchAlias(@Param('id') id: string) {
    return this.tollService.deleteBatch(id);
  }
}
