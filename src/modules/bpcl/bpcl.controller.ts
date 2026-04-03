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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { BpclService } from './bpcl.service';
import { BpclCardService } from './bpcl-card.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@ApiTags('BPCL SmartFleet')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('bpcl')
export class BpclController {
  constructor(
    private readonly bpclService: BpclService,
    private readonly cardService: BpclCardService,
  ) {}

  @Post('import')
  @RequirePermission('fuel', 'create')
  @ApiOperation({ summary: 'Upload BPCL SmartFleet Excel' })
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
  async importExcel(@UploadedFile() file: Express.Multer.File) {
    if (!file?.buffer) {
      throw new BadRequestException('No file uploaded');
    }
    return this.bpclService.importExcel(file.buffer, file.originalname);
  }

  @Get('transactions')
  @RequirePermission('fuel', 'view')
  @ApiOperation({ summary: 'List BPCL transactions with filters' })
  async getTransactions(
    @Query('tag') tag?: string,
    @Query('vehicleNumber') vehicleNumber?: string,
    @Query('cardNumber') cardNumber?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('product') product?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.bpclService.getTransactions({
      tag,
      vehicleNumber,
      cardNumber,
      startDate,
      endDate,
      product,
      page: parseInt(page || '1', 10) || 1,
      limit: parseInt(limit || '50', 10) || 50,
    });
  }

  @Get('dashboard')
  @RequirePermission('fuel', 'view')
  @ApiOperation({ summary: 'BPCL dashboard summary (business vs all)' })
  async getDashboard(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.bpclService.getDashboardSummary(startDate, endDate);
  }

  @Get('import-history')
  @RequirePermission('fuel', 'view')
  @ApiOperation({ summary: 'BPCL import batches' })
  async getImportHistory() {
    return this.bpclService.getImportHistory();
  }

  @Get('cards')
  @RequirePermission('fuel', 'view')
  @ApiOperation({ summary: 'List BPCL cards' })
  async getAllCards() {
    return this.cardService.getAllCards();
  }

  @Put('cards/bulk-tags')
  @RequirePermission('fuel', 'edit')
  @ApiOperation({ summary: 'Bulk update card tags' })
  async bulkUpdateTags(
    @Body() body: { updates: Array<{ cardNumber: string; tag: string }> },
  ) {
    return this.cardService.bulkUpdateTags(body?.updates ?? []);
  }

  @Get('cards/:id')
  @RequirePermission('fuel', 'view')
  @ApiOperation({ summary: 'Get BPCL card by id' })
  async getCard(@Param('id') id: string) {
    return this.cardService.getCard(id);
  }

  @Put('cards/:id')
  @RequirePermission('fuel', 'edit')
  @ApiOperation({ summary: 'Update BPCL card tag/notes' })
  async updateCard(
    @Param('id') id: string,
    @Body() body: { currentTag?: string; notes?: string },
  ) {
    return this.cardService.updateCard(id, body);
  }

  @Post('cards/:cardId/periods')
  @RequirePermission('fuel', 'edit')
  @ApiOperation({ summary: 'Add tagging period to card' })
  async addPeriod(
    @Param('cardId') cardId: string,
    @Body()
    body: { tag: string; startDate: string; endDate?: string; notes?: string },
  ) {
    return this.cardService.addPeriod(cardId, body);
  }

  @Put('periods/:periodId')
  @RequirePermission('fuel', 'edit')
  @ApiOperation({ summary: 'Update BPCL card period' })
  async updatePeriod(
    @Param('periodId') periodId: string,
    @Body()
    body: {
      tag?: string;
      startDate?: string;
      endDate?: string;
      notes?: string;
    },
  ) {
    return this.cardService.updatePeriod(periodId, body);
  }

  @Delete('periods/:periodId')
  @RequirePermission('fuel', 'edit')
  @ApiOperation({ summary: 'Delete BPCL card period' })
  async deletePeriod(@Param('periodId') periodId: string) {
    return this.cardService.deletePeriod(periodId);
  }
}
