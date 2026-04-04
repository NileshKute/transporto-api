import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { FuelType, VehicleType } from '@prisma/client';

@Injectable()
export class SurepassService {
  private readonly logger = new Logger(SurepassService.name);
  private readonly baseUrl = process.env.SUREPASS_BASE_URL || 'https://sandbox.surepass.app';
  private readonly token = process.env.SUREPASS_API_TOKEN;

  private getHeaders() {
    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };
  }

  async verifyRC(vehicleNumber: string): Promise<any> {
    if (!this.token) {
      return { success: false, message: 'SUREPASS_API_TOKEN not configured' };
    }

    const regNumber = vehicleNumber.replace(/[\s\-]/g, '').toUpperCase();

    this.logger.log(`Verifying RC for: ${regNumber}`);

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/v1/identity/rc-text`,
        { id_number: regNumber },
        { headers: this.getHeaders(), timeout: 30000 },
      );

      this.logger.log(`RC verification response status: ${response.data?.status_code}`);

      if (response.data?.status_code === 200 && response.data?.data) {
        return {
          success: true,
          data: this.mapRCData(response.data.data),
          raw: response.data.data,
        };
      }

      return {
        success: false,
        message: response.data?.message || 'RC verification failed',
        raw: response.data,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`RC verification error: ${message}`);

      if (axios.isAxiosError(err)) {
        const ax = err as AxiosError<{ message?: string }>;
        if (ax.response) {
          const body = ax.response.data as { message?: string } | undefined;
          return {
            success: false,
            message: body?.message || `API error: ${ax.response.status}`,
            statusCode: ax.response.status,
          };
        }
      }

      throw err;
    }
  }

  async fetchChallans(vehicleNumber: string): Promise<any> {
    if (!this.token) {
      return { success: false, message: 'SUREPASS_API_TOKEN not configured' };
    }

    const regNumber = vehicleNumber.replace(/[\s\-]/g, '').toUpperCase();

    const paths = [
      '/api/v1/utility/rc-challan-advanced',
      '/api/v1/rc-challan-advanced',
    ] as const;

    let lastFailure: { success: false; message: string; statusCode?: number; raw?: unknown } = {
      success: false,
      message: 'Challan lookup failed',
    };

    for (const path of paths) {
      try {
        const response = await axios.post(
          `${this.baseUrl}${path}`,
          { id_number: regNumber },
          { headers: this.getHeaders(), timeout: 30000 },
        );

        if (response.data?.status_code === 200 && response.data?.data) {
          return {
            success: true,
            data: response.data.data,
          };
        }

        lastFailure = {
          success: false,
          message: response.data?.message || 'Challan lookup failed',
          raw: response.data,
        };
        this.logger.warn(`Challan lookup unsuccessful from ${path}: ${lastFailure.message}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Challan lookup error (${path}): ${message}`);
        if (axios.isAxiosError(err)) {
          const ax = err as AxiosError<{ message?: string }>;
          const body = ax.response?.data;
          lastFailure = {
            success: false,
            message: body?.message || message,
            statusCode: ax.response?.status,
          };
        } else {
          lastFailure = { success: false, message };
        }
      }
    }

    return lastFailure;
  }

  /** Maps SurePass RC payload to existing Prisma Vehicle scalar fields only. */
  private mapRCData(data: Record<string, unknown>) {
    const str = (k: string) => {
      const v = data[k];
      if (v === null || v === undefined) return null;
      const s = String(v).trim();
      return s.length ? s : null;
    };

    const classDesc = str('vehicle_class_description') || str('class_of_vehicle') || '';

    const fuelRaw = str('fuel_description') || str('fuel_type');
    const mappedFuel = fuelRaw ? this.mapFuelType(fuelRaw) : null;

    return {
      ownerName: str('owner_name') || str('current_owner_name'),
      make: str('maker_description') || str('vehicle_manufacturer_name'),
      model: str('maker_model') || str('model'),
      type: classDesc ? this.inferVehicleType(classDesc) : null,
      fuelType: mappedFuel,
      color: str('color') || str('vehicle_colour'),
      engineNumber: str('engine_number'),
      chassisNumber: str('chassis_number') || str('chasi_number'),
      year: data.manufacturing_date
        ? this.extractYear(String(data.manufacturing_date))
        : data.manufacturing_year != null
          ? parseInt(String(data.manufacturing_year), 10) || null
          : null,
      registrationDate: this.parseDate(str('registration_date')),
      pucExpiryDate: this.parseDate(str('pucc_upto') || str('puc_valid_upto')),
      pucNumber: str('pucc_number') || str('puc_number'),
      insuranceExpiryDate: this.parseDate(str('insurance_upto') || str('insurance_validity')),
      insuranceCompany: str('insurance_company') || str('insurer_name'),
      insurancePolicyNumber: str('insurance_policy_number'),
      fitnessExpiryDate: this.parseDate(str('fit_up_to') || str('fitness_upto')),
      taxExpiryDate: this.parseDate(str('tax_upto') || str('tax_paid_upto')),
      permitExpiryDate: this.parseDate(str('permit_valid_upto') || str('national_permit_upto')),
      permitNumber: str('permit_number') || str('national_permit_number'),
      loadCapacityKg:
        data.gross_vehicle_weight != null ? parseFloat(String(data.gross_vehicle_weight)) || null : null,
    };
  }

  private parseDate(dateStr: string | null | undefined): Date | null {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const s = dateStr.trim();
    if (!s) return null;

    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (iso) {
      const y = parseInt(iso[1], 10);
      const m = parseInt(iso[2], 10);
      const d = parseInt(iso[3], 10);
      return new Date(y, m - 1, d);
    }

    const parts = s.split(/[\-\/]/);
    if (parts.length === 3) {
      const a = parseInt(parts[0], 10);
      const b = parseInt(parts[1], 10);
      const c = parseInt(parts[2], 10);
      if (!Number.isNaN(a) && !Number.isNaN(b) && !Number.isNaN(c)) {
        if (parts[0].length === 4) {
          return new Date(a, b - 1, c);
        }
        if (c > 1000 && a <= 31 && b <= 12) {
          return new Date(c, b - 1, a);
        }
      }
    }

    const t = Date.parse(s);
    return Number.isNaN(t) ? null : new Date(t);
  }

  private extractYear(dateStr: string): number | null {
    const date = this.parseDate(dateStr);
    return date ? date.getFullYear() : null;
  }

  private inferVehicleType(vehicleClass: string): VehicleType {
    const cls = vehicleClass.toLowerCase();
    if (cls.includes('goods') || cls.includes('truck') || cls.includes('lorry')) return VehicleType.TRUCK;
    if (cls.includes('tractor') || cls.includes('trailer')) return VehicleType.TRAILER;
    if (cls.includes('reefer') || cls.includes('fridge') || cls.includes('refrigerat'))
      return VehicleType.REEFER_TRUCK;
    if (cls.includes('tank')) return VehicleType.TANKER;
    if (cls.includes('pickup')) return VehicleType.PICKUP;
    if (cls.includes('van')) return VehicleType.VAN;
    if (cls.includes('tempo') || cls.includes('three wheeler') || cls.includes('three-wheeler'))
      return VehicleType.TEMPO;
    if (cls.includes('container')) return VehicleType.CONTAINER;
    if (cls.includes('mini')) return VehicleType.MINI_TRUCK;
    return VehicleType.TRUCK;
  }

  private mapFuelType(description: string): FuelType | null {
    const u = description.toUpperCase();
    if (u.includes('PETROL')) return FuelType.PETROL;
    if (u.includes('CNG')) return FuelType.CNG;
    if (u.includes('ELECTRIC') || u.includes('BATTERY')) return FuelType.ELECTRIC;
    if (u.includes('HYBRID')) return FuelType.HYBRID;
    if (u.includes('DIESEL')) return FuelType.DIESEL;
    return null;
  }
}
