import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  Param,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  LinkContactDto,
  SendTemplateDto,
  SendTextDto,
} from './dto/send-text.dto';
import { MetaSenderService } from './meta-sender.service';
import { MetaWebhookService } from './meta-webhook.service';
import { WhatsappMetaService } from './whatsapp-meta.service';

@ApiTags('WhatsappMeta')
@Controller('whatsapp/meta')
export class WhatsappMetaController {
  constructor(
    private config: ConfigService,
    private webhook: MetaWebhookService,
    private sender: MetaSenderService,
    private meta: WhatsappMetaService,
  ) {}

  @Public()
  @Get('webhook')
  @ApiOperation({ summary: 'Meta webhook verification (public)' })
  verifyWebhook(
    @Query('hub.mode') mode: string | undefined,
    @Query('hub.verify_token') verifyToken: string | undefined,
    @Query('hub.challenge') challenge: string | undefined,
    @Res() res: Response,
  ) {
    const expected = this.config.get<string>('WHATSAPP_META_VERIFY_TOKEN');
    if (
      mode === 'subscribe' &&
      verifyToken &&
      expected &&
      verifyToken === expected
    ) {
      return res.status(200).type('text/plain').send(challenge ?? '');
    }
    return res.status(403).send('Forbidden');
  }

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Meta webhook events (public, signature-verified)' })
  async receiveWebhook(@Req() req: Request & { rawBody?: Buffer }) {
    const raw = req.rawBody;
    const sig = req.headers['x-hub-signature-256'] as string | undefined;
    if (!raw || !Buffer.isBuffer(raw)) {
      throw new UnauthorizedException('Missing raw body');
    }
    if (!this.webhook.verifySignature(raw, sig)) {
      throw new UnauthorizedException('Invalid signature');
    }
    const payload = req.body as object;
    void this.webhook.handleEvent(payload as any).catch((err) => {
      console.error('[WhatsappMeta] handleEvent', err);
    });
    return { success: true };
  }

  @Post('send-text')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @RequirePermission('whatsapp', 'create')
  @ApiOperation({ summary: 'Send a WhatsApp text message (Meta Cloud API)' })
  sendText(@Body() dto: SendTextDto) {
    return this.sender.sendText(dto.to, dto.text);
  }

  @Post('send-template')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @RequirePermission('whatsapp', 'create')
  @ApiOperation({ summary: 'Send a WhatsApp template message' })
  sendTemplate(@Body() dto: SendTemplateDto) {
    return this.sender.sendTemplate(
      dto.to,
      dto.templateName,
      dto.languageCode,
      dto.components,
    );
  }

  @Get('contacts')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @RequirePermission('whatsapp', 'view')
  @ApiOperation({ summary: 'List Meta WhatsApp contacts' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  getContacts(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.meta.getContactsList({
      page: parseInt(page || '1', 10) || 1,
      limit: parseInt(limit || '20', 10) || 20,
      search,
    });
  }

  @Get('contacts/:id/messages')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @RequirePermission('whatsapp', 'view')
  @ApiOperation({ summary: 'Message thread for a contact' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getThread(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.meta.getThread(
      id,
      parseInt(page || '1', 10) || 1,
      parseInt(limit || '50', 10) || 50,
    );
  }

  @Post('contacts/:id/link')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @RequirePermission('whatsapp', 'edit')
  @ApiOperation({ summary: 'Link contact to driver and/or client' })
  linkContact(@Param('id') id: string, @Body() body: LinkContactDto) {
    return this.meta.linkContact(id, body.driverId, body.clientId);
  }
}
