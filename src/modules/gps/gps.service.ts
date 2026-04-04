import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

interface GeoTrackerVehicle {
  speed?: number;
  direction?: number;
  haltedSince?: string;
  elevation?: number;
  timestamp?: number;
  locStr?: string;
  noDataSince?: string;
  lattitude?: number;
  analogData?: string;
  movingSince?: string;
  longitude?: number;
  regNo?: string;
  bmStr?: string;
  Temperature?: number;
}

/** Normalized row used for API + DB writes */
export interface ParsedGpsPing {
  geoTrackerKey: string;
  regNumber: string;
  latitude: number;
  longitude: number;
  speed: number;
  direction: number;
  temperature: number | null;
  ignitionOn: boolean;
  acOn: boolean;
  doorOpen: boolean;
  status: string;
  haltedSince: string | null;
  movingSince: string | null;
  noDataSince: string | null;
  location: string | null;
  elevation: number | null;
  bmStr: string | null;
  rawAnalogData: string | null;
  deviceTimestamp: Date | null;
}

@Injectable()
export class GpsService {
  private readonly logger = new Logger(GpsService.name);
  private isSyncing = false;

  constructor(private prisma: PrismaService) {}

  async fetchFromGeoTrackers(): Promise<ParsedGpsPing[]> {
    const username = process.env.GEOTRACKERS_USERNAME;
    const password = process.env.GEOTRACKERS_PASSWORD;
    const apiUrl = process.env.GEOTRACKERS_API_URL;

    if (!username || !password || !apiUrl) {
      throw new Error('GeoTrackers credentials not configured');
    }

    const credentials = Buffer.from(`${username}:${password}`).toString(
      'base64',
    );

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: { Authorization: `Basic ${credentials}` },
    });

    if (!response.ok) {
      throw new Error(`GeoTrackers API error: ${response.status}`);
    }

    const data: unknown = await response.json();

    if (Array.isArray(data) && data[0] && typeof data[0] === 'object') {
      const first = data[0] as Record<string, unknown>;
      if (first.status === 'fail') {
        throw new Error(String(first.message ?? 'GeoTrackers request failed'));
      }
    }

    const vehicles: ParsedGpsPing[] = [];

    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      for (const [key, value] of Object.entries(data)) {
        const vehicleArr = value as GeoTrackerVehicle[] | undefined;
        if (vehicleArr && vehicleArr.length > 0) {
          vehicles.push(this.parseVehicleData(key, vehicleArr[0]));
        }
      }
    } else if (Array.isArray(data)) {
      for (const item of data) {
        if (item && typeof item === 'object' && 'regNo' in item) {
          const row = item as GeoTrackerVehicle & { regNo: string };
          vehicles.push(this.parseVehicleData(row.regNo, row));
        }
      }
    }

    return vehicles;
  }

  private parseVehicleData(key: string, v: GeoTrackerVehicle): ParsedGpsPing {
    let temperature: number | null = null;
    if (v.analogData) {
      const tempMatch = v.analogData.match(/Temperature\s*([-\d.]+)/i);
      if (tempMatch) temperature = parseFloat(tempMatch[1]);
    }
    if (v.Temperature != null && temperature === null) {
      temperature = v.Temperature;
    }

    const speed = v.speed ?? 0;
    const ignitionOn =
      v.bmStr?.toLowerCase().includes('key on') ||
      speed > 0 ||
      (v.movingSince != null && v.movingSince !== '0 sec');
    const acOn = v.bmStr?.toLowerCase().includes('ac on') || false;
    const doorOpen = v.bmStr?.toLowerCase().includes('door open') || false;

    let status = 'UNKNOWN';
    if (speed > 0) {
      status = 'MOVING';
    } else if (v.haltedSince && v.haltedSince !== '0 sec') {
      status = 'HALTED';
    } else if (v.bmStr?.includes('Long Halt')) {
      status = 'LONG_HALT';
    } else {
      status = 'IDLE';
    }

    const noDataStr = v.noDataSince || '';
    const isOffline =
      noDataStr.includes('days') || noDataStr.includes('hrs');
    if (isOffline) {
      status = 'OFFLINE';
    }

    let regNumber = (v.regNo || key).replace(/^CUST-/i, '').trim();
    if (!regNumber) regNumber = key;

    const lat = v.lattitude;
    const lng = v.longitude;
    const latitude =
      typeof lat === 'number' && !Number.isNaN(lat) ? lat : 0;
    const longitude =
      typeof lng === 'number' && !Number.isNaN(lng) ? lng : 0;

    const direction = Math.round(v.direction ?? 0);

    return {
      geoTrackerKey: key,
      regNumber,
      latitude,
      longitude,
      speed,
      direction,
      temperature,
      ignitionOn,
      acOn,
      doorOpen,
      status,
      haltedSince: v.haltedSince || null,
      movingSince: v.movingSince || null,
      noDataSince: v.noDataSince || null,
      location: v.locStr || null,
      elevation: v.elevation ?? null,
      bmStr: v.bmStr || null,
      rawAnalogData: v.analogData || null,
      deviceTimestamp: v.timestamp ? new Date(v.timestamp) : null,
    };
  }

  @Cron('*/30 * * * * *')
  async autoSync(): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const vehicles = await this.fetchFromGeoTrackers();
      const now = new Date();

      for (const v of vehicles) {
        const dbVehicle = await this.findVehicleByReg(v.regNumber);
        const vehicleId = dbVehicle?.id ?? null;

        await this.prisma.gpsLive.upsert({
          where: { geoTrackerKey: v.geoTrackerKey },
          update: {
            vehicleId,
            regNumber: v.regNumber,
            latitude: v.latitude,
            longitude: v.longitude,
            speed: v.speed,
            direction: v.direction,
            temperature: v.temperature,
            ignitionOn: v.ignitionOn,
            acOn: v.acOn,
            doorOpen: v.doorOpen,
            status: v.status,
            haltedSince: v.haltedSince,
            movingSince: v.movingSince,
            noDataSince: v.noDataSince,
            location: v.location,
            elevation: v.elevation,
            bmStr: v.bmStr,
            rawAnalogData: v.rawAnalogData,
            deviceTimestamp: v.deviceTimestamp,
            lastSyncAt: now,
          },
          create: {
            vehicleId,
            geoTrackerKey: v.geoTrackerKey,
            regNumber: v.regNumber,
            latitude: v.latitude,
            longitude: v.longitude,
            speed: v.speed,
            direction: v.direction,
            temperature: v.temperature,
            ignitionOn: v.ignitionOn,
            acOn: v.acOn,
            doorOpen: v.doorOpen,
            status: v.status,
            haltedSince: v.haltedSince,
            movingSince: v.movingSince,
            noDataSince: v.noDataSince,
            location: v.location,
            elevation: v.elevation,
            bmStr: v.bmStr,
            rawAnalogData: v.rawAnalogData,
            deviceTimestamp: v.deviceTimestamp,
            lastSyncAt: now,
          },
        });

        await this.prisma.gpsHistory.create({
          data: {
            vehicleId,
            geoTrackerKey: v.geoTrackerKey,
            regNumber: v.regNumber,
            latitude: v.latitude,
            longitude: v.longitude,
            speed: v.speed,
            direction: v.direction,
            temperature: v.temperature,
            ignitionOn: v.ignitionOn,
            acOn: v.acOn,
            status: v.status,
            haltedSince: v.haltedSince,
            movingSince: v.movingSince,
            location: v.location,
            bmStr: v.bmStr,
            rawAnalogData: v.rawAnalogData,
            deviceTimestamp: v.deviceTimestamp,
            recordedAt: now,
          },
        });

        if (dbVehicle) {
          await this.prisma.vehicle.update({
            where: { id: dbVehicle.id },
            data: {
              lastLatitude: v.latitude,
              lastLongitude: v.longitude,
              lastSpeed: v.speed,
              lastTemperature: v.temperature,
              lastGpsUpdate: now,
              gpsStatus: v.status,
            },
          });
        }
      }

      this.logger.log(`GPS sync complete: ${vehicles.length} vehicles`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`GPS auto-sync failed: ${msg}`);
    } finally {
      this.isSyncing = false;
    }
  }

  private async findVehicleByReg(regDisplay: string) {
    const variations = [
      regDisplay,
      regDisplay.replace(/[\s-]/g, ''),
    ].filter((s) => s && s.trim().length > 0);

    for (const regNum of variations) {
      const found = await this.prisma.vehicle.findFirst({
        where: {
          isDeleted: false,
          regNumber: {
            contains: regNum.trim(),
            mode: 'insensitive',
          },
        },
      });
      if (found) return found;
    }
    return null;
  }

  async getLiveData() {
    const vehicles = await this.prisma.gpsLive.findMany({
      include: {
        vehicle: {
          select: { id: true, regNumber: true, make: true, model: true },
        },
      },
      orderBy: { regNumber: 'asc' },
    });

    return {
      vehicleCount: vehicles.length,
      moving: vehicles.filter((x) => x.status === 'MOVING').length,
      halted: vehicles.filter(
        (x) => x.status === 'HALTED' || x.status === 'LONG_HALT',
      ).length,
      offline: vehicles.filter((x) => x.status === 'OFFLINE').length,
      idle: vehicles.filter((x) => x.status === 'IDLE').length,
      vehicles,
      fetchedAt: new Date().toISOString(),
    };
  }

  async getHistory(
    vehicleId: string,
    startDate: string,
    endDate: string,
    page = 1,
    limit = 100,
  ) {
    const end = this.endOfDayUtc(endDate);
    const where: Record<string, unknown> = {
      recordedAt: {
        gte: new Date(startDate),
        lte: end,
      },
    };

    if (/^[0-9a-f-]{36}$/i.test(vehicleId)) {
      where.vehicleId = vehicleId;
    } else {
      where.regNumber = { contains: vehicleId, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.prisma.gpsHistory.findMany({
        where,
        orderBy: { recordedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.gpsHistory.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async getRouteTrail(vehicleId: string, startDate: string, endDate: string) {
    const end = this.endOfDayUtc(endDate);
    const where: Record<string, unknown> = {
      recordedAt: {
        gte: new Date(startDate),
        lte: end,
      },
    };

    if (/^[0-9a-f-]{36}$/i.test(vehicleId)) {
      where.vehicleId = vehicleId;
    } else {
      where.regNumber = { contains: vehicleId, mode: 'insensitive' };
    }

    const points = await this.prisma.gpsHistory.findMany({
      where,
      select: {
        latitude: true,
        longitude: true,
        speed: true,
        temperature: true,
        status: true,
        location: true,
        recordedAt: true,
      },
      orderBy: { recordedAt: 'asc' },
    });

    return { points, totalPoints: points.length };
  }

  private endOfDayUtc(endDate: string): Date {
    if (/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return new Date(`${endDate}T23:59:59.999Z`);
    }
    return new Date(endDate);
  }

  async createShareSession(
    vehicleId: string,
    clientId?: string,
    label?: string,
    expiresInHours?: number,
  ) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, isDeleted: false },
    });
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    if (clientId) {
      const client = await this.prisma.client.findUnique({
        where: { id: clientId },
      });
      if (!client) {
        throw new BadRequestException('Client not found');
      }
    }

    const expiresAt =
      expiresInHours != null && expiresInHours > 0
        ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
        : null;

    const session = await this.prisma.gpsShareSession.create({
      data: {
        vehicleId,
        clientId: clientId ?? null,
        label: label ?? null,
        expiresAt,
        isActive: true,
      },
    });

    return {
      ...session,
      shareUrl: `/track/${session.token}`,
    };
  }

  async getSharedLiveData(token: string) {
    const session = await this.prisma.gpsShareSession.findUnique({
      where: { token },
      include: {
        vehicle: { select: { regNumber: true, make: true, model: true } },
        client: { select: { name: true } },
      },
    });

    if (!session) {
      throw new NotFoundException('Share link not found');
    }
    if (!session.isActive) {
      throw new BadRequestException('Share link is no longer active');
    }
    if (session.expiresAt && session.expiresAt < new Date()) {
      await this.prisma.gpsShareSession.update({
        where: { id: session.id },
        data: { isActive: false },
      });
      throw new BadRequestException('Share link has expired');
    }

    let liveData = await this.prisma.gpsLive.findFirst({
      where: { vehicleId: session.vehicleId },
    });

    if (!liveData) {
      const reg = session.vehicle.regNumber.replace(/[\s-]/g, '');
      liveData = await this.prisma.gpsLive.findFirst({
        where: {
          OR: [
            {
              regNumber: {
                contains: session.vehicle.regNumber,
                mode: 'insensitive',
              },
            },
            { regNumber: { contains: reg, mode: 'insensitive' } },
          ],
        },
      });
    }

    return {
      vehicle: session.vehicle,
      client: session.client,
      label: session.label,
      live: liveData,
      expiresAt: session.expiresAt,
    };
  }

  async stopShareSession(sessionId: string) {
    const existing = await this.prisma.gpsShareSession.findUnique({
      where: { id: sessionId },
    });
    if (!existing) {
      throw new NotFoundException('Share session not found');
    }
    return this.prisma.gpsShareSession.update({
      where: { id: sessionId },
      data: { isActive: false },
    });
  }

  async listShareSessions() {
    return this.prisma.gpsShareSession.findMany({
      where: { isActive: true },
      include: {
        vehicle: { select: { regNumber: true } },
        client: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
