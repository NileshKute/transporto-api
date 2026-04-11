import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { VehicleType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SurepassService } from '../surepass/surepass.service';
import { TollService } from '../toll/toll.service';

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
    private tollService: TollService,
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

  private async requireVehicle(id: string) {
    const v = await this.prisma.vehicle.findFirst({
      where: { id, isDeleted: false },
    });
    if (!v) throw new NotFoundException('Vehicle not found');
    return v;
  }

  /** Full vehicle 360° — toll/BPCL/trips/maintenance aggregates, alerts, lifetime totals */
  async getVehicle360Summary(vehicleId: string) {
    await this.requireVehicle(vehicleId);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const [
      toll30,
      tollTxn30,
      bpcl30,
      trip30,
      maint30,
      tollLife,
      fuelLife,
      tripLife,
      vehicleExpiry,
      lastTripWithDriver,
      latestGpsPing,
    ] = await Promise.all([
      this.prisma.tollTransaction.aggregate({
        where: {
          vehicleId,
          transactionDateTime: { gte: thirtyDaysAgo },
        },
        _sum: { debitAmt: true },
      }),
      this.prisma.tollTransaction.count({
        where: {
          vehicleId,
          transactionDateTime: { gte: thirtyDaysAgo },
        },
      }),
      this.prisma.bpclTransaction.aggregate({
        where: {
          vehicleId,
          txnDate: { gte: thirtyDaysAgo },
        },
        _sum: { totalAmount: true, litres: true },
      }),
      this.prisma.trip.count({
        where: {
          vehicleId,
          date: { gte: thirtyDaysAgo },
        },
      }),
      this.prisma.maintenance.aggregate({
        where: {
          vehicleId,
          date: { gte: thirtyDaysAgo },
        },
        _sum: { cost: true },
      }),
      this.prisma.tollTransaction.aggregate({
        where: { vehicleId },
        _sum: { debitAmt: true },
      }),
      this.prisma.bpclTransaction.aggregate({
        where: { vehicleId },
        _sum: { totalAmount: true },
      }),
      this.prisma.trip.count({ where: { vehicleId } }),
      this.prisma.vehicle.findFirst({
        where: { id: vehicleId },
        select: {
          pucExpiryDate: true,
          insuranceExpiryDate: true,
          fitnessExpiryDate: true,
          permitExpiryDate: true,
          taxExpiryDate: true,
        },
      }),
      this.prisma.trip.findFirst({
        where: { vehicleId },
        orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
        select: {
          driver: { select: { id: true, name: true, nickname: true } },
        },
      }),
      this.prisma.gpsHistory.findFirst({
        where: { vehicleId },
        orderBy: { recordedAt: 'desc' },
        select: { recordedAt: true },
      }),
    ]);

    const currentDriver = lastTripWithDriver?.driver ?? null;

    const lastPing = latestGpsPing?.recordedAt ?? null;
    const tenMinMs = 10 * 60 * 1000;
    let gpsStatus: 'ONLINE' | 'OFFLINE' | 'UNKNOWN' = 'UNKNOWN';
    if (lastPing) {
      gpsStatus =
        Date.now() - lastPing.getTime() < tenMinMs ? 'ONLINE' : 'OFFLINE';
    }

    const nextExpiry = this.buildNextExpiryAlert(vehicleExpiry);

    return {
      last30Days: {
        tollSpend: Number(toll30._sum.debitAmt ?? 0),
        tollTxnCount: tollTxn30,
        fuelSpend: Number(bpcl30._sum.totalAmount ?? 0),
        fuelLitres: Number(bpcl30._sum.litres ?? 0),
        tripCount: trip30,
        maintenanceCost: Number(maint30._sum.cost ?? 0),
      },
      alerts: {
        nextExpiry,
        currentDriver,
        gpsStatus,
        lastGpsPing: lastPing,
      },
      totals: {
        lifetimeToll: Number(tollLife._sum.debitAmt ?? 0),
        lifetimeFuel: Number(fuelLife._sum.totalAmount ?? 0),
        lifetimeTrips: tripLife,
      },
    };
  }

  /** Legacy lightweight summary (fuel entries, assignment) — optional UI use */
  async getVehicleSummary(id: string) {
    const vehicle = await this.requireVehicle(id);
    const since = new Date();
    since.setDate(since.getDate() - 30);
    since.setHours(0, 0, 0, 0);

    const [
      tollAgg,
      fuelAgg,
      tripCount,
      maintAgg,
    ] = await Promise.all([
      this.prisma.tollTransaction.aggregate({
        where: {
          vehicleId: id,
          transactionDateTime: { gte: since },
        },
        _sum: { debitAmt: true },
        _count: { _all: true },
      }),
      this.prisma.fuelEntry.aggregate({
        where: {
          vehicleId: id,
          date: { gte: since },
        },
        _sum: { totalCost: true, liters: true },
      }),
      this.prisma.trip.count({
        where: {
          vehicleId: id,
          date: { gte: since },
        },
      }),
      this.prisma.vehicleMaintRecord.aggregate({
        where: {
          vehicleId: id,
          date: { gte: since },
        },
        _sum: { totalCost: true },
      }),
    ]);

    const lastGps = vehicle.lastGpsUpdate;
    const minutesAgo =
      lastGps != null
        ? Math.floor((Date.now() - new Date(lastGps).getTime()) / 60_000)
        : null;
    const online =
      minutesAgo != null && minutesAgo <= 30;

    const docCandidates: { key: string; label: string; date: Date }[] = [];
    const addDoc = (label: string, d: Date | null | undefined) => {
      if (d) docCandidates.push({ key: label, label, date: new Date(d) });
    };
    addDoc('PUC', vehicle.pucExpiryDate);
    addDoc('Insurance', vehicle.insuranceExpiryDate);
    addDoc('Fitness', vehicle.fitnessExpiryDate);
    addDoc('Road tax', vehicle.taxExpiryDate);
    addDoc('Permit', vehicle.permitExpiryDate);

    const now = new Date();
    let nextExpiry: {
      label: string;
      daysLeft: number;
      severity: 'green' | 'yellow' | 'red';
    } | null = null;

    if (docCandidates.length) {
      const scored = docCandidates.map((c) => ({
        ...c,
        daysLeft: Math.ceil(
          (c.date.getTime() - now.getTime()) / 86_400_000,
        ),
      }));
      const future = scored
        .filter((x) => x.daysLeft >= 0)
        .sort((a, b) => a.daysLeft - b.daysLeft);
      const past = scored
        .filter((x) => x.daysLeft < 0)
        .sort((a, b) => b.daysLeft - a.daysLeft);
      const pick = future[0] ?? past[0];
      if (pick) {
        const sev =
          pick.daysLeft < 0
            ? ('red' as const)
            : pick.daysLeft <= 7
              ? ('red' as const)
              : pick.daysLeft <= 30
                ? ('yellow' as const)
                : ('green' as const);
        nextExpiry = {
          label:
            pick.daysLeft >= 0
              ? `${pick.key} expires in ${pick.daysLeft} day${pick.daysLeft === 1 ? '' : 's'}`
              : `${pick.key} expired ${Math.abs(pick.daysLeft)} day${Math.abs(pick.daysLeft) === 1 ? '' : 's'} ago`,
          daysLeft: pick.daysLeft,
          severity: sev,
        };
      }
    }

    const assignment = await this.prisma.driverVehicleAssignment.findFirst({
      where: { vehicleId: id, isCurrent: true },
      include: { driver: { select: { id: true, name: true } } },
    });

    return {
      last30Days: {
        tollSpend: Number(tollAgg._sum.debitAmt ?? 0),
        tollTxnCount: tollAgg._count._all,
        fuelSpend: Number(fuelAgg._sum.totalCost ?? 0),
        fuelLitres: Number(fuelAgg._sum.liters ?? 0),
        tripCount,
        maintenanceCost: Number(maintAgg._sum.totalCost ?? 0),
      },
      gps: {
        status: online ? 'ONLINE' : 'OFFLINE',
        lastSeenAt: lastGps ? new Date(lastGps).toISOString() : null,
        lastSeenMinutesAgo: minutesAgo,
      },
      nextExpiry,
      currentDriver: assignment?.driver
        ? { id: assignment.driver.id, name: assignment.driver.name }
        : null,
    };
  }

  async getVehicleTrips(vehicleId: string, page = 1, limit = 20) {
    await this.requireVehicle(vehicleId);
    const skip = (page - 1) * limit;
    const where = { vehicleId };
    const [data, total] = await Promise.all([
      this.prisma.trip.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
        include: {
          driver: { select: { id: true, name: true } },
        },
      }),
      this.prisma.trip.count({ where }),
    ]);
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getVehicleFuelTransactions(vehicleId: string, page = 1, limit = 50) {
    await this.requireVehicle(vehicleId);
    const skip = (page - 1) * limit;
    const where = { vehicleId };
    const [data, total] = await Promise.all([
      this.prisma.fuelEntry.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.fuelEntry.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
  }

  async getVehicleTollTransactions(vehicleId: string, page = 1, limit = 50) {
    await this.requireVehicle(vehicleId);
    return this.tollService.getTransactions({
      vehicleId,
      page,
      limit,
    });
  }

  async getVehicleMaintenanceHistory(vehicleId: string, page = 1, limit = 50) {
    await this.requireVehicle(vehicleId);
    const skip = (page - 1) * limit;
    const where = { vehicleId };
    const [data, total] = await Promise.all([
      this.prisma.vehicleMaintRecord.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
        include: {
          type: { select: { name: true, icon: true } },
        },
      }),
      this.prisma.vehicleMaintRecord.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
  }

  async getVehicleGpsHistory(vehicleId: string, hours = 168) {
    await this.requireVehicle(vehicleId);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const rows = await this.prisma.gpsHistory.findMany({
      where: {
        vehicleId,
        recordedAt: { gte: since },
      },
      orderBy: { recordedAt: 'asc' },
      select: {
        id: true,
        latitude: true,
        longitude: true,
        recordedAt: true,
        speed: true,
        deviceTimestamp: true,
        status: true,
        location: true,
      },
    });
    return { hours, since, points: rows };
  }

  private buildNextExpiryAlert(
    v: {
      pucExpiryDate: Date | null;
      insuranceExpiryDate: Date | null;
      fitnessExpiryDate: Date | null;
      permitExpiryDate: Date | null;
      taxExpiryDate: Date | null;
    } | null,
  ): {
    type: 'PUC' | 'INSURANCE' | 'FITNESS' | 'PERMIT' | 'RC';
    date: Date;
    daysLeft: number;
    severity: 'GREEN' | 'YELLOW' | 'RED';
  } | null {
    if (!v) return null;
    const now = Date.now();
    const candidates: {
      type: 'PUC' | 'INSURANCE' | 'FITNESS' | 'PERMIT' | 'RC';
      date: Date | null;
    }[] = [
      { type: 'PUC', date: v.pucExpiryDate },
      { type: 'INSURANCE', date: v.insuranceExpiryDate },
      { type: 'FITNESS', date: v.fitnessExpiryDate },
      { type: 'PERMIT', date: v.permitExpiryDate },
      { type: 'RC', date: v.taxExpiryDate },
    ];
    const future = candidates.filter((c) => c.date && c.date.getTime() > now);
    if (future.length === 0) return null;
    future.sort((a, b) => a.date!.getTime() - b.date!.getTime());
    const best = future[0];
    const expiry = best.date!;
    const daysLeft = Math.ceil(
      (expiry.getTime() - now) / (1000 * 60 * 60 * 24),
    );
    let severity: 'GREEN' | 'YELLOW' | 'RED';
    if (daysLeft > 30) severity = 'GREEN';
    else if (daysLeft >= 7) severity = 'YELLOW';
    else severity = 'RED';
    return { type: best.type, date: expiry, daysLeft, severity };
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
