import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DocumentExpiryService } from './document-expiry.service';

@Injectable()
export class DocumentExpiryCron {
  private readonly logger = new Logger(DocumentExpiryCron.name);

  constructor(private readonly expiryService: DocumentExpiryService) {}

  @Cron('0 30 2 * * *')
  async checkExpiries() {
    this.logger.log('Starting daily document expiry check...');
    const result = await this.expiryService.checkAllExpiries();
    this.logger.log(
      `Expiry check complete: ${result.totalChecked} documents, ${result.alertsCreated} new alerts, ${result.whatsappSent} WhatsApp notifications`,
    );
  }
}
