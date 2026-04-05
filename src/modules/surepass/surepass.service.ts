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
   * Full SurePass RC → app shape. `fuelType` is Prisma `FuelType`; `fuelTypeRaw` is the API string for UI.
   */
  private mapRCData(data: Record<string, unknown>) {
    const str = (...keys: string[]) => this.pickStr(data, ...keys);

    const pn = str('permit_number');
    const npn = str('national_permit_number');
    const permitNum =
      pn && pn !== '0' ? pn : npn && npn.length ? npn : null;

    const grossRaw = data.vehicle_gross_weight ?? data.gross_vehicle_weight;
    const unladenRaw = data.unladen_weight;
    const gross = grossRaw != null ? parseInt(String(grossRaw), 10) : NaN;
    const unladen = unladenRaw != null ? parseInt(String(unladenRaw), 10) : NaN;
    const loadCap =
      !Number.isNaN(gross) && !Number.isNaN(unladen) ? gross - unladen : null;

    let year: number | null = null;
    const mfgFmt = str('manufacturing_date_formatted');
    if (mfgFmt) {
      const y = parseInt(mfgFmt.split('-')[0], 10);
      year = Number.isNaN(y) ? null : y;
    }
    if (year == null) {
      const mfg = str('manufacturing_date');
      if (mfg) year = this.extractYearFromMfgDate(mfg);
    }
    if (year == null && data.manufacturing_year != null) {
      const y = parseInt(String(data.manufacturing_year), 10);
      year = Number.isNaN(y) ? null : y;
    }

    const classDesc =
      str('vehicle_category_description') ||
      str('vehicle_category') ||
      str('vehicle_class_description') ||
      str('class_of_vehicle') ||
      '';

    const makerModelForType = str('maker_model', 'model') || '';
    const bodyTypeForType = str('body_type') || '';

    const fuelRaw = str('fuel_type', 'fuel_description');

    const cubicStr =
      data.cubic_capacity != null && String(data.cubic_capacity).trim() !== ''
        ? String(data.cubic_capacity).trim()
        : null;

    return {
      ownerName: str('owner_name', 'current_owner_name'),
      fatherName: str('father_name'),
      ownerAddress: str('present_address', 'permanent_address'),
      ownerCount:
        data.owner_number != null ? parseInt(String(data.owner_number), 10) || null : null,

      make: str('maker_description', 'vehicle_manufacturer_name'),
      model: str('maker_model', 'model'),
      variant: str('variant'),
      fuelTypeRaw: fuelRaw,
      fuelType: this.mapFuelType(fuelRaw),
      color: str('color', 'vehicle_colour'),
      engineNumber: str('vehicle_engine_number', 'engine_number'),
      chassisNumber: str('vehicle_chasi_number', 'chassis_number', 'chasi_number'),

      bodyType: str('body_type'),
      normsType: str('norms_type', 'norms_description', 'emission_norms'),
      cubicCapacity: cubicStr,
      numberOfCylinders:
        data.no_cylinders != null ? parseInt(String(data.no_cylinders), 10) || null : null,
      seatingCapacity:
        data.seat_capacity != null ? parseInt(String(data.seat_capacity), 10) || null : null,
      sleeperCapacity:
        data.sleeper_capacity != null ? parseInt(String(data.sleeper_capacity), 10) || null : null,
      standingCapacity:
        data.standing_capacity != null ? parseInt(String(data.standing_capacity), 10) || null : null,
      wheelbase: data.wheelbase != null ? parseInt(String(data.wheelbase), 10) || null : null,
      unladenWeight: !Number.isNaN(unladen) ? unladen : null,
      grossVehicleWeight: !Number.isNaN(gross) ? gross : null,
      loadCapacityKg: loadCap,

      year,
      registrationDate: this.parseDate(str('registration_date') ?? undefined),
      registrationAuthority: str('registered_at', 'rto_name'),
      rcNumber: str('rc_number', 'registration_number', 'reg_no'),
      vehicleCategory: str('vehicle_category'),
      vehicleClassDesc: str(
        'vehicle_category_description',
        'vehicle_class_description',
        'class_of_vehicle',
      ),
      rcStatus: str('rc_status', 'vehicle_status'),

      financer: str('financer'),
      isFinanced: typeof data.financed === 'boolean' ? data.financed : null,

      insuranceCompany: str('insurance_company', 'insurer_name', 'insurance_name'),
      insurancePolicyNumber: str('insurance_policy_number', 'policy_number'),
      insuranceExpiryDate: this.parseDate(str('insurance_upto', 'insurance_validity') ?? undefined),
      insuranceStartDate: this.parseDate(
        str('insurance_start_date', 'insurance_from', 'policy_start_date') ?? undefined,
      ),
      insuranceType: str('insurance_type', 'policy_type'),

      fitnessExpiryDate: this.parseDate(str('fit_up_to', 'fitness_upto') ?? undefined),

      pucNumber: str('pucc_number', 'puc_number'),
      pucExpiryDate: this.parseDate(str('pucc_upto', 'puc_valid_upto') ?? undefined),
      pucIssueDate: this.parseDate(str('pucc_issue_date', 'puc_issue_date', 'pucc_from') ?? undefined),

      taxReceiptNumber: str('tax_receipt_number', 'tax_receipt_no', 'road_tax_receipt'),
      taxExpiryDate: this.parseDate(str('tax_upto', 'tax_paid_upto', 'road_tax_upto') ?? undefined),

      permitNumber: permitNum,
      permitExpiryDate: this.parseDate(str('permit_valid_upto', 'national_permit_upto') ?? undefined),
      permitType: str('permit_type'),
      permitIssueDate: this.parseDate(str('permit_issue_date') ?? undefined),
      permitValidFrom: this.parseDate(str('permit_valid_from') ?? undefined),

      blacklistStatus: str('blacklist_status'),
      nonUseStatus: str('non_use_status'),
      nonUseFrom: this.parseDate(str('non_use_from') ?? undefined),
      nonUseTo: this.parseDate(str('non_use_to') ?? undefined),
      nocDetails: str('noc_details'),

      type:
        classDesc || makerModelForType || bodyTypeForType
          ? this.inferVehicleType(classDesc, makerModelForType, bodyTypeForType)
          : null,
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
    if (!dateStr || typeof dateStr !== 'string') return null;
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

  private inferVehicleType(
    vehicleClass: string,
    makerModel = '',
    bodyType = '',
  ): VehicleType {
    const mmU = makerModel.toUpperCase();
    const btU = bodyType.toUpperCase();
    const bodyIsReefer = btU.includes('REFER') || btU.includes('REEFER');
    if (mmU.includes('PICKUP') && bodyIsReefer) return VehicleType.REEFER_PICKUP;
    if (bodyIsReefer) return VehicleType.REEFER_TRUCK;

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
   * Maps SurePass fuel strings to Prisma `FuelType`. Combined fuels checked first; default DIESEL.
   * LPG → CNG (no LPG in enum).
   */
  private mapFuelType(raw: string | null | undefined): FuelType {
    if (!raw || !String(raw).trim()) return FuelType.DIESEL;
    const upper = String(raw).toUpperCase().trim();
    if (upper.includes('PETROL') && upper.includes('CNG')) return FuelType.CNG;
    if (upper.includes('DIESEL') && upper.includes('CNG')) return FuelType.CNG;
    if (upper.includes('CNG')) return FuelType.CNG;
    if (upper.includes('ELECTRIC') || upper.includes('BATTERY')) return FuelType.ELECTRIC;
    if (upper.includes('HYBRID')) return FuelType.HYBRID;
    if (upper.includes('PETROL')) return FuelType.PETROL;
    if (upper.includes('DIESEL')) return FuelType.DIESEL;
    if (upper.includes('LPG')) return FuelType.CNG;
    return FuelType.DIESEL;
  }
}
