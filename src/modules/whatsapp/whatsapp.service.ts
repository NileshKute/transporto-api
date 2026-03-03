import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsAppParserService, ParsedResult } from './whatsapp-parser.service';
import twilio from 'twilio';

const CONFIDENCE_THRESHOLD = 0.7;

@Injectable()
export class WhatsAppService {
  private twilioClient: ReturnType<typeof twilio> | null = null;

  constructor(
    private prisma: PrismaService,
    private parser: WhatsAppParserService,
  ) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (accountSid && authToken) {
      this.twilioClient = twilio(accountSid, authToken);
    }
  }

  private getTwilioWhatsAppNumber(): string {
    const num = process.env.TWILIO_WHATSAPP_NUMBER;
    if (!num) return '';
    return num.startsWith('whatsapp:') ? num : `whatsapp:${num}`;
  }

  async findAll(query: any) {
    const { status, parsedType, page = 1, limit = 10 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = {};
    if (status) where.status = status;
    if (parsedType) where.parsedType = parsedType;
    const [data, total] = await Promise.all([
      this.prisma.whatsAppMessage.findMany({
        where,
        skip,
        take: Number(limit),
        include: { driver: { select: { name: true, phone: true } } },
        orderBy: { receivedAt: 'desc' },
      }),
      this.prisma.whatsAppMessage.count({ where }),
    ]);
    return {
      data,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    };
  }

  /**
   * Verify Twilio webhook signature. Returns true if valid or if validation is skipped (no auth token).
   */
  verifyTwilioSignature(
    authToken: string,
    signature: string,
    url: string,
    params: Record<string, string>,
  ): boolean {
    if (!authToken || !signature) return false;
    return twilio.validateRequest(authToken, signature, url, params);
  }

  /**
   * Build TwiML response with optional message body.
   */
  buildTwiMLResponse(messageBody?: string): string {
    if (!messageBody) {
      return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
    }
    const escaped = messageBody
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`;
  }

  private generateTripNumber(): string {
    const now = new Date();
    const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const rand = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
    return `TRP-${date}-${rand}`;
  }

  private generateFuelEntryNumber(): string {
    const now = new Date();
    const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const rand = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
    return `FUEL-${date}-${rand}`;
  }

  async processWebhook(
    body: any,
    signature?: string,
    webhookUrl?: string,
  ): Promise<{ twiml: string }> {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (authToken && webhookUrl && signature) {
      const params = body as Record<string, string>;
      const valid = this.verifyTwilioSignature(
        authToken,
        signature,
        webhookUrl,
        params,
      );
      if (!valid) {
        throw new BadRequestException('Invalid Twilio signature');
      }
    }

    const fromPhone = body.From || body.from || '';
    const messageText = (body.Body || body.body || body.message || '').trim();
    const twilioMessageSid = body.MessageSid || body.messageSid || null;
    const twilioStatus = body.SmsStatus || null;
    const mediaUrl = body.MediaUrl0 || null;

    const normalizedPhone = fromPhone.replace(/\D/g, '').slice(-10);

    const driver = await this.prisma.driver.findFirst({
      where: { phone: { endsWith: normalizedPhone } },
    });

    const parsed: ParsedResult = this.parser.parse(messageText);

    let autoReplyText: string | null = null;
    let createdEntity: { tripNumber?: string; origin?: string; destination?: string } | null = null;

    if (parsed.confidence > CONFIDENCE_THRESHOLD) {
      const data = parsed.parsedData as Record<string, unknown>;

      if (parsed.type === 'TRIP_START') {
        const vehicle_reg = (data.vehicle_reg as string)?.trim();
        const vehicle = vehicle_reg
          ? await this.prisma.vehicle.findFirst({
              where: {
                regNumber: { contains: vehicle_reg.replace(/\s/g, ''), mode: 'insensitive' },
                isDeleted: false,
              },
            })
          : null;
        const driverId = driver?.id;
        const vehicleId = vehicle?.id;
        if (driverId && vehicleId) {
          const tripNumber = this.generateTripNumber();
          const origin = (data.origin as string) || '';
          const destination = (data.destination as string) || '';
          const vehicleRec = await this.prisma.vehicle.findUnique({
            where: { id: vehicleId },
            select: { currentKm: true },
          });
          const startKm = vehicleRec?.currentKm ?? 0;
          await this.prisma.trip.create({
            data: {
              tripNumber,
              vehicleId,
              driverId,
              date: new Date(),
              startKm,
              startLocation: origin,
              endLocation: destination,
              status: 'IN_PROGRESS',
              source: 'WHATSAPP',
            },
          });
          createdEntity = { tripNumber, origin, destination };
        }
      } else if (parsed.type === 'TRIP_END') {
        const vehicle_reg = (data.vehicle_reg as string)?.trim();
        const km_reading = Number(data.km_reading);
        const vehicle = vehicle_reg
          ? await this.prisma.vehicle.findFirst({
              where: {
                regNumber: { contains: vehicle_reg.replace(/\s/g, ''), mode: 'insensitive' },
                isDeleted: false,
              },
            })
          : null;
        if (vehicle && !isNaN(km_reading)) {
          const trip = await this.prisma.trip.findFirst({
            where: { vehicleId: vehicle.id, status: 'IN_PROGRESS' },
            orderBy: { date: 'desc' },
          });
          if (trip) {
            const distanceKm = km_reading - trip.startKm;
            await this.prisma.trip.update({
              where: { id: trip.id },
              data: {
                status: 'COMPLETED',
                endKm: km_reading,
                distanceKm,
                endTime: new Date(),
              },
            });
            await this.prisma.vehicle.update({
              where: { id: vehicle.id },
              data: { currentKm: km_reading },
            });
            autoReplyText = `✅ Trip ${trip.tripNumber} completed. End km: ${km_reading}`;
          }
        }
      } else if (parsed.type === 'FUEL') {
        const vehicle_reg = (data as { vehicle_reg?: string }).vehicle_reg;
        const liters = Number((data.liters as number));
        const amount = Number((data.amount as number));
        const station = (data.station as string) || '';
        const vehicle = vehicle_reg
          ? await this.prisma.vehicle.findFirst({
              where: {
                regNumber: { contains: String(vehicle_reg).replace(/\s/g, ''), mode: 'insensitive' },
                isDeleted: false,
              },
            })
          : driver
            ? await this.prisma.driverVehicleAssignment
                .findFirst({
                  where: { driverId: driver.id, isCurrent: true },
                  include: { vehicle: true },
                })
                .then((a) => a?.vehicle)
            : null;
        if (vehicle && driver?.id && !isNaN(liters) && !isNaN(amount)) {
          const entryNumber = this.generateFuelEntryNumber();
          const ratePerLiter = liters > 0 ? amount / liters : 0;
          const vehicleRec = await this.prisma.vehicle.findUnique({
            where: { id: vehicle.id },
            select: { currentKm: true },
          });
          const odometer = vehicleRec?.currentKm ?? 0;
          await this.prisma.fuelEntry.create({
            data: {
              entryNumber,
              vehicleId: vehicle.id,
              driverId: driver.id,
              date: new Date(),
              liters,
              totalCost: amount,
              ratePerLiter,
              odometer,
              fuelStation: station,
              source: 'WHATSAPP',
            },
          });
          autoReplyText = `✅ Fuel recorded: ${liters}L ₹${amount} at ${station}`;
        }
      } else if (parsed.type === 'EMERGENCY') {
        const vehicle_reg = (data.vehicle_reg as string)?.trim();
        const location = (data.location as string) || '';
        const type = (data.type as string) || 'OTHER';
        const vehicle = vehicle_reg
          ? await this.prisma.vehicle.findFirst({
              where: {
                regNumber: { contains: vehicle_reg.replace(/\s/g, ''), mode: 'insensitive' },
                isDeleted: false,
              },
            })
          : null;
        if (vehicle && driver?.id) {
          const validType = [
            'PUNCTURE', 'ACCIDENT', 'BREAKDOWN', 'ENGINE_FAILURE', 'FUEL_EMPTY',
            'ELECTRICAL_FAILURE', 'BRAKE_FAILURE', 'FIRE', 'THEFT', 'OTHER',
          ].includes(type) ? type : 'OTHER';
          await this.prisma.emergency.create({
            data: {
              vehicleId: vehicle.id,
              driverId: driver.id,
              type: validType as any,
              description: `WhatsApp: ${type} at ${location}`,
              location,
              date: new Date(),
              source: 'WHATSAPP',
            },
          });
          autoReplyText = `✅ Emergency (${validType}) recorded at ${location}. Help is on the way.`;
        }
      }
    }

    if (createdEntity?.tripNumber) {
      autoReplyText = `✅ Trip ${createdEntity.tripNumber} started: ${createdEntity.origin} → ${createdEntity.destination}`;
    }

    await this.prisma.whatsAppMessage.create({
      data: {
        driverId: driver?.id ?? null,
        fromPhone,
        direction: 'INBOUND',
        message: messageText,
        mediaUrl,
        parsedType: parsed.type,
        parsedData: parsed.parsedData as any,
        confidence: parsed.confidence,
        confidenceScore: parsed.confidence,
        status: 'PROCESSED',
        processedAt: new Date(),
        twilioSid: twilioMessageSid,
        twilioMessageSid,
        twilioStatus,
        autoReplyText,
      },
    });

    // Twilio sends the auto-reply when we return TwiML with <Message>
    const twiml = this.buildTwiMLResponse(autoReplyText || undefined);
    return { twiml };
  }

  async sendMessage(dto: { to: string; body: string; driverId?: string }) {
    const { to, body, driverId } = dto;
    if (!this.twilioClient) {
      throw new BadRequestException('Twilio is not configured');
    }
    const fromNum = this.getTwilioWhatsAppNumber();
    if (!fromNum) {
      throw new BadRequestException('TWILIO_WHATSAPP_NUMBER is not set');
    }
    const toNum = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

    const result = await this.twilioClient.messages.create({
      body,
      from: fromNum,
      to: toNum,
    });

    const driver = driverId
      ? await this.prisma.driver.findUnique({ where: { id: driverId } }).catch(() => null)
      : await this.prisma.driver.findFirst({
          where: { phone: { endsWith: to.replace(/\D/g, '').slice(-10) } },
        });

    await this.prisma.whatsAppMessage.create({
      data: {
        driverId: driver?.id ?? null,
        fromPhone: fromNum,
        toPhone: toNum,
        direction: 'OUTBOUND',
        message: body,
        twilioSid: result.sid,
        twilioMessageSid: result.sid,
        twilioStatus: result.status,
        status: 'PROCESSED',
        processedAt: new Date(),
      },
    });

    return {
      success: true,
      sid: result.sid,
      status: result.status,
    };
  }
}
