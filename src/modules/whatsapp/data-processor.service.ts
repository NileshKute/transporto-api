import { Injectable } from '@nestjs/common';
import { FuelType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DataProcessorService {
  constructor(private prisma: PrismaService) {}

  async processOcrResult(
    ocrData: Record<string, unknown> | null,
    senderPhone: string,
  ): Promise<string> {
    if (!ocrData || ocrData.type === 'ERROR') {
      const err =
        typeof ocrData?.error === 'string'
          ? ocrData.error
          : 'OCR failed';
      return `❌ Could not read the document (${err}). Please try a clearer photo.\n\nSupported: PUC, Insurance, RC Book, License, Fuel Receipt, Speedometer`;
    }

    if (ocrData.type === 'UNKNOWN') {
      return `❌ Could not identify the document. Please send a clearer photo.\n\nSupported: PUC, Insurance, RC Book, License, Fuel Receipt, Speedometer`;
    }

    try {
      switch (ocrData.type) {
        case 'PUC':
          return await this.processPuc(ocrData);
        case 'INSURANCE':
          return await this.processInsurance(ocrData);
        case 'RC_BOOK':
          return await this.processRcBook(ocrData);
        case 'LICENSE':
          return await this.processLicense(ocrData, senderPhone);
        case 'FUEL':
          return await this.processFuel(ocrData, senderPhone);
        case 'SPEEDOMETER':
          return await this.processSpeedometer(ocrData);
        default:
          return `❌ Unknown document type: ${String(ocrData.type)}`;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return `❌ Error processing ${String(ocrData.type)}: ${msg}`;
    }
  }

  private async processPuc(data: Record<string, unknown>): Promise<string> {
    const vehicleNumber = this.str(data.vehicleNumber);
    if (!vehicleNumber) {
      return '❌ Vehicle number not found in PUC. Please send clearer photo.';
    }

    let vehicle = await this.findVehicleByNumber(vehicleNumber);
    if (!vehicle) {
      vehicle = await this.prisma.vehicle.create({
        data: this.stubVehicleCreate(vehicleNumber, {
          pucNumber: this.str(data.pucNumber) || null,
          pucIssueDate: this.parseDate(this.str(data.issueDate)),
          pucExpiryDate: this.parseDate(this.str(data.expiryDate)),
        }),
      });
      return `✅ *New Vehicle + PUC Created*\n\n🚛 Vehicle: ${vehicleNumber}\n📋 PUC: ${this.str(data.pucNumber) || 'N/A'}\n📅 Expiry: ${this.str(data.expiryDate) || 'N/A'}\n${data.emissionResult ? '🔬 Result: ' + String(data.emissionResult) : ''}`;
    }

    await this.prisma.vehicle.update({
      where: { id: vehicle.id },
      data: {
        pucNumber: this.str(data.pucNumber) || null,
        pucIssueDate: this.parseDate(this.str(data.issueDate)),
        pucExpiryDate: this.parseDate(this.str(data.expiryDate)),
      },
    });

    return `✅ *PUC Updated*\n\n🚛 Vehicle: ${vehicleNumber}\n📋 PUC No: ${this.str(data.pucNumber) || 'N/A'}\n📅 Expiry: ${this.str(data.expiryDate) || 'N/A'}\n${data.emissionResult ? '🔬 Result: ' + String(data.emissionResult) : ''}`;
  }

  private async processInsurance(
    data: Record<string, unknown>,
  ): Promise<string> {
    const vehicleNumber = this.str(data.vehicleNumber);
    if (!vehicleNumber) {
      return '❌ Vehicle number not found in Insurance. Please send clearer photo.';
    }

    let vehicle = await this.findVehicleByNumber(vehicleNumber);
    if (!vehicle) {
      vehicle = await this.prisma.vehicle.create({
        data: this.stubVehicleCreate(vehicleNumber, {
          insurancePolicyNumber: this.str(data.policyNumber) || null,
          insuranceCompany: this.str(data.company) || null,
          insuranceStartDate: this.parseDate(this.str(data.startDate)),
          insuranceExpiryDate: this.parseDate(this.str(data.expiryDate)),
          insuranceType: this.str(data.insuranceType) || null,
        }),
      });
      return `✅ *New Vehicle + Insurance Created*\n\n🚛 Vehicle: ${vehicleNumber}\n📋 Policy: ${this.str(data.policyNumber) || 'N/A'}\n🏢 Company: ${this.str(data.company) || 'N/A'}\n📅 Expiry: ${this.str(data.expiryDate) || 'N/A'}\n💰 Premium: ₹${data.premium ?? 'N/A'}`;
    }

    await this.prisma.vehicle.update({
      where: { id: vehicle.id },
      data: {
        insurancePolicyNumber: this.str(data.policyNumber) || null,
        insuranceCompany: this.str(data.company) || null,
        insuranceStartDate: this.parseDate(this.str(data.startDate)),
        insuranceExpiryDate: this.parseDate(this.str(data.expiryDate)),
        insuranceType: this.str(data.insuranceType) || null,
      },
    });

    return `✅ *Insurance Updated*\n\n🚛 Vehicle: ${vehicleNumber}\n📋 Policy: ${this.str(data.policyNumber) || 'N/A'}\n🏢 Company: ${this.str(data.company) || 'N/A'}\n📅 Expiry: ${this.str(data.expiryDate) || 'N/A'}\n💰 Premium: ₹${data.premium ?? 'N/A'}`;
  }

  private async processRcBook(data: Record<string, unknown>): Promise<string> {
    const vehicleNumber = this.str(data.vehicleNumber);
    if (!vehicleNumber) {
      return '❌ Vehicle number not found in RC. Please send clearer photo.';
    }

    let vehicle = await this.findVehicleByNumber(vehicleNumber);

    if (vehicle) {
      await this.prisma.vehicle.update({
        where: { id: vehicle.id },
        data: {
          make: this.str(data.make) || vehicle.make,
          model: this.str(data.model) || vehicle.model,
          color: this.str(data.color) ?? vehicle.color,
          engineNumber: this.str(data.engineNumber) ?? vehicle.engineNumber,
          chassisNumber: this.str(data.chassisNumber) ?? vehicle.chassisNumber,
          fuelType:
            this.mapVehicleFuelType(data.fuelType) ?? vehicle.fuelType,
          ownerName: this.str(data.ownerName) ?? vehicle.ownerName,
          registrationDate:
            this.parseDate(this.str(data.registrationDate)) ??
            vehicle.registrationDate,
        },
      });
      return `✅ *RC Book Updated*\n\n🚛 Vehicle: ${vehicleNumber}\n🏭 Make: ${this.str(data.make) || 'N/A'}\n📋 Model: ${this.str(data.model) || 'N/A'}\n🎨 Color: ${this.str(data.color) || 'N/A'}\n🔧 Engine: ${this.str(data.engineNumber) || 'N/A'}`;
    }

    vehicle = await this.prisma.vehicle.create({
      data: this.stubVehicleCreate(vehicleNumber, {
        make: this.str(data.make) || 'Unknown',
        model: this.str(data.model) || 'Unknown',
        color: this.str(data.color) || null,
        engineNumber: this.str(data.engineNumber) || null,
        chassisNumber: this.str(data.chassisNumber) || null,
        fuelType: this.mapVehicleFuelType(data.fuelType) ?? 'DIESEL',
        ownerName: this.str(data.ownerName) || null,
        registrationDate: this.parseDate(this.str(data.registrationDate)),
        year: this.yearFromRcData(data),
      }),
    });
    return `✅ *New Vehicle Created from RC*\n\n🚛 Vehicle: ${vehicleNumber}\n🏭 Make: ${this.str(data.make) || 'N/A'}\n📋 Model: ${this.str(data.model) || 'N/A'}\n🎨 Color: ${this.str(data.color) || 'N/A'}\n🔧 Engine: ${this.str(data.engineNumber) || 'N/A'}\n📐 Chassis: ${this.str(data.chassisNumber) || 'N/A'}`;
  }

  private async processLicense(
    data: Record<string, unknown>,
    senderPhone: string,
  ): Promise<string> {
    if (!this.str(data.licenseNumber) && !this.str(data.name)) {
      return '❌ Could not read license details. Please send clearer photo.';
    }

    let driver = null;
    const lic = this.str(data.licenseNumber);
    if (lic) {
      driver = await this.prisma.driver.findFirst({
        where: { licenseNumber: lic, isDeleted: false },
      });
    }
    const name = this.str(data.name);
    if (!driver && name) {
      driver = await this.prisma.driver.findFirst({
        where: { name: { contains: name, mode: 'insensitive' }, isDeleted: false },
      });
    }

    if (driver) {
      const expiry = this.licenseExpiryFromData(data);
      const dob = this.parseDate(this.str(data.dateOfBirth));
      await this.prisma.driver.update({
        where: { id: driver.id },
        data: {
          licenseNumber: lic || driver.licenseNumber,
          licenseExpiry: expiry,
          dateOfBirth: dob ?? driver.dateOfBirth,
          bloodGroup: this.str(data.bloodGroup) ?? driver.bloodGroup,
          address: this.str(data.address) ?? driver.address,
        },
      });
      const nt = this.str(data.validityNT) || this.str(data.expiryDate);
      return `✅ *License Updated*\n\n👤 Driver: ${driver.name}\n📋 License: ${lic || 'N/A'}\n📅 Validity(NT): ${nt || 'N/A'}\n🩸 Blood Group: ${this.str(data.bloodGroup) || 'N/A'}`;
    }

    const byPhone = await this.findDriverByWhatsAppPhone(senderPhone);
    if (byPhone) {
      const expiry = this.licenseExpiryFromData(data);
      const dob = this.parseDate(this.str(data.dateOfBirth));
      const newLic = lic || byPhone.licenseNumber;
      await this.prisma.driver.update({
        where: { id: byPhone.id },
        data: {
          name: name || byPhone.name,
          licenseNumber: newLic,
          licenseExpiry: expiry,
          dateOfBirth: dob ?? byPhone.dateOfBirth,
          bloodGroup: this.str(data.bloodGroup) ?? byPhone.bloodGroup,
          address: this.str(data.address) ?? byPhone.address,
        },
      });
      const nt = this.str(data.validityNT) || this.str(data.expiryDate);
      return `✅ *License Updated (matched by phone)*\n\n👤 Driver: ${name || byPhone.name}\n📋 License: ${newLic || 'N/A'}\n📅 Validity(NT): ${nt || 'N/A'}`;
    }

    const phone = this.normalizePhoneForDriver(senderPhone);
    const licenseNumber =
      lic || `WA-OCR-${phone.replace(/\D/g, '').slice(-10) || Date.now()}`;
    const licenseExpiry = this.licenseExpiryFromData(data);
    driver = await this.prisma.driver.create({
      data: {
        name: name || 'Unknown',
        licenseNumber: licenseNumber.slice(0, 30),
        licenseExpiry,
        dateOfBirth: this.parseDate(this.str(data.dateOfBirth)),
        phone: phone.slice(0, 20),
        status: 'AVAILABLE',
        address: this.str(data.address) || null,
        bloodGroup: this.str(data.bloodGroup) || null,
      },
    });
    const nt = this.str(data.validityNT) || this.str(data.expiryDate);
    return `✅ *New Driver Created from License*\n\n👤 Name: ${driver.name}\n📋 License: ${driver.licenseNumber}\n📅 DOB: ${this.str(data.dateOfBirth) || 'N/A'}\n📅 Validity(NT): ${nt || 'N/A'}\n🩸 Blood: ${this.str(data.bloodGroup) || 'N/A'}\n📍 Address: ${this.str(data.address) || 'N/A'}`;
  }

  private async processFuel(
    data: Record<string, unknown>,
    senderPhone: string,
  ): Promise<string> {
    const vehicleNumber = this.str(data.vehicleNumber);
    if (!vehicleNumber) {
      return '❌ Vehicle number not found on fuel receipt.';
    }

    let vehicle = await this.findVehicleByNumber(vehicleNumber);
    if (!vehicle) {
      vehicle = await this.prisma.vehicle.create({
        data: this.stubVehicleCreate(vehicleNumber, {}),
      });
    }

    const driver = await this.findDriverByWhatsAppPhone(senderPhone);
    if (!driver) {
      return '❌ Your phone number is not linked to a driver profile. Please contact admin.';
    }

    const liters = this.num(data.quantity);
    const totalCost = this.num(data.totalAmount);
    const ratePerLiter =
      this.num(data.ratePerLitre) ||
      (liters > 0 ? totalCost / liters : 0);
    const odometerReading = this.num(data.odometerReading);
    const veh = await this.prisma.vehicle.findUnique({
      where: { id: vehicle.id },
      select: { currentKm: true },
    });
    const odometer =
      odometerReading > 0 ? odometerReading : (veh?.currentKm ?? 0);

    const entryNumber = this.generateFuelEntryNumber();
    await this.prisma.fuelEntry.create({
      data: {
        entryNumber,
        vehicleId: vehicle.id,
        driverId: driver.id,
        date: this.parseDate(this.str(data.date)) ?? new Date(),
        fuelType: this.mapFuelType(data.fuelType),
        liters: liters > 0 ? liters : 0,
        ratePerLiter: ratePerLiter > 0 ? ratePerLiter : null,
        totalCost: totalCost > 0 ? totalCost : 0,
        odometer,
        fuelStation: this.str(data.pumpName) || null,
        source: 'WHATSAPP_OCR',
      },
    });

    return `✅ *Fuel Entry Created*\n\n🚛 Vehicle: ${vehicleNumber}\n⛽ ${data.quantity ?? '?'}L ${this.str(data.fuelType) || 'Diesel'}\n💰 ₹${data.totalAmount ?? '?'} @ ₹${data.ratePerLitre ?? '?'}/L\n📅 Date: ${this.str(data.date) || 'Today'}\n🏪 Pump: ${this.str(data.pumpName) || 'N/A'}`;
  }

  private async processSpeedometer(
    data: Record<string, unknown>,
  ): Promise<string> {
    const reading = this.int(data.odometerReading);
    if (reading == null || reading <= 0) {
      return '❌ Could not read odometer. Please send clearer photo.';
    }

    const vehicleNumber = this.str(data.vehicleNumber);
    if (vehicleNumber) {
      let vehicle = await this.findVehicleByNumber(vehicleNumber);
      if (!vehicle) {
        vehicle = await this.prisma.vehicle.create({
          data: this.stubVehicleCreate(vehicleNumber, {
            currentKm: reading,
          }),
        });
        return `✅ *New Vehicle + Odometer Created*\n\n🚛 Vehicle: ${vehicleNumber}\n📊 KM: ${reading}`;
      }
      await this.prisma.vehicle.update({
        where: { id: vehicle.id },
        data: { currentKm: reading },
      });
      return `✅ *Odometer Updated*\n\n🚛 Vehicle: ${vehicleNumber}\n📊 Reading: ${reading} km`;
    }

    return `ℹ️ *Odometer Read*\n\n📊 Reading: ${reading} km\n\nCould not match to a vehicle. Please reply with vehicle number.`;
  }

  /** Prisma Vehicle requires type, make, model, year, regNumber; regNumber max 20 chars. */
  private stubVehicleCreate(
    regDisplay: string,
    extra: {
      pucNumber?: string | null;
      pucIssueDate?: Date | null;
      pucExpiryDate?: Date | null;
      insurancePolicyNumber?: string | null;
      insuranceCompany?: string | null;
      insuranceStartDate?: Date | null;
      insuranceExpiryDate?: Date | null;
      insuranceType?: string | null;
      make?: string;
      model?: string;
      color?: string | null;
      engineNumber?: string | null;
      chassisNumber?: string | null;
      fuelType?: FuelType;
      ownerName?: string | null;
      registrationDate?: Date | null;
      year?: number;
      currentKm?: number;
    } = {},
  ) {
    const regNumber = this.normalizeRegNumber(regDisplay);
    return {
      regNumber,
      type: 'TRUCK' as const,
      make: extra.make ?? 'Unknown',
      model: extra.model ?? 'Unknown',
      year: extra.year ?? new Date().getFullYear(),
      fuelType: extra.fuelType ?? ('DIESEL' as FuelType),
      status: 'ACTIVE' as const,
      currentKm: extra.currentKm ?? 0,
      pucNumber: extra.pucNumber,
      pucIssueDate: extra.pucIssueDate,
      pucExpiryDate: extra.pucExpiryDate,
      insurancePolicyNumber: extra.insurancePolicyNumber,
      insuranceCompany: extra.insuranceCompany,
      insuranceStartDate: extra.insuranceStartDate,
      insuranceExpiryDate: extra.insuranceExpiryDate,
      insuranceType: extra.insuranceType,
      color: extra.color,
      engineNumber: extra.engineNumber,
      chassisNumber: extra.chassisNumber,
      ownerName: extra.ownerName,
      registrationDate: extra.registrationDate,
    };
  }

  private normalizeRegNumber(reg: string): string {
    const cleaned = reg.replace(/[\s-]/g, '').toUpperCase();
    return cleaned.slice(0, 20) || `X${Date.now().toString(36).toUpperCase()}`.slice(0, 20);
  }

  private normalizePhoneForDriver(from: string): string {
    const raw = from.replace(/^whatsapp:/i, '').trim();
    const digits = raw.replace(/\D/g, '');
    if (digits.length >= 10) return digits.slice(-10);
    return digits.length > 0 ? digits : String(Date.now()).slice(-10);
  }

  private licenseExpiryFromData(data: Record<string, unknown>): Date {
    return (
      this.parseDate(this.str(data.validityNT)) ||
      this.parseDate(this.str(data.expiryDate)) ||
      new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    );
  }

  private yearFromRcData(data: Record<string, unknown>): number {
    const d = this.parseDate(this.str(data.registrationDate));
    if (d) {
      const y = d.getFullYear();
      if (!isNaN(y) && y >= 1980 && y <= new Date().getFullYear() + 1) {
        return y;
      }
    }
    return new Date().getFullYear();
  }

  private async findVehicleByNumber(regNumber: string) {
    const cleaned = regNumber.replace(/[\s-]/g, '').toUpperCase();

    let vehicle = await this.prisma.vehicle.findFirst({
      where: {
        regNumber: { equals: cleaned, mode: 'insensitive' },
        isDeleted: false,
      },
    });

    if (!vehicle) {
      vehicle = await this.prisma.vehicle.findFirst({
        where: {
          regNumber: { contains: cleaned, mode: 'insensitive' },
          isDeleted: false,
        },
      });
    }

    if (!vehicle) {
      vehicle = await this.prisma.vehicle.findFirst({
        where: {
          regNumber: { contains: regNumber.trim(), mode: 'insensitive' },
          isDeleted: false,
        },
      });
    }

    return vehicle;
  }

  private async findDriverByWhatsAppPhone(from: string) {
    const normalized = from.replace(/\D/g, '').slice(-10);
    if (!normalized || normalized.length < 10) return null;
    return this.prisma.driver.findFirst({
      where: { phone: { endsWith: normalized }, isDeleted: false },
    });
  }

  private generateFuelEntryNumber(): string {
    const now = new Date();
    const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const rand = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
    return `FUEL-${date}-${rand}`;
  }

  private parseDate(dateStr: string | null | undefined): Date | null {
    if (!dateStr) return null;
    try {
      const parts = dateStr.trim().split(/[/\-]/);
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
        const fullYear = year < 100 ? 2000 + year : year;
        return new Date(fullYear, month, day);
      }
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  }

  private str(v: unknown): string | null {
    if (v == null) return null;
    const s = String(v).trim();
    return s.length ? s : null;
  }

  private num(v: unknown): number {
    if (v == null || v === '') return 0;
    const n = parseFloat(String(v));
    return isNaN(n) ? 0 : n;
  }

  private int(v: unknown): number | null {
    if (v == null || v === '') return null;
    const n = parseInt(String(v), 10);
    return isNaN(n) ? null : n;
  }

  private mapFuelType(v: unknown): FuelType {
    const s = String(v ?? '')
      .toUpperCase()
      .replace(/\s/g, '');
    if (s.includes('PETROL')) return 'PETROL';
    if (s.includes('CNG')) return 'CNG';
    if (s.includes('ELECTRIC')) return 'ELECTRIC';
    if (s.includes('HYBRID')) return 'HYBRID';
    return 'DIESEL';
  }

  private mapVehicleFuelType(v: unknown): FuelType | null {
    const s = this.str(v);
    if (!s) return null;
    return this.mapFuelType(s);
  }
}
