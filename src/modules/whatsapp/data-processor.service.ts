import { Injectable } from '@nestjs/common';
import { FuelType, VehicleType } from '@prisma/client';
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
      return `❌ Could not read the document (${err}). Please try a clearer photo.\n\nSupported: PUC, Insurance, RC Book, License, Fuel Receipt, Speedometer, Maintenance/Garage Bill`;
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
        case 'MAINTENANCE_BILL':
          return await this.processMaintenanceBill(ocrData);
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

    const newData: Record<string, unknown> = {
      pucNumber: this.str(data.pucNumber) || null,
      pucIssueDate: this.parseDate(this.str(data.issueDate)),
      pucExpiryDate: this.parseDate(this.str(data.expiryDate)),
    };
    const smartUpdate = this.buildSmartUpdate(
      vehicle as unknown as Record<string, unknown>,
      newData,
    );
    const exp = this.parseDate(this.str(data.expiryDate));
    if (exp) smartUpdate.pucExpiryDate = exp;
    const pn = this.str(data.pucNumber);
    if (pn) smartUpdate.pucNumber = pn;

    if (Object.keys(smartUpdate).length > 0) {
      await this.prisma.vehicle.update({
        where: { id: vehicle.id },
        data: smartUpdate,
      });
    }

    const updatedKeys = Object.keys(smartUpdate);
    const fieldsLine =
      updatedKeys.length > 0
        ? `\n📝 Updated: ${updatedKeys.join(', ')}`
        : '\n📝 No PUC fields changed (no new data).';
    return `✅ *PUC Updated*\n\n🚛 Vehicle: ${vehicleNumber}\n📋 PUC No: ${this.str(data.pucNumber) || 'N/A'}\n📅 Expiry: ${this.str(data.expiryDate) || 'N/A'}${fieldsLine}\n${data.emissionResult ? '🔬 Result: ' + String(data.emissionResult) : ''}`;
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

    const newData: Record<string, unknown> = {
      insurancePolicyNumber: this.str(data.policyNumber) ?? null,
      insuranceCompany: this.str(data.company) ?? null,
      insuranceStartDate: this.parseDate(this.str(data.startDate)),
      insuranceExpiryDate: this.parseDate(this.str(data.expiryDate)),
      insuranceType: this.str(data.insuranceType) ?? null,
    };
    const update: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(newData)) {
      if (v !== null && v !== undefined && v !== '') {
        update[k] = v;
      }
    }
    if (Object.keys(update).length > 0) {
      await this.prisma.vehicle.update({
        where: { id: vehicle.id },
        data: update,
      });
    }

    return `✅ *Insurance Updated*\n\n🚛 Vehicle: ${vehicleNumber}\n📋 Policy: ${this.str(data.policyNumber) || 'N/A'}\n🏢 Company: ${this.str(data.company) || 'N/A'}\n📅 Expiry: ${this.str(data.expiryDate) || 'N/A'}\n💰 Premium: ₹${data.premium ?? 'N/A'}\n\nPolicy details were refreshed from this document.`;
  }

  private async processRcBook(data: Record<string, unknown>): Promise<string> {
    const vehicleNumber = this.str(data.vehicleNumber);
    if (!vehicleNumber) {
      return '❌ Vehicle number not found in RC. Please send clearer photo.';
    }

    const vehicle = await this.findVehicleByNumber(vehicleNumber);

    if (vehicle) {
      const fullNew = this.buildRcBookUpdatePayload(data);
      const smartUpdate = this.buildSmartUpdate(
        vehicle as unknown as Record<string, unknown>,
        fullNew,
      );
      if (Object.keys(smartUpdate).length > 0) {
        await this.prisma.vehicle.update({
          where: { id: vehicle.id },
          data: smartUpdate,
        });
        return `✅ *Vehicle Updated*\n\n🚛 ${vehicleNumber}\n📝 Updated: ${Object.keys(smartUpdate).join(', ')}\n\nPreviously filled fields were kept unchanged.`;
      }
      return `ℹ️ *No New Info*\n\n🚛 ${vehicleNumber}\nAll fields already filled. No update needed.`;
    } else {
      const mappedType =
        this.mapVehicleClassToType(this.str(data.vehicleClass)) ?? 'TRUCK';
      const fuel =
        this.mapVehicleFuelType(data.fuelType) ?? ('DIESEL' as FuelType);
      await this.prisma.vehicle.create({
        data: this.stubVehicleCreate(vehicleNumber, {
          type: mappedType,
          make: this.rcStr(data.make) || 'Unknown',
          model: this.rcStr(data.model) || 'Unknown',
          year:
            this.extractYear(this.str(data.registrationDate)) ??
            new Date().getFullYear(),
          fuelType: fuel,
          color: this.rcStr(data.color) || null,
          engineNumber: this.rcStr(data.engineNumber) || null,
          chassisNumber: this.rcStr(data.chassisNumber) || null,
          ownerName: this.str(data.ownerName) || null,
          registrationDate: this.parseDate(this.str(data.registrationDate)),
          fitnessExpiryDate: this.parseDate(this.str(data.fitnessValidUpto)),
          insuranceExpiryDate: this.parseDate(
            this.str(data.insuranceValidUpto),
          ),
          pucExpiryDate: this.parseDate(this.str(data.puccValidUpto)),
          permitExpiryDate: this.parseDate(this.str(data.permitValidUpto)),
          taxExpiryDate: this.parseDate(this.str(data.taxValidUpto)),
          taxReceiptNumber: this.taxValidUptoAsCode(data),
        }),
      });
    }

    let response = `✅ *New Vehicle Created from RC/mParivahan*`;
    response += `\n\n🚛 Vehicle: ${vehicleNumber}`;
    const vClass = this.str(data.vehicleClass);
    if (vClass) response += `\n📋 Class: ${vClass}`;
    const ft = this.str(data.fuelType);
    if (ft) response += `\n⛽ Fuel: ${ft}`;
    const rd = this.str(data.registrationDate);
    if (rd) response += `\n📅 Reg Date: ${rd}`;
    const fit = this.str(data.fitnessValidUpto);
    if (fit) response += `\n🔧 Fitness: ${fit}`;
    const ins = this.str(data.insuranceValidUpto);
    if (ins) response += `\n🛡️ Insurance: ${ins}`;
    const puc = this.str(data.puccValidUpto);
    if (puc) response += `\n💨 PUC: ${puc}`;
    const perm = this.str(data.permitValidUpto);
    if (perm) response += `\n📄 Permit: ${perm}`;
    return response;
  }

  /** RC field present and not placeholder "N/A". */
  private rcStr(v: unknown): string | null {
    const s = this.str(v);
    if (!s || s.toUpperCase() === 'N/A') return null;
    return s;
  }

  private buildRcBookUpdatePayload(
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    const u: Record<string, unknown> = {};

    const mk = this.rcStr(data.make);
    if (mk) u.make = mk;
    const md = this.rcStr(data.model);
    if (md) u.model = md;
    const col = this.rcStr(data.color);
    if (col) u.color = col;
    const eng = this.rcStr(data.engineNumber);
    if (eng) u.engineNumber = eng;
    const ch = this.rcStr(data.chassisNumber);
    if (ch) u.chassisNumber = ch;

    const fuel = this.mapVehicleFuelType(data.fuelType);
    if (fuel) u.fuelType = fuel;

    const owner = this.str(data.ownerName);
    if (owner) u.ownerName = owner;

    const regD = this.parseDate(this.str(data.registrationDate));
    if (regD) u.registrationDate = regD;

    const fitD = this.parseDate(this.str(data.fitnessValidUpto));
    if (fitD) u.fitnessExpiryDate = fitD;

    const insD = this.parseDate(this.str(data.insuranceValidUpto));
    if (insD) u.insuranceExpiryDate = insD;

    const pucD = this.parseDate(this.str(data.puccValidUpto));
    if (pucD) u.pucExpiryDate = pucD;

    const permD = this.parseDate(this.str(data.permitValidUpto));
    if (permD) u.permitExpiryDate = permD;

    const taxD = this.parseDate(this.str(data.taxValidUpto));
    if (taxD) u.taxExpiryDate = taxD;
    else {
      const taxCode = this.taxValidUptoAsCode(data);
      if (taxCode) u.taxReceiptNumber = taxCode;
    }

    const vt = this.mapVehicleClassToType(this.str(data.vehicleClass));
    if (vt) u.type = vt;

    return u;
  }

  private taxValidUptoAsCode(data: Record<string, unknown>): string | null {
    const raw = this.str(data.taxValidUpto);
    if (!raw) return null;
    if (this.parseDate(raw)) return null;
    return raw.slice(0, 50);
  }

  private mapVehicleClassToType(vehicleClass: string | null): VehicleType | null {
    if (!vehicleClass) return null;
    const low = vehicleClass.toLowerCase();
    if (low.includes('bus')) return 'VAN';
    if (low.includes('goods') || low.includes('truck')) return 'TRUCK';
    return null;
  }

  private extractYear(dateStr: string | null | undefined): number | null {
    const date = this.parseDate(dateStr);
    return date ? date.getFullYear() : null;
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
      const newData: Record<string, unknown> = {};
      if (lic) newData.licenseNumber = lic;
      if (name) newData.name = name;
      const dob = this.parseDate(this.str(data.dateOfBirth));
      if (dob) newData.dateOfBirth = dob;
      const addr = this.str(data.address);
      if (addr) newData.address = addr;
      const bg = this.str(data.bloodGroup);
      if (bg) newData.bloodGroup = bg;

      const smartUpdate = this.buildSmartUpdate(
        driver as unknown as Record<string, unknown>,
        newData,
      );
      if (this.str(data.validityNT) || this.str(data.expiryDate)) {
        smartUpdate.licenseExpiry = this.licenseExpiryFromData(data);
      }

      if (Object.keys(smartUpdate).length > 0) {
        await this.prisma.driver.update({
          where: { id: driver.id },
          data: smartUpdate,
        });
      }

      const nt = this.str(data.validityNT) || this.str(data.expiryDate);
      const updatedList = Object.keys(smartUpdate).join(', ');
      return `✅ *License Updated*\n\n👤 Driver: ${driver.name}\n📋 License: ${lic || driver.licenseNumber}\n📅 Validity(NT): ${nt || 'N/A'}\n🩸 Blood Group: ${this.str(data.bloodGroup) || 'N/A'}${updatedList ? `\n📝 Updated: ${updatedList}` : '\n📝 No field changes (expiry unchanged or no OCR dates).'}`;
    }

    const byPhone = await this.findDriverByWhatsAppPhone(senderPhone);
    if (byPhone) {
      const newData: Record<string, unknown> = {};
      if (lic) newData.licenseNumber = lic;
      if (name) newData.name = name;
      const dob = this.parseDate(this.str(data.dateOfBirth));
      if (dob) newData.dateOfBirth = dob;
      const addr = this.str(data.address);
      if (addr) newData.address = addr;
      const bg = this.str(data.bloodGroup);
      if (bg) newData.bloodGroup = bg;

      const smartUpdate = this.buildSmartUpdate(
        byPhone as unknown as Record<string, unknown>,
        newData,
      );
      if (this.str(data.validityNT) || this.str(data.expiryDate)) {
        smartUpdate.licenseExpiry = this.licenseExpiryFromData(data);
      }

      if (Object.keys(smartUpdate).length > 0) {
        await this.prisma.driver.update({
          where: { id: byPhone.id },
          data: smartUpdate,
        });
      }

      const nt = this.str(data.validityNT) || this.str(data.expiryDate);
      const newLic = lic || byPhone.licenseNumber;
      const updatedList = Object.keys(smartUpdate).join(', ');
      return `✅ *License Updated (matched by phone)*\n\n👤 Driver: ${name || byPhone.name}\n📋 License: ${newLic || 'N/A'}\n📅 Validity(NT): ${nt || 'N/A'}${updatedList ? `\n📝 Updated: ${updatedList}` : '\n📝 No field changes (expiry unchanged or no OCR dates).'}`;
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

  private async processMaintenanceBill(
    data: Record<string, unknown>,
  ): Promise<string> {
    const vehicleNumber = this.str(data.vehicleNumber);
    if (!vehicleNumber) {
      return '❌ Vehicle number not found on bill.';
    }

    let vehicle = await this.findVehicleByNumber(vehicleNumber);
    if (!vehicle) {
      vehicle = await this.prisma.vehicle.create({
        data: this.stubVehicleCreate(vehicleNumber, {}),
      });
    }

    const reeferKeywords = [
      'compressor',
      'refrigerant',
      'thermostat',
      'condenser',
      'evaporator',
      'reefer',
      'cooling',
      'freezer',
    ];
    const blob = [
      this.str(data.description) || '',
      this.str(data.partsUsed) || '',
      this.str(data.serviceType) || '',
    ]
      .join(' ')
      .toLowerCase();
    const isReefer = reeferKeywords.some((k) => blob.includes(k));
    const category = isReefer ? 'REEFER' : 'TRUCK';

    const typeName = this.str(data.serviceType);
    let maintenanceType = typeName
      ? await this.prisma.maintCatalog.findFirst({
          where: {
            category,
            isActive: true,
            name: { contains: typeName, mode: 'insensitive' },
          },
        })
      : null;

    if (!maintenanceType) {
      const otherName = category === 'REEFER' ? 'Other (Reefer)' : 'Other (Truck)';
      maintenanceType = await this.prisma.maintCatalog.findFirst({
        where: {
          category,
          isActive: true,
          name: otherName,
        },
      });
    }

    if (!maintenanceType) {
      return '❌ Maintenance types are not set up yet. Open the app once or contact admin to seed the maintenance catalog.';
    }

    const labor = this.num(data.laborCost);
    const parts = this.num(data.partsCost);
    let total = this.num(data.totalCost);
    if (total <= 0 && (labor > 0 || parts > 0)) {
      total = labor + parts;
    }
    if (total <= 0) {
      total = labor + parts;
    }

    await this.prisma.vehicleMaintRecord.create({
      data: {
        vehicleId: vehicle.id,
        typeId: maintenanceType.id,
        category,
        date: this.parseDate(this.str(data.date)) ?? new Date(),
        description: this.str(data.description),
        partsUsed: this.str(data.partsUsed),
        laborCost: labor,
        partsCost: parts,
        totalCost: total,
        odometerKm: this.int(data.odometerKm),
        garageName: this.str(data.garageName),
        garageContact: this.str(data.garageContact),
        billNumber: this.str(data.billNumber),
        source: 'WHATSAPP_OCR',
      },
    });

    const svc = typeName || maintenanceType.name;
    return `✅ *Maintenance Record Created*\n\n🚛 Vehicle: ${vehicleNumber}\n${isReefer ? '❄️' : '🔧'} Category: ${category}\n📋 Type: ${svc}\n💰 Total: ₹${total || '?'}\n🏪 Garage: ${this.str(data.garageName) || 'N/A'}\n📅 Date: ${this.str(data.date) || 'Today'}`;
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
      type?: VehicleType;
      fitnessExpiryDate?: Date | null;
      permitExpiryDate?: Date | null;
      taxExpiryDate?: Date | null;
      taxReceiptNumber?: string | null;
    } = {},
  ) {
    const regNumber = this.normalizeRegNumber(regDisplay);
    return {
      regNumber,
      type: extra.type ?? ('TRUCK' as VehicleType),
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
      fitnessExpiryDate: extra.fitnessExpiryDate,
      permitExpiryDate: extra.permitExpiryDate,
      taxExpiryDate: extra.taxExpiryDate,
      taxReceiptNumber: extra.taxReceiptNumber,
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
    const y = this.extractYear(this.str(data.registrationDate));
    if (y != null && y >= 1980 && y <= new Date().getFullYear() + 1) {
      return y;
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
    const s = String(dateStr).trim();
    if (!s) return null;
    try {
      const months: Record<string, number> = {
        jan: 0,
        feb: 1,
        mar: 2,
        apr: 3,
        may: 4,
        jun: 5,
        jul: 6,
        aug: 7,
        sep: 8,
        oct: 9,
        nov: 10,
        dec: 11,
        january: 0,
        february: 1,
        march: 2,
        april: 3,
        june: 5,
        july: 6,
        august: 7,
        september: 8,
        october: 9,
        november: 10,
        december: 11,
      };

      const monMatch = s.match(
        /^(\d{1,2})[\-\/]([A-Za-z]{3,9})[\-\/](\d{4})$/,
      );
      if (monMatch) {
        const day = parseInt(monMatch[1], 10);
        const monRaw = monMatch[2].toLowerCase();
        const month =
          months[monRaw] ?? months[monRaw.slice(0, 3)] ?? undefined;
        const year = parseInt(monMatch[3], 10);
        if (month !== undefined && !isNaN(day) && !isNaN(year)) {
          return new Date(year, month, day);
        }
      }

      const parts = s.split(/[/\-]/);
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const monthNum = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);
        if (
          !isNaN(day) &&
          !isNaN(monthNum) &&
          !isNaN(year) &&
          monthNum >= 1 &&
          monthNum <= 12
        ) {
          const fullYear = year < 100 ? 2000 + year : year;
          return new Date(fullYear, monthNum - 1, day);
        }
      }

      const d = new Date(s);
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

  /** True if DB value is empty/placeholder — safe to fill from OCR. */
  private isExistingFieldEmptyForMerge(existingValue: unknown): boolean {
    if (existingValue === null || existingValue === undefined) return true;
    if (existingValue === '') return true;
    if (typeof existingValue === 'string') {
      const t = existingValue.trim();
      if (!t) return true;
      const u = t.toUpperCase();
      if (u === 'UNKNOWN' || u === 'N/A') return true;
    }
    if (typeof existingValue === 'number' && existingValue === 0) return true;
    if (existingValue instanceof Date) {
      return isNaN(existingValue.getTime());
    }
    return false;
  }

  /**
   * Merge OCR into DB only where existing is missing/empty/Unknown/N/A/0.
   * Caller may then force specific keys (e.g. PUC expiry, license expiry).
   */
  private buildSmartUpdate(
    existingRecord: Record<string, unknown>,
    newData: Record<string, unknown>,
  ): Record<string, unknown> {
    const update: Record<string, unknown> = {};

    for (const [key, newValue] of Object.entries(newData)) {
      if (
        newValue === null ||
        newValue === undefined ||
        newValue === '' ||
        newValue === 'N/A' ||
        (typeof newValue === 'string' &&
          newValue.trim().toUpperCase() === 'N/A')
      ) {
        continue;
      }
      if (
        typeof newValue === 'string' &&
        newValue.trim().toUpperCase() === 'UNKNOWN'
      ) {
        continue;
      }
      if (newValue instanceof Date && isNaN(newValue.getTime())) {
        continue;
      }

      const existingValue = existingRecord[key];
      if (!this.isExistingFieldEmptyForMerge(existingValue)) {
        continue;
      }
      update[key] = newValue;
    }

    return update;
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
