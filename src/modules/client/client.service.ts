import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ClientService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: any) {
    const { search, isActive, page = 1, limit = 10 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = {};
    if (typeof isActive === 'boolean') where.isActive = isActive;
    if (isActive === 'true') where.isActive = true;
    if (isActive === 'false') where.isActive = false;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { contactPerson: { contains: search, mode: 'insensitive' } },
        { gstNumber: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { name: 'asc' },
      }),
      this.prisma.client.count({ where }),
    ]);
    return {
      data,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    };
  }

  async findOne(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        clientVehicles: {
          where: { isActive: true },
          include: { vehicle: { select: { id: true, regNumber: true, make: true, model: true, type: true } } },
        },
      },
    });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  async create(dto: any) {
    return this.prisma.client.create({
      data: {
        name: dto.name,
        address: dto.address,
        gstNumber: dto.gstNumber,
        contactPerson: dto.contactPerson,
        contactPhone: dto.contactPhone,
        contactEmail: dto.contactEmail,
        billingType: dto.billingType ?? 'MIXED',
        contractRate: dto.contractRate != null ? dto.contractRate : undefined,
        adhocTripRate: dto.adhocTripRate != null ? dto.adhocTripRate : undefined,
        paymentTermsDays: dto.paymentTermsDays ?? 15,
        isActive: dto.isActive !== false,
      },
    });
  }

  async update(id: string, dto: any) {
    await this.findOne(id);
    return this.prisma.client.update({
      where: { id },
      data: {
        name: dto.name,
        address: dto.address,
        gstNumber: dto.gstNumber,
        contactPerson: dto.contactPerson,
        contactPhone: dto.contactPhone,
        contactEmail: dto.contactEmail,
        billingType: dto.billingType,
        contractRate: dto.contractRate,
        adhocTripRate: dto.adhocTripRate,
        paymentTermsDays: dto.paymentTermsDays,
        isActive: dto.isActive,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.client.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async addVehicle(clientId: string, dto: { vehicleId: string; billingType?: string; monthlyRate?: number; tripRate?: number; route?: string }) {
    await this.findOne(clientId);
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    const existing = await this.prisma.clientVehicle.findUnique({
      where: { clientId_vehicleId: { clientId, vehicleId: dto.vehicleId } },
    });
    if (existing) {
      if (existing.isActive) throw new ConflictException('Vehicle already assigned to this client');
      return this.prisma.clientVehicle.update({
        where: { id: existing.id },
        data: {
          billingType: (dto.billingType as any) ?? 'MONTHLY_CONTRACT',
          monthlyRate: dto.monthlyRate,
          tripRate: dto.tripRate,
          route: dto.route,
          isActive: true,
        },
        include: { vehicle: { select: { regNumber: true, make: true, model: true } } },
      });
    }
    return this.prisma.clientVehicle.create({
      data: {
        clientId,
        vehicleId: dto.vehicleId,
        billingType: (dto.billingType as any) ?? 'MONTHLY_CONTRACT',
        monthlyRate: dto.monthlyRate,
        tripRate: dto.tripRate,
        route: dto.route,
      },
      include: { vehicle: { select: { regNumber: true, make: true, model: true } } },
    });
  }

  async removeVehicle(clientId: string, vehicleId: string) {
    const cv = await this.prisma.clientVehicle.findUnique({
      where: { clientId_vehicleId: { clientId, vehicleId } },
    });
    if (!cv) throw new NotFoundException('Vehicle assignment not found');
    return this.prisma.clientVehicle.update({
      where: { id: cv.id },
      data: { isActive: false },
    });
  }
}
