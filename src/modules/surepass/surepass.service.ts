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
        `${this.baseUrl}/api/v1/rc/rc-full`,
        { id_number: regNumber },
        { headers: this.getHeaders(), timeout: 30000 },
      );

      this.logger.log('SurePass full response: ' + JSON.stringify(response.data?.data));
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

  /**
   * Full SurePass RC → app shape. Includes preview-only fields; Prisma saves use a subset in VehiclesService.
   * `fuelType` is enum-safe for DB; `fuelTypeRaw` is the original API string (e.g. PETROL/CNG).
   */
  private mapRCData(data: Record<string, unknown>) {
    const pn = this.pickStr(data, 'permit_number');
    const npn = this.pickStr(data, 'national_permit_number');
    const permitNum =
      pn && pn !== '0' ? pn : npn && npn.length ? npn : null;

    const gross =
      data.vehicle_gross_weight != null ? parseInt(String(data.vehicle_gross_weight), 10) : NaN;
    const unladen = data.unladen_weight != null ? parseInt(String(data.unladen_weight), 10) : NaN;
    const loadCap =
      !Number.isNaN(gross) && !Number.isNaN(unladen) ? gross - unladen : null;

    let year: number | null = null;
    const mfgFmt = this.pickStr(data, 'manufacturing_date_formatted');
    if (mfgFmt) {
      const y = parseInt(mfgFmt.split('-')[0], 10);
      year = Number.isNaN(y) ? null : y;
    }
    if (year == null) {
      const mfg = this.pickStr(data, 'manufacturing_date');
      if (mfg) year = this.extractYearFromMfgDate(mfg);
    }
    if (year == null && data.manufacturing_year != null) {
      const y = parseInt(String(data.manufacturing_year), 10);
      year = Number.isNaN(y) ? null : y;
    }

    const classStr =
      this.pickStr(data, 'vehicle_category_description', 'vehicle_category') ||
      this.pickStr(data, 'vehicle_class_description', 'class_of_vehicle') ||
      '';

    const fuelRaw = this.pickStr(data, 'fuel_type', 'fuel_description');

    return {
      ownerName: this.pickStr(data, 'owner_name', 'current_owner_name'),
      fatherName: this.pickStr(data, 'father_name'),
      ownerAddress: this.pickStr(data, 'present_address', 'permanent_address'),
      make: this.pickStr(data, 'maker_description', 'vehicle_manufacturer_name'),
      model: this.pickStr(data, 'maker_model', 'model'),
      vehicleClass: classStr || null,
      type: classStr ? this.inferVehicleType(classStr) : null,
      fuelTypeRaw: fuelRaw,
      fuelType: fuelRaw ? this.mapFuelType(fuelRaw) : null,
      color: this.pickStr(data, 'color', 'vehicle_colour'),
      bodyType: this.pickStr(data, 'body_type'),
      normsType: this.pickStr(data, 'norms_type', 'norms_description', 'emission_norms'),
      engineNumber: this.pickStr(data, 'vehicle_engine_number', 'engine_number'),
      chassisNumber: this.pickStr(data, 'vehicle_chasi_number', 'chassis_number', 'chasi_number'),
      cubicCapacity:
        data.cubic_capacity != null ? parseFloat(String(data.cubic_capacity)) || null : null,
      seatingCapacity:
        data.seat_capacity != null ? parseInt(String(data.seat_capacity), 10) || null : null,
      numberOfCylinders:
        data.no_cylinders != null ? parseInt(String(data.no_cylinders), 10) || null : null,
      wheelbase: data.wheelbase != null ? parseInt(String(data.wheelbase), 10) || null : null,
      grossVehicleWeight:
        data.vehicle_gross_weight != null
          ? parseInt(String(data.vehicle_gross_weight), 10) || null
          : data.gross_vehicle_weight != null
            ? parseInt(String(data.gross_vehicle_weight), 10) || null
            : null,
      unladenWeight:
        data.unladen_weight != null ? parseInt(String(data.unladen_weight), 10) || null : null,
      loadCapacityKg: loadCap,
      year,
      registrationDate: this.parseDate(this.pickStr(data, 'registration_date') ?? undefined),
      registrationAuthority: this.pickStr(data, 'registered_at', 'rto_name'),
      rcNumber: this.pickStr(data, 'rc_number', 'registration_number', 'reg_no'),
      financer: this.pickStr(data, 'financer'),
      financed: data.financed === true,
      insuranceCompany: this.pickStr(data, 'insurance_company', 'insurer_name', 'insurance_name'),
      insurancePolicyNumber: this.pickStr(data, 'insurance_policy_number', 'policy_number'),
      insuranceStartDate: this.parseDate(
        this.pickStr(data, 'insurance_start_date', 'insurance_from', 'policy_start_date') ?? undefined,
      ),
      insuranceType: this.pickStr(data, 'insurance_type', 'policy_type'),
      insuranceExpiryDate: this.parseDate(this.pickStr(data, 'insurance_upto', 'insurance_validity') ?? undefined),
      fitnessExpiryDate: this.parseDate(this.pickStr(data, 'fit_up_to', 'fitness_upto') ?? undefined),
      pucNumber: this.pickStr(data, 'pucc_number', 'puc_number'),
      pucIssueDate: this.parseDate(
        this.pickStr(data, 'pucc_issue_date', 'puc_issue_date', 'pucc_from') ?? undefined,
      ),
      pucExpiryDate: this.parseDate(this.pickStr(data, 'pucc_upto', 'puc_valid_upto') ?? undefined),
      taxExpiryDate: this.parseDate(
        this.pickStr(data, 'tax_upto', 'tax_paid_upto', 'road_tax_upto') ?? undefined,
      ),
      permitNumber: permitNum,
      permitExpiryDate: this.parseDate(
        this.pickStr(data, 'permit_valid_upto', 'national_permit_upto') ?? undefined,
      ),
      rcStatus: this.pickStr(data, 'rc_status', 'vehicle_status'),
      ownerCount:
        data.owner_number != null ? parseInt(String(data.owner_number), 10) || null : null,
    };
  }

  private pickStr(data: Record<string, unknown>, ...keys: string[]): string | null {
    for (const k of keys) {
      const v = data[k];
      if (v === null || v === undefined) continue;
      const s = String(v).trim();
      if (s.length) return s;
    }
    return null;
  }

  private extractYearFromMfgDate(dateStr: string): number | null {
    const parts = dateStr.split('/');
    if (parts.length === 2) {
      const y = parseInt(parts[1], 10);
      return Number.isNaN(y) ? null : y;
    }
    if (parts.length === 1) {
      const y = parseInt(parts[0], 10);
      return Number.isNaN(y) ? null : y;
    }
    return null;
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

  private inferVehicleType(vehicleClass: string): VehicleType {
    const cls = vehicleClass.toLowerCase();
    if (cls.includes('motor car') || (cls.includes('lmv') && cls.includes('car')))
      return VehicleType.VAN;
    if (cls.includes('car') || cls.includes('saloon') || cls.includes('sedan') || cls.includes('jeep'))
      return VehicleType.VAN;
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

  /**
   * Maps SurePass fuel strings to Prisma `FuelType` (no LPG enum — LPG maps to CNG).
   * Order matters: PETROL/CNG must resolve to CNG, not PETROL.
   */
  private mapFuelType(description: string): FuelType | null {
    const u = description.toUpperCase();
    if (u.includes('PETROL') && u.includes('CNG')) return FuelType.CNG;
    if (u.includes('CNG')) return FuelType.CNG;
    if (u.includes('LPG')) return FuelType.CNG;
    if (u.includes('DIESEL')) return FuelType.DIESEL;
    if (u.includes('PETROL')) return FuelType.PETROL;
    if (u.includes('ELECTRIC') || u.includes('BATTERY')) return FuelType.ELECTRIC;
    if (u.includes('HYBRID')) return FuelType.HYBRID;
    return null;
  }
}
