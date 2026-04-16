import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { MetaSenderService } from '../whatsapp-meta/meta-sender.service';

@Injectable()
export class MobileAuthService {
  private readonly logger = new Logger(MobileAuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private metaSender: MetaSenderService,
  ) {}

  private normalizePhone(raw: string): string {
    return raw.replace(/\D/g, '');
  }

  async sendOtp(phoneNumber: string) {
    const digits = this.normalizePhone(phoneNumber);
    if (digits.length < 10) {
      throw new NotFoundException('Invalid phone number');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        isActive: true,
        OR: [
          { phone: { contains: digits.slice(-10) } },
          { driver: { phone: { contains: digits.slice(-10) } } },
        ],
      },
      include: { driver: { select: { phone: true } } },
    });
    if (!user) {
      throw new NotFoundException('Phone number not registered');
    }

    const otp = String(Math.floor(1000 + Math.random() * 9000));
    await this.prisma.mobileOtp.create({
      data: {
        phoneNumber: digits,
        otp,
        expiresAt: new Date(Date.now() + 5 * 60_000),
      },
    });

    const waPhone = digits.startsWith('91') ? digits : `91${digits}`;
    try {
      await this.metaSender.sendText(
        waPhone,
        `Your Transporto login OTP is: ${otp}\nValid for 5 minutes. Do not share.`,
      );
    } catch (e) {
      this.logger.warn(`WhatsApp OTP send failed for ${waPhone}: ${String(e)}`);
    }

    return { success: true, message: 'OTP sent via WhatsApp' };
  }

  async verifyOtp(phoneNumber: string, otp: string) {
    const digits = this.normalizePhone(phoneNumber);

    const record = await this.prisma.mobileOtp.findFirst({
      where: { phoneNumber: digits, verified: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new UnauthorizedException('No OTP found. Please request a new one.');
    }
    if (record.expiresAt < new Date()) {
      throw new UnauthorizedException('OTP expired. Please request a new one.');
    }
    if (record.otp !== otp) {
      throw new UnauthorizedException('Invalid OTP');
    }

    await this.prisma.mobileOtp.update({
      where: { id: record.id },
      data: { verified: true },
    });

    const user = await this.prisma.user.findFirst({
      where: {
        isActive: true,
        OR: [
          { phone: { contains: digits.slice(-10) } },
          { driver: { phone: { contains: digits.slice(-10) } } },
        ],
      },
      include: {
        driver: {
          include: {
            assignments: {
              where: { isCurrent: true },
              include: { vehicle: { select: { id: true, regNumber: true, make: true, model: true } } },
              take: 1,
            },
          },
        },
      },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const token = this.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      source: 'mobile',
    });

    const assignment = user.driver?.assignments?.[0];
    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        phone: user.phone,
        driverId: user.driver?.id ?? null,
        assignedVehicleId: assignment?.vehicleId ?? null,
        assignedVehicle: assignment?.vehicle ?? null,
      },
    };
  }

  async registerDevice(userId: string, token: string, platform: string) {
    await this.prisma.deviceToken.upsert({
      where: { token },
      create: { userId, token, platform, active: true },
      update: { userId, platform, active: true, updatedAt: new Date() },
    });
    return { success: true };
  }
}
