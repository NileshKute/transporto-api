import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { VehicleType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SurepassService } from '../surepass/surepass.service';

/** Prisma `Vehicle` scalars RC verification may persist (exact names; see schema). */
const VEHICLE_RC_MODEL_FIELDS = [
  'make',
  'model',
  'variant',
  'year',
  'type',
  'fuelType',
  'color',
  'engineNumber',
  'chassisNumber',
  'loadCapacityKg',
  'ownerName',
  'fatherName',
  'ownerAddress',
  'ownerCount',
  'registrationDate',
  'registrationAuthority',
  'rcNumber',
  'vehicleCategory',
  'vehicleClassDesc',
  'rcStatus',
  'bodyType',
  'normsType',
  'cubicCapacity',
  'numberOfCylinders',
  'seatingCapacity',
  'sleeperCapacity',
  'standingCapacity',
  'wheelbase',
  'unladenWeight',
  'grossVehicleWeight',
  'financer',
  'isFinanced',
  'insuranceCompany',
  'insurancePolicyNumber',
  'insuranceExpiryDate',
  'insuranceStartDate',
  'insuranceType',
  'fitnessExpiryDate',
  'pucNumber',
  'pucExpiryDate',
  'pucIssueDate',
  'taxExpiryDate',
  'taxReceiptNumber',
  'permitNumber',
  'permitExpiryDate',
  'permitType',
  'permitIssueDate',
  'permitValidFrom',
  'blacklistStatus',
  'nonUseStatus',
  'nonUseFrom',
  'nonUseTo',
  'nocDetails',
] as const;

/** Always refresh from government / RC source when a value is present. */
/** Writable Vehicle scalars (Prisma); strips unknown keys from API payloads. */
const VEHICLE_SCALAR_KEYS = new Set<string>([
  'regNumber',
  'type',
  'make',
  'model',
  'variant',
  'year',
  'fuelType',
  'status',
  'currentKm',
  'chassisNumber',
  'engineNumber',
  'color',
  'bodyType',
  'normsType',
  'cubicCapacity',
  'numberOfCylinders',
  'seatingCapacity',
  'sleeperCapacity',
  'standingCapacity',
  'wheelbase',
  'unladenWeight',
  'grossVehicleWeight',
  'loadCapacityKg',
  'numTires',
  'tankCapacityL',
  'purchaseDate',
  'purchasePrice',
  'photoUrl',
  'notes',
  'isDeleted',
  'ownerName',
  'fatherName',
  'ownerAddress',
  'ownerCount',
  'registrationDate',
  'rcNumber',
  'registrationAuthority',
  'vehicleCategory',
  'vehicleClassDesc',
  'rcStatus',
  'pucNumber',
  'pucIssueDate',
  'pucExpiryDate',
  'pucCertificateUrl',
  'insurancePolicyNumber',
  'insuranceCompany',
  'insuranceStartDate',
  'insuranceExpiryDate',
  'insuranceCertificateUrl',
  'insuranceType',
  'financer',
  'isFinanced',
  'fitnessNumber',
  'fitnessIssueDate',
  'fitnessExpiryDate',
  'fitnessCertificateUrl',
  'taxReceiptNumber',
  'taxPaidDate',
  'taxExpiryDate',
  'taxReceiptUrl',
  'taxAmount',
  'permitNumber',
  'permitType',
  'permitIssueDate',
  'permitValidFrom',
  'permitExpiryDate',
  'permitUrl',
  'blacklistStatus',
  'nonUseStatus',
  'nonUseFrom',
  'nonUseTo',
  'nocDetails',
  'lastLatitude',
  'lastLongitude',
  'lastSpeed',
  'lastTemperature',
  'lastGpsUpdate',
  'gpsStatus',
  'iconType',
]);

const ALWAYS_UPDATE_RC_FIELDS: readonly string[] = [
  'fuelType',
  'rcStatus',
  'insuranceCompany',
  'insurancePolicyNumber',
  'insuranceExpiryDate',
  'insuranceStartDate',
  'insuranceType',
  'fitnessExpiryDate',
  'pucNumber',
  'pucExpiryDate',
  'pucIssueDate',
  'taxExpiryDate',
  'permitNumber',
  'permitExpiryDate',
  'permitType',
  'permitIssueDate',
  'permitValidFrom',
  'financer',
  'isFinanced',
  'blacklistStatus',
  'nonUseStatus',
  'nonUseFrom',
  'nonUseTo',
  'nocDetails',
];

@Injectable()
export class VehiclesService {
  private readonly logger = new Logger(VehiclesService.name);

  constructor(
    private prisma: PrismaService,
    private surepass: SurepassService,
  ) {}

  async findAll(query: any) {
    const { status, type, search, page = 1, limit = 10 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = { isDeleted: false };
    if (status) where.status = status;
    if (type) where.type = type;
    if (search) {
      where.OR = [
        { regNumber: { contains: search, mode: 'insensitive' } },
        { make: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.vehicle.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          insurance: { where: { status: { in: ['ACTIVE', 'EXPIRING_SOON'] } }, take: 1 },
          assignments: { where: { isCurrent: true }, include: { driver: { select: { name: true, phone: true } } }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.vehicle.count({ where }),
    ]);
    return { data, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) };
  }

  async getStats() {
    const [total, active, maintenance, idle, breakdown] = await Promise.all([
      this.prisma.vehicle.count({ where: { isDeleted: false } }),
      this.prisma.vehicle.count({ where: { isDeleted: false, status: 'ACTIVE' } }),
      this.prisma.vehicle.count({ where: { isDeleted: false, status: 'IN_MAINTENANCE' } }),
      this.prisma.vehicle.count({ where: { isDeleted: false, status: 'IDLE' } }),
      this.prisma.vehicle.count({ where: { isDeleted: false, status: 'BREAKDOWN' } }),
    ]);
    return { total, active, maintenance, idle, breakdown };
  }

  async findOne(id: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id, isDeleted: false },
      include: {
        trips: { take: 5, orderBy: { date: 'desc' }, include: { driver: { select: { name: true } } } },
        fuelEntries: { take: 5, orderBy: { createdAt: 'desc' } },
        maintenance: { take: 5, orderBy: { createdAt: 'desc' } },
        insurance: { orderBy: { createdAt: 'desc' } },
        documents: { orderBy: { createdAt: 'desc' } },
        assignments: { where: { isCurrent: true }, include: { driver: { select: { name: true, phone: true, status: true } } } },
      },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return vehicle;
  }

  async create(dto: any) {
    const data = this.parseVehicleDto(dto) as Record<string, unknown>;
    if (data.type === undefined || data.type === null || data.type === '') {
      data.type = VehicleType.TRUCK;
    }
    return this.prisma.vehicle.create({ data: data as any });
  }

  async update(id: string, dto: any) {
    await this.findOne(id);
    return this.prisma.vehicle.update({ where: { id }, data: this.parseVehicleDto(dto) });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.vehicle.update({ where: { id }, data: { isDeleted: true } });
  }

  async getExpiringDocuments(daysAhead = 30) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    const today = new Date();

    const vehicles = await this.prisma.vehicle.findMany({
      where: {
        isDeleted: false,
        status: { not: 'SOLD' },
        OR: [
          { pucExpiryDate: { lte: futureDate } },
          { insuranceExpiryDate: { lte: futureDate } },
          { fitnessExpiryDate: { lte: futureDate } },
          { taxExpiryDate: { lte: futureDate } },
          { permitExpiryDate: { lte: futureDate } },
        ],
      },
    });

    return vehicles
      .map((vehicle) => {
        const alerts: any[] = [];

        const check = (name: string, date: Date | null) => {
          if (!date) return;
          if (date < today) {
            alerts.push({ document: name, status: 'EXPIRED', expiryDate: date });
          } else if (date <= futureDate) {
            const daysLeft = Math.ceil((date.getTime() - today.getTime()) / 86400000);
            alerts.push({ document: name, status: 'EXPIRING_SOON', expiryDate: date, daysLeft });
          }
        };

        check('PUC', vehicle.pucExpiryDate);
        check('Insurance', vehicle.insuranceExpiryDate);
        check('Fitness', vehicle.fitnessExpiryDate);
        check('Road Tax', vehicle.taxExpiryDate);
        check('Permit', vehicle.permitExpiryDate);

        return { vehicleId: vehicle.id, regNumber: vehicle.regNumber, vehicleType: vehicle.type, alerts };
      })
      .filter((v) => v.alerts.length > 0);
  }

  async verifyAndUpdateRC(vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, isDeleted: false },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const result = await this.surepass.verifyRC(vehicle.regNumber);
    if (!result.success) {
      return { success: false, message: result.message };
    }

    const mapped = result.data as Record<string, unknown>;
    const modelFieldSet = new Set<string>(VEHICLE_RC_MODEL_FIELDS as readonly string[]);

    this.logger.log('RC mapped fields: ' + JSON.stringify(Object.keys(mapped)));

    const skippedNotInModel = Object.keys(mapped).filter((k) => !modelFieldSet.has(k));
    this.logger.log('Fields skipped (not in model): ' + JSON.stringify(skippedNotInModel));

    const skipReasons: { field: string; reason: string }[] = [];
    const updateData: Record<string, unknown> = {};

    for (const key of VEHICLE_RC_MODEL_FIELDS) {
      const newValue = mapped[key];
      if (newValue === null || newValue === undefined || newValue === '') {
        skipReasons.push({ field: key, reason: 'value was null or empty' });
        continue;
      }

      const currentValue = (vehicle as Record<string, unknown>)[key];

      if (ALWAYS_UPDATE_RC_FIELDS.includes(key)) {
        updateData[key] = newValue;
      } else {
        const isEmpty =
          currentValue === null ||
          currentValue === undefined ||
          currentValue === '' ||
          currentValue === 'Unknown' ||
          currentValue === 'N/A' ||
          currentValue === 0;
        if (isEmpty) {
          updateData[key] = newValue;
        } else {
          skipReasons.push({ field: key, reason: 'existing value kept (smart fill)' });
        }
      }
    }

    const normalizedReg = vehicle.regNumber.replace(/[\s\-]/g, '').toUpperCase();
    if (normalizedReg !== vehicle.regNumber) {
      updateData.regNumber = normalizedReg;
    }

    this.logger.log('Fields being saved: ' + JSON.stringify(Object.keys(updateData)));
    this.logger.log('RC field skip reasons: ' + JSON.stringify(skipReasons));

    let fieldsUpdated: string[] = [];

    if (Object.keys(updateData).length > 0) {
      try {
        await this.prisma.vehicle.update({
          where: { id: vehicleId },
          data: updateData,
        });
        fieldsUpdated = Object.keys(updateData);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Some RC fields failed to save: ${msg}`);
        const safeUpdate: Record<string, unknown> = {};
        for (const key of VEHICLE_RC_MODEL_FIELDS) {
          if (updateData[key] !== undefined) safeUpdate[key] = updateData[key];
        }
        if (updateData.regNumber !== undefined) safeUpdate.regNumber = updateData.regNumber;
        if (Object.keys(safeUpdate).length > 0) {
          await this.prisma.vehicle.update({
            where: { id: vehicleId },
            data: safeUpdate,
          });
          fieldsUpdated = Object.keys(safeUpdate);
        }
      }
    }

    return {
      success: true,
      fieldsUpdated,
      data: mapped,
      message: `Vehicle verified. ${fieldsUpdated.length} field(s) updated.`,
    };
  }

  async verifyRCByNumber(vehicleNumber: string) {
    if (!vehicleNumber?.trim()) {
      throw new BadRequestException('vehicleNumber is required');
    }
    return this.surepass.verifyRC(vehicleNumber);
  }

  async fetchChallans(vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, isDeleted: false },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return this.surepass.fetchChallans(vehicle.regNumber);
  }

  async getExpirySummary() {
    const today = new Date();
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

    const vehicles = await this.prisma.vehicle.findMany({
      where: { isDeleted: false, status: { not: 'SOLD' } },
      select: {
        pucExpiryDate: true,
        insuranceExpiryDate: true,
        fitnessExpiryDate: true,
        taxExpiryDate: true,
        permitExpiryDate: true,
      },
    });

    let expired = 0;
    let expiringSoon = 0;

    for (const v of vehicles) {
      const dates = [v.pucExpiryDate, v.insuranceExpiryDate, v.fitnessExpiryDate, v.taxExpiryDate, v.permitExpiryDate];
      for (const d of dates) {
        if (d && d < today) expired++;
        else if (d && d <= thirtyDaysLater) expiringSoon++;
      }
    }

    return { expired, expiringSoon, total: expired + expiringSoon };
  }

  private parseVehicleDto(dto: any) {
    const data = { ...dto };

    if (data.regNumber !== undefined && data.regNumber !== null && data.regNumber !== '') {
      data.regNumber = String(data.regNumber).replace(/[\s\-]/g, '').toUpperCase();
    }

    const COERCE_STRING_FIELDS = [
      'cubicCapacity',
      'bodyType',
      'normsType',
      'vehicleCategory',
      'vehicleClassDesc',
      'rcStatus',
      'financer',
      'ownerAddress',
      'fatherName',
      'blacklistStatus',
      'nonUseStatus',
      'nocDetails',
      'variant',
      'permitType',
    ];
    for (const key of COERCE_STRING_FIELDS) {
      if (data[key] !== undefined && data[key] !== null) {
        data[key] = String(data[key]);
      }
    }

    const DATE_FIELDS = [
      'purchaseDate',
      'registrationDate',
      'pucIssueDate',
      'pucExpiryDate',
      'insuranceStartDate',
      'insuranceExpiryDate',
      'fitnessIssueDate',
      'fitnessExpiryDate',
      'taxPaidDate',
      'taxExpiryDate',
      'permitIssueDate',
      'permitValidFrom',
      'permitExpiryDate',
      'nonUseFrom',
      'nonUseTo',
      'lastGpsUpdate',
    ];
    for (const f of DATE_FIELDS) {
      if (data[f] !== undefined) {
        if (data[f] === null || data[f] === '') {
          data[f] = null;
        } else {
          const d = new Date(data[f]);
          data[f] = Number.isNaN(d.getTime()) ? null : d;
        }
      }
    }

    const FLOAT_FIELDS = [
      'loadCapacityKg',
      'tankCapacityL',
      'purchasePrice',
      'currentKm',
      'taxAmount',
      'lastLatitude',
      'lastLongitude',
      'lastSpeed',
      'lastTemperature',
    ];
    for (const f of FLOAT_FIELDS) {
      if (data[f] === undefined) continue;
      if (data[f] === null || data[f] === '') {
        data[f] = null;
        continue;
      }
      const n = parseFloat(String(data[f]));
      data[f] = Number.isNaN(n) ? null : n;
    }

    const OPTIONAL_INT_FIELDS = [
      'numberOfCylinders',
      'seatingCapacity',
      'sleeperCapacity',
      'standingCapacity',
      'wheelbase',
      'unladenWeight',
      'grossVehicleWeight',
      'ownerCount',
      'numTires',
    ];
    for (const key of OPTIONAL_INT_FIELDS) {
      if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
        const n = typeof data[key] === 'string' ? parseInt(data[key], 10) : Number(data[key]);
        if (Number.isNaN(n)) delete data[key];
        else data[key] = n;
      }
    }

    if (data.year !== undefined && data.year !== null && data.year !== '') {
      const y = parseInt(String(data.year), 10);
      if (Number.isNaN(y)) delete data.year;
      else data.year = y;
    }

    delete data.trips;
    delete data.fuelEntries;
    delete data.maintenance;
    delete data.emergencies;
    delete data.insurance;
    delete data.shifts;
    delete data.documents;
    delete data.assignments;
    delete data.clientVehicles;
    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;

    for (const k of Object.keys(data)) {
      if (!VEHICLE_SCALAR_KEYS.has(k)) delete data[k];
    }

    return data;
  }
}
