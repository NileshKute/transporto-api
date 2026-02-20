import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ColdStorageService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.coldStorageUnit.findMany({
      where: { isActive: true },
      include: {
        storageClients: { where: { isActive: true } },
        temperatureLogs: { take: 1, orderBy: { recordedAt: 'desc' } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getAlerts() {
    return this.prisma.coldStorageAlert.findMany({
      where: { isResolved: false },
      include: { unit: { select: { name: true, type: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const unit = await this.prisma.coldStorageUnit.findUnique({
      where: { id },
      include: {
        storageClients: { where: { isActive: true } },
        temperatureLogs: { take: 24, orderBy: { recordedAt: 'desc' } },
        alerts: { take: 10, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!unit) throw new NotFoundException('Cold storage unit not found');
    return unit;
  }

  async getTemperatureLogs(id: string, hours: number = 24) {
    const since = new Date();
    since.setHours(since.getHours() - hours);
    return this.prisma.temperatureLog.findMany({
      where: { unitId: id, recordedAt: { gte: since } },
      orderBy: { recordedAt: 'asc' },
    });
  }

  async create(dto: any) {
    return this.prisma.coldStorageUnit.create({ data: dto });
  }

  async logTemperature(unitId: string, dto: any) {
    const unit = await this.prisma.coldStorageUnit.findUnique({ where: { id: unitId } });
    if (!unit) throw new NotFoundException('Cold storage unit not found');

    const log = await this.prisma.temperatureLog.create({
      data: { unitId, ...dto },
    });

    const deviation = Math.abs(dto.temperature - unit.targetTemp);
    let newStatus: 'NORMAL' | 'WARNING' | 'CRITICAL' = 'NORMAL';
    if (deviation >= 5) newStatus = 'CRITICAL';
    else if (deviation >= 3) newStatus = 'WARNING';

    await this.prisma.coldStorageUnit.update({
      where: { id: unitId },
      data: { status: newStatus },
    });

    if (newStatus !== 'NORMAL') {
      const alertType = dto.temperature > unit.targetTemp ? 'TEMP_HIGH' : 'TEMP_LOW';
      await this.prisma.coldStorageAlert.create({
        data: {
          unitId,
          alertType,
          message: `Temperature deviation detected: ${dto.temperature}°C (target: ${unit.targetTemp}°C). Deviation: ${deviation.toFixed(1)}°C`,
          temperature: dto.temperature,
          severity: newStatus === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
        },
      });
    }

    return { log, unitStatus: newStatus, deviation };
  }
}
