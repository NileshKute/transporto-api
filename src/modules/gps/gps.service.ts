import { Injectable, Logger } from '@nestjs/common';
import { VehicleType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

interface GeoTrackerVehicle {
  systime?: number;
  exceptionBM?: number;
  virtualName?: string;
  speed?: number;
  direction?: number;
  haltedSince?: string;
  elevation?: number;
  timestamp?: number;
  distance?: number;
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

export interface ParsedGpsVehicle {
  geoTrackerKey: string;
  regNumber: string;
  regNumberAlt: string;
  latitude: number | null;
  longitude: number | null;
  speed: number;
  direction: number;
  temperature: number | null;
  ignitionOn: boolean;
  status: string;
  haltedSince: string | null;
  movingSince: string | null;
  noDataSince: string | null;
  location: string | null;
  elevation: number | null;
  bmStr: string | null;
  acOn: boolean;
  doorOpen: boolean;
  lastUpdated: string | null;
  rawAnalogData: string | null;
}

@Injectable()
export class GpsService {
  private readonly logger = new Logger(GpsService.name);

  constructor(private prisma: PrismaService) {}

  async fetchLiveLocations(): Promise<{
    success: boolean;
    vehicleCount: number;
    vehicles: ParsedGpsVehicle[];
    fetchedAt: string;
  }> {
    const username = process.env.GEOTRACKERS_USERNAME;
    const password = process.env.GEOTRACKERS_PASSWORD;
    const apiUrl = process.env.GEOTRACKERS_API_URL;

    if (!username || !password || !apiUrl) {
      throw new Error('GeoTrackers credentials not configured');
    }

    const credentials = Buffer.from(`${username}:${password}`).toString(
      'base64',
    );

    try {
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          Authorization: `Basic ${credentials}`,
        },
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

      const vehicles: ParsedGpsVehicle[] = [];

      if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
        for (const [key, value] of Object.entries(data)) {
          const vehicleArr = value as GeoTrackerVehicle[] | undefined;
          if (vehicleArr && vehicleArr.length > 0) {
            const v = vehicleArr[0];
            vehicles.push(this.parseVehicleData(key, v));
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

      return {
        success: true,
        vehicleCount: vehicles.length,
        vehicles,
        fetchedAt: new Date().toISOString(),
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`GeoTrackers API fetch failed: ${msg}`);
      throw error;
    }
  }

  private parseVehicleData(key: string, v: GeoTrackerVehicle): ParsedGpsVehicle {
    let temperature: number | null = null;
    if (v.analogData) {
      const tempMatch = v.analogData.match(/Temperature\s*([-\d.]+)/i);
      if (tempMatch) {
        temperature = parseFloat(tempMatch[1]);
      }
    }
    if (v.Temperature != null && temperature === null) {
      temperature = v.Temperature;
    }

    const speed = v.speed ?? 0;
    const ignitionOn =
      v.bmStr?.toLowerCase().includes('key on') ||
      speed > 0 ||
      (v.movingSince != null && v.movingSince !== '0 sec');

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

    let regNumber = v.regNo || key;
    regNumber = regNumber
      .replace(/^CUST-/i, '')
      .replace(/^[A-Z]+-/i, '');
    const keyClean = key
      .replace(/^CUST-/i, '')
      .replace(/^[A-Z]+-/i, '');

    const lat = v.lattitude ?? null;
    const lng = v.longitude ?? null;

    return {
      geoTrackerKey: key,
      regNumber,
      regNumberAlt: keyClean,
      latitude: lat,
      longitude: lng,
      speed,
      direction: v.direction ?? 0,
      temperature,
      ignitionOn,
      status,
      haltedSince: v.haltedSince || null,
      movingSince: v.movingSince || null,
      noDataSince: v.noDataSince || null,
      location: v.locStr || null,
      elevation: v.elevation ?? null,
      bmStr: v.bmStr || null,
      acOn: v.bmStr?.toLowerCase().includes('ac on') || false,
      doorOpen: v.bmStr?.toLowerCase().includes('door open') || false,
      lastUpdated: v.timestamp
        ? new Date(v.timestamp).toISOString()
        : null,
      rawAnalogData: v.analogData || null,
    };
  }

  async syncVehicles(): Promise<
    Awaited<ReturnType<GpsService['fetchLiveLocations']>> & {
      sync: {
        total: number;
        matched: number;
        created: number;
        unmatched: string[];
      };
    }
  > {
    const liveData = await this.fetchLiveLocations();

    const syncResults = {
      total: liveData.vehicles.length,
      matched: 0,
      created: 0,
      unmatched: [] as string[],
    };

    for (const gpsVehicle of liveData.vehicles) {
      const regVariations = [
        gpsVehicle.regNumber,
        gpsVehicle.regNumberAlt,
        gpsVehicle.regNumber.replace(/[\s-]/g, ''),
        gpsVehicle.regNumberAlt.replace(/[\s-]/g, ''),
      ].filter((s) => s && String(s).trim().length > 0);

      let dbVehicle = null;
      for (const regNum of regVariations) {
        dbVehicle = await this.prisma.vehicle.findFirst({
          where: {
            isDeleted: false,
            regNumber: {
              contains: regNum.trim(),
              mode: 'insensitive',
            },
          },
        });
        if (dbVehicle) break;
      }

      const gpsUpdate = {
        lastLatitude: gpsVehicle.latitude,
        lastLongitude: gpsVehicle.longitude,
        lastSpeed: gpsVehicle.speed,
        lastTemperature: gpsVehicle.temperature,
        lastGpsUpdate: new Date(),
        gpsStatus: gpsVehicle.status,
      };

      if (dbVehicle) {
        await this.prisma.vehicle.update({
          where: { id: dbVehicle.id },
          data: gpsUpdate,
        });
        syncResults.matched++;
      } else {
        const normalizedReg = this.normalizeRegNumber(gpsVehicle.regNumber);
        try {
          await this.prisma.vehicle.create({
            data: {
              regNumber: normalizedReg,
              type: VehicleType.TRUCK,
              make: 'Unknown',
              model: 'Unknown',
              year: new Date().getFullYear(),
              fuelType: 'DIESEL',
              status: 'ACTIVE',
              currentKm: 0,
              ...gpsUpdate,
            },
          });
          syncResults.created++;
        } catch {
          syncResults.unmatched.push(gpsVehicle.regNumber || gpsVehicle.geoTrackerKey);
        }
      }
    }

    return {
      ...liveData,
      sync: syncResults,
    };
  }

  /** Prisma regNumber max 20 chars, unique */
  private normalizeRegNumber(regDisplay: string): string {
    const cleaned = regDisplay.replace(/[\s-]/g, '').toUpperCase();
    return cleaned.slice(0, 20) || `X${Date.now().toString(36).toUpperCase()}`.slice(0, 20);
  }
}
