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
          return await this.processLicense(ocrData);
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

    const vehicle = await this.findVehicleByNumber(vehicleNumber);
    if (!vehicle) {
      return `❌ Vehicle ${vehicleNumber} not found in system. Please add vehicle first.`;
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

    const vehicle = await this.findVehicleByNumber(vehicleNumber);
    if (!vehicle) {
      return `❌ Vehicle ${vehicleNumber} not found in system. Please add vehicle first.`;
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

    const vehicle = await this.findVehicleByNumber(vehicleNumber);

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

    return `ℹ️ *RC Book Read*\n\n🚛 Vehicle: ${vehicleNumber} NOT in system.\n\nDetails found:\nMake: ${this.str(data.make) || 'N/A'}\nModel: ${this.str(data.model) || 'N/A'}\nOwner: ${this.str(data.ownerName) || 'N/A'}\n\nPlease add vehicle in the app first, then resend this photo.`;
  }

  private async processLicense(data: Record<string, unknown>): Promise<string> {
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
      const expiry = this.parseDate(this.str(data.expiryDate));
      const dob = this.parseDate(this.str(data.dateOfBirth));
      await this.prisma.driver.update({
        where: { id: driver.id },
        data: {
          licenseNumber: lic || driver.licenseNumber,
          licenseExpiry: expiry ?? driver.licenseExpiry,
          dateOfBirth: dob ?? driver.dateOfBirth,
          bloodGroup: this.str(data.bloodGroup) ?? driver.bloodGroup,
        },
      });
      return `✅ *License Updated*\n\n👤 Driver: ${driver.name}\n📋 License: ${lic || 'N/A'}\n📅 Expiry: ${this.str(data.expiryDate) || 'N/A'}\n🩸 Blood Group: ${this.str(data.bloodGroup) || 'N/A'}`;
    }

    return `ℹ️ *License Read*\n\n👤 Name: ${name || 'N/A'}\n📋 License: ${lic || 'N/A'}\n📅 Expiry: ${this.str(data.expiryDate) || 'N/A'}\n\nDriver not found in system. Please add driver first.`;
  }

  private async processFuel(
    data: Record<string, unknown>,
    senderPhone: string,
  ): Promise<string> {
    const vehicleNumber = this.str(data.vehicleNumber);
    if (!vehicleNumber) {
      return '❌ Vehicle number not found on fuel receipt.';
    }

    const vehicle = await this.findVehicleByNumber(vehicleNumber);
    if (!vehicle) {
      return `❌ Vehicle ${vehicleNumber} not found. Please add vehicle first.`;
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
      const vehicle = await this.findVehicleByNumber(vehicleNumber);
      if (vehicle) {
        await this.prisma.vehicle.update({
          where: { id: vehicle.id },
          data: { currentKm: reading },
        });
        return `✅ *Odometer Updated*\n\n🚛 Vehicle: ${vehicleNumber}\n📊 Reading: ${reading} km`;
      }
    }

    return `ℹ️ *Odometer Read*\n\n📊 Reading: ${reading} km\n\nCould not match to a vehicle. Please reply with vehicle number.`;
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
