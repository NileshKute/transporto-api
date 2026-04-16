import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);

  constructor(private prisma: PrismaService) {}

  async sendToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    const devices = await this.prisma.deviceToken.findMany({
      where: { userId, active: true },
    });
    if (!devices.length) return;

    const messages = devices.map((d) => ({
      to: d.token,
      title,
      body,
      data,
      sound: 'default' as const,
    }));

    try {
      await axios.post(EXPO_PUSH_URL, messages, { timeout: 15_000 });
    } catch (e) {
      this.logger.warn(`Expo push failed for user ${userId}: ${String(e)}`);
    }
  }

  async sendToRole(
    role: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    const users = await this.prisma.user.findMany({
      where: { role: role as any, isActive: true },
      select: { id: true },
    });
    await Promise.allSettled(
      users.map((u) => this.sendToUser(u.id, title, body, data)),
    );
  }
}
