import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiBody } from '@nestjs/swagger';
import { Response } from 'express';
import { WhatsAppService } from './whatsapp.service';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('WhatsApp')
@Controller('whatsapp')
export class WhatsAppController {
  constructor(private whatsappService: WhatsAppService) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiOperation({ summary: 'List all WhatsApp messages with filters and pagination' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'parsedType', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(@Query() query: any) {
    return this.whatsappService.findAll(query);
  }

  @Post('webhook')
  @ApiOperation({ summary: 'Twilio WhatsApp webhook — PUBLIC, no auth required' })
  async webhook(
    @Body() body: any,
    @Req() req: { headers: any; protocol: string; get: (n: string) => string; originalUrl: string },
    @Res() res: Response,
  ) {
    const protocol =
      req.headers['x-forwarded-proto'] === 'https' ? 'https' : req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] || req.get?.('host') || '';
    const url = `${protocol}://${host}${req.originalUrl || '/api/whatsapp/webhook'}`;
    const signature = req.headers['x-twilio-signature'] as string | undefined;

    const { twiml } = await this.whatsappService.processWebhook(
      body,
      signature,
      url,
    );
    res.type('text/xml').send(twiml);
  }

  @Post('send')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiOperation({ summary: 'Send WhatsApp message to a driver (outbound via Twilio)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['to', 'body'],
      properties: {
        to: { type: 'string', example: '919876501001' },
        body: { type: 'string', example: 'Your trip is scheduled for 9 AM.' },
        driverId: { type: 'string', format: 'uuid' },
      },
    },
  })
  send(
    @Body() dto: { to: string; body: string; driverId?: string },
  ) {
    return this.whatsappService.sendMessage(dto);
  }
}
