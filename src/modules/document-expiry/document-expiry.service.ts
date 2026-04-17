import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MetaSenderService } from '../whatsapp-meta/meta-sender.service';

const ALERT_THRESHOLDS = [30, 15, 7, 1];

const SEVERITY_ORDER: Record<string, number> = {
  EXPIRED: 5,
  CRITICAL: 4,
  URGENT: 3,
  WARNING: 2,
  INFO: 1,
};

const MANAGER_PHONES = ['919967791737', '919324540988'];

@Injectable()
export class DocumentExpiryService {
  private readonly logger = new Logger(DocumentExpiryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappSender: MetaSenderService,
  ) {}

  async checkAllExpiries() {
    let totalChecked = 0;
    let alertsCreated = 0;
    let whatsappSent = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const vehicles = await this.prisma.vehicle.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        regNumber: true,
        pucExpiryDate: true,
        insuranceExpiryDate: true,
        fitnessExpiryDate: true,
        taxExpiryDate: true,
        permitExpiryDate: true,
        insurancePolicyNumber: true,
        fitnessNumber: true,
        taxReceiptNumber: true,
        permitNumber: true,
      },
    });

    for (const vehicle of vehicles) {
      const docs: { type: string; expiry: Date | null; number: string | null }[] = [
        { type: 'PUC', expiry: vehicle.pucExpiryDate, number: null },
        { type: 'INSURANCE', expiry: vehicle.insuranceExpiryDate, number: vehicle.insurancePolicyNumber },
        { type: 'FITNESS', expiry: vehicle.fitnessExpiryDate, number: vehicle.fitnessNumber },
        { type: 'TAX', expiry: vehicle.taxExpiryDate, number: vehicle.taxReceiptNumber },
        { type: 'PERMIT', expiry: vehicle.permitExpiryDate, number: vehicle.permitNumber },
      ];

      for (const doc of docs) {
        if (!doc.expiry) continue;
        totalChecked++;

        const daysRemaining = Math.ceil(
          (doc.expiry.getTime() - today.getTime()) / 86_400_000,
        );

        const result = await this.processDocument(
          'VEHICLE',
          vehicle.id,
          vehicle.regNumber,
          doc.type,
          doc.number,
          doc.expiry,
          daysRemaining,
        );
        alertsCreated += result.created;
        whatsappSent += result.sent;
      }
    }

    const drivers = await this.prisma.driver.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        name: true,
        licenseNumber: true,
        licenseExpiry: true,
      },
    });

    for (const driver of drivers) {
      if (!driver.licenseExpiry) continue;
      totalChecked++;

      const daysRemaining = Math.ceil(
        (driver.licenseExpiry.getTime() - today.getTime()) / 86_400_000,
      );

      const result = await this.processDocument(
        'DRIVER',
        driver.id,
        driver.name,
        'LICENSE',
        driver.licenseNumber,
        driver.licenseExpiry,
        daysRemaining,
      );
      alertsCreated += result.created;
      whatsappSent += result.sent;
    }

    return { totalChecked, alertsCreated, whatsappSent };
  }

  private async processDocument(
    entityType: string,
    entityId: string,
    entityName: string,
    documentType: string,
    documentNumber: string | null,
    expiryDate: Date,
    daysRemaining: number,
  ): Promise<{ created: number; sent: number }> {
    let created = 0;
    let sent = 0;

    if (daysRemaining <= 0) {
      const alert = await this.createAlertIfNotExists({
        entityType,
        entityId,
        entityName,
        documentType,
        documentNumber,
        expiryDate,
        daysRemaining: 0,
        severity: 'EXPIRED',
      });
      if (alert) {
        created++;
        if (await this.sendWhatsAppAlert(alert)) sent++;
      }
      return { created, sent };
    }

    for (const threshold of ALERT_THRESHOLDS) {
      if (daysRemaining <= threshold) {
        const severity = this.getSeverity(daysRemaining);
        const alert = await this.createAlertIfNotExists({
          entityType,
          entityId,
          entityName,
          documentType,
          documentNumber,
          expiryDate,
          daysRemaining: threshold,
          severity,
        });
        if (alert) {
          created++;
          if (severity === 'URGENT' || severity === 'CRITICAL') {
            if (await this.sendWhatsAppAlert(alert)) sent++;
          }
        }
        break;
      }
    }

    return { created, sent };
  }

  private getSeverity(days: number): string {
    if (days <= 0) return 'EXPIRED';
    if (days <= 1) return 'CRITICAL';
    if (days <= 7) return 'URGENT';
    if (days <= 15) return 'WARNING';
    return 'INFO';
  }

  private async createAlertIfNotExists(data: {
    entityType: string;
    entityId: string;
    entityName: string;
    documentType: string;
    documentNumber: string | null;
    expiryDate: Date;
    daysRemaining: number;
    severity: string;
  }) {
    try {
      return await this.prisma.documentExpiryAlert.create({
        data: {
          ...data,
          severityOrder: SEVERITY_ORDER[data.severity] ?? 0,
        },
      });
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === 'P2002') return null;
      throw e;
    }
  }

  private async sendWhatsAppAlert(
    alert: {
      id: string;
      entityType: string;
      entityName: string;
      documentType: string;
      documentNumber: string | null;
      daysRemaining: number;
      severity: string;
      expiryDate: Date;
    },
  ): Promise<boolean> {
    const message = this.formatAlertMessage(alert);
    try {
      for (const phone of MANAGER_PHONES) {
        await this.whatsappSender.sendText(phone, message);
      }
      await this.prisma.documentExpiryAlert.update({
        where: { id: alert.id },
        data: { whatsappSent: true, whatsappSentAt: new Date() },
      });
      return true;
    } catch (e) {
      this.logger.warn(`WhatsApp alert failed for ${alert.id}: ${String(e)}`);
      return false;
    }
  }

  private formatAlertMessage(alert: {
    entityType: string;
    entityName: string;
    documentType: string;
    documentNumber: string | null;
    daysRemaining: number;
    severity: string;
    expiryDate: Date;
  }): string {
    const emoji =
      alert.severity === 'EXPIRED' || alert.severity === 'CRITICAL'
        ? '🔴'
        : alert.severity === 'URGENT'
          ? '🟠'
          : '🟡';

    const status =
      alert.daysRemaining <= 0
        ? `EXPIRED ${Math.abs(alert.daysRemaining)} days ago`
        : `expires in ${alert.daysRemaining} day(s)`;

    const icon = alert.entityType === 'VEHICLE' ? '🚛' : '👤';

    return (
      `${emoji} *Document Expiry Alert*\n\n` +
      `${icon} ${alert.entityName}\n` +
      `📄 ${alert.documentType}: ${status}\n` +
      `📅 Expiry: ${alert.expiryDate.toLocaleDateString('en-IN')}\n` +
      (alert.documentNumber ? `🔢 ${alert.documentNumber}\n` : '') +
      `\nPlease renew immediately.`
    );
  }

  // --- API methods ---

  async getAllAlerts(filters?: {
    severity?: string;
    entityType?: string;
    acknowledged?: boolean;
    page?: number;
    limit?: number;
  }) {
    const where: Record<string, unknown> = {};
    if (filters?.severity) where.severity = filters.severity;
    if (filters?.entityType) where.entityType = filters.entityType;
    if (filters?.acknowledged !== undefined) where.acknowledged = filters.acknowledged;

    const take = filters?.limit || 50;
    const skip = ((filters?.page || 1) - 1) * take;

    const [data, total] = await Promise.all([
      this.prisma.documentExpiryAlert.findMany({
        where: where as any,
        orderBy: [{ severityOrder: 'desc' }, { expiryDate: 'asc' }],
        take,
        skip,
      }),
      this.prisma.documentExpiryAlert.count({ where: where as any }),
    ]);

    return { data, total, page: filters?.page || 1, limit: take };
  }

  async getAlertsSummary() {
    const [expired, critical, urgent, warning, info, unacknowledged] =
      await Promise.all([
        this.prisma.documentExpiryAlert.count({ where: { severity: 'EXPIRED', acknowledged: false } }),
        this.prisma.documentExpiryAlert.count({ where: { severity: 'CRITICAL', acknowledged: false } }),
        this.prisma.documentExpiryAlert.count({ where: { severity: 'URGENT', acknowledged: false } }),
        this.prisma.documentExpiryAlert.count({ where: { severity: 'WARNING', acknowledged: false } }),
        this.prisma.documentExpiryAlert.count({ where: { severity: 'INFO', acknowledged: false } }),
        this.prisma.documentExpiryAlert.count({ where: { acknowledged: false } }),
      ]);
    return { expired, critical, urgent, warning, info, unacknowledged };
  }

  async acknowledgeAlert(id: string, userId: string) {
    return this.prisma.documentExpiryAlert.update({
      where: { id },
      data: { acknowledged: true, acknowledgedBy: userId, acknowledgedAt: new Date() },
    });
  }

  async acknowledgeAll(userId: string) {
    return this.prisma.documentExpiryAlert.updateMany({
      where: { acknowledged: false },
      data: { acknowledged: true, acknowledgedBy: userId, acknowledgedAt: new Date() },
    });
  }

  async runExpiryCheck() {
    return this.checkAllExpiries();
  }
}
