import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../../prisma/prisma.service';
import { MetaSenderService } from './meta-sender.service';

interface ParsedTrip {
  date?: string;
  clientName?: string;
  fromLocation?: string;
  toLocation?: string;
  distanceKm?: number;
  notes?: string;
  vehicleNumber?: string;
}

interface ClaudeParseResult {
  intent: 'TRIP' | 'FUEL' | 'PAYMENT' | 'EXPENSE' | 'UNKNOWN';
  trips?: ParsedTrip[];
  rawSummary?: string;
}

@Injectable()
export class MetaTripParserService {
  private readonly logger = new Logger(MetaTripParserService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private sender: MetaSenderService,
  ) {}

  private generateTripNumber(): string {
    const now = new Date();
    const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const rand = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
    return `TRP-${date}-${rand}`;
  }

  /**
   * Called after an inbound WhatsApp text message is saved.
   * Parses the message, extracts trips, creates Trip records, replies to driver.
   */
  async parseAndCreateTrips(messageId: string): Promise<void> {
    const message = await this.prisma.whatsappMetaMessage.findUnique({
      where: { id: messageId },
      include: { contact: { include: { driver: true } } },
    });

    if (
      !message ||
      message.direction !== 'INBOUND' ||
      message.type !== 'text' ||
      !message.text
    ) {
      return;
    }
    if (!message.contact.driverId) {
      this.logger.log(
        `Message ${messageId}: contact not linked to driver, skipping`,
      );
      return;
    }

    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY')?.trim();
    if (!apiKey) {
      this.logger.warn('ANTHROPIC_API_KEY not set, skipping trip parse');
      return;
    }
    const anthropic = new Anthropic({ apiKey });

    const [clients, vehicles, locations] = await Promise.all([
      this.prisma.client.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
      }),
      this.prisma.vehicle.findMany({
        where: { isDeleted: false },
        select: { id: true, regNumber: true, currentKm: true },
      }),
      this.prisma.location
        .findMany({
          where: { isActive: true },
          select: { name: true },
        })
        .catch(() => [] as { name: string }[]),
    ]);

    const parsed = await this.classifyAndParse(anthropic, message.text, {
      clients: clients.map((c) => c.name),
      vehicles: vehicles.map((v) => v.regNumber),
      knownLocations: locations.map((l) => l.name),
    });

    if (parsed.intent !== 'TRIP' || !parsed.trips?.length) {
      this.logger.log(
        `Message ${messageId}: not a trip (intent=${parsed.intent})`,
      );
      return;
    }

    const driverId = message.contact.driverId;
    const created: string[] = [];

    for (const trip of parsed.trips) {
      const vehicleResolved = await this.resolveVehicleForDriver(
        driverId,
        vehicles,
        trip.vehicleNumber,
      );
      if (!vehicleResolved) {
        this.logger.warn(
          `Message ${messageId}: no vehicle for trip ${trip.fromLocation}→${trip.toLocation}`,
        );
        continue;
      }

      const clientNameResolved = trip.clientName
        ? this.matchClientName(clients, trip.clientName)
        : null;

      const tripDate = trip.date ? new Date(trip.date) : new Date();
      const dateOnly = new Date(
        tripDate.getFullYear(),
        tripDate.getMonth(),
        tripDate.getDate(),
      );

      const from = (trip.fromLocation || 'Unknown').trim().slice(0, 100);
      const to = (trip.toLocation || '').trim().slice(0, 100) || null;

      const startKm = vehicleResolved.currentKm;
      let endKm: number | null = null;
      let distanceKm = trip.distanceKm ?? null;
      if (distanceKm != null && distanceKm > 0) {
        endKm = startKm + distanceKm;
      } else if (distanceKm == null && trip.notes) {
        const m = trip.notes.match(/(\d+(?:\.\d+)?)\s*km/i);
        if (m) {
          distanceKm = parseFloat(m[1]);
          if (distanceKm > 0) endKm = startKm + distanceKm;
        }
      }

      await this.prisma.trip.create({
        data: {
          tripNumber: this.generateTripNumber(),
          vehicleId: vehicleResolved.id,
          driverId,
          date: dateOnly,
          startKm,
          endKm,
          distanceKm,
          startLocation: from,
          endLocation: to,
          clientName: (clientNameResolved ?? trip.clientName?.trim()) || null,
          notes: trip.notes?.trim() || null,
          status: 'COMPLETED',
          endTime: new Date(),
          source: 'WHATSAPP_META',
        },
      });

      created.push(`${from} → ${to || '?'}`);
    }

    if (created.length === 0) {
      const waId = message.contact.waId;
      try {
        await this.sender.sendText(
          waId,
          '⚠️ Could not log trip: no vehicle found. Mention vehicle number or ensure you have a current vehicle assignment.',
        );
      } catch (e) {
        this.logger.warn(`Reply failed for ${waId}: ${String(e)}`);
      }
      return;
    }

    const waId = message.contact.waId;
    const replyText =
      created.length === 1
        ? `✅ Trip logged: ${created[0]}`
        : `✅ ${created.length} trips logged:\n${created.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;
    try {
      await this.sender.sendText(waId, replyText);
    } catch (e) {
      this.logger.warn(`Reply failed for ${waId}: ${String(e)}`);
    }
  }

  private matchClientName(
    clients: { id: string; name: string }[],
    raw: string,
  ): string | null {
    const q = raw.toLowerCase().trim();
    if (!q) return null;
    const exact = clients.find((c) => c.name.toLowerCase() === q);
    if (exact) return exact.name;
    const contains = clients.find(
      (c) =>
        c.name.toLowerCase().includes(q) || q.includes(c.name.toLowerCase()),
    );
    return contains?.name ?? null;
  }

  private async resolveVehicleForDriver(
    driverId: string,
    vehicles: { id: string; regNumber: string; currentKm: number }[],
    vehicleNumber?: string,
  ): Promise<{ id: string; currentKm: number } | null> {
    if (vehicleNumber?.trim()) {
      const norm = vehicleNumber.replace(/\s/g, '').toUpperCase();
      const hit = vehicles.find(
        (v) => v.regNumber.replace(/\s/g, '').toUpperCase() === norm,
      );
      if (hit) return { id: hit.id, currentKm: hit.currentKm };
    }
    const assign = await this.prisma.driverVehicleAssignment.findFirst({
      where: { driverId, isCurrent: true },
      include: { vehicle: { select: { id: true, currentKm: true } } },
    });
    if (assign?.vehicle) {
      return { id: assign.vehicle.id, currentKm: assign.vehicle.currentKm };
    }
    return null;
  }

  private async classifyAndParse(
    anthropic: Anthropic,
    text: string,
    context: { clients: string[]; vehicles: string[]; knownLocations: string[] },
  ): Promise<ClaudeParseResult> {
    const systemPrompt = `You are a trip data extractor for an Indian cold-chain logistics fleet.
The driver writes in Hindi, Marathi, English, or mixed (Hinglish). Extract trip details.

Known clients: ${context.clients.join(', ')}
Known vehicles: ${context.vehicles.join(', ')}
Known locations: ${context.knownLocations.slice(0, 30).join(', ')}

Return STRICT JSON matching this schema:
{
  "intent": "TRIP" | "FUEL" | "PAYMENT" | "EXPENSE" | "UNKNOWN",
  "trips": [
    {
      "date": "YYYY-MM-DD or null if today",
      "clientName": "matched client name or null",
      "fromLocation": "pickup location",
      "toLocation": "drop location",
      "distanceKm": number or null,
      "notes": "any extra info",
      "vehicleNumber": "if mentioned"
    }
  ],
  "rawSummary": "one-line summary in English"
}

Rules:
- If the message mentions multiple trips (e.g. "Palak→Andheri 50km, then Andheri→Worli 20km"), return multiple trip objects
- Match client/vehicle names fuzzily against the known lists
- If the message is NOT about trips (payment, fuel, greeting), set intent accordingly with empty trips array
- Dates in Indian format: 13/4 means 13 April current year
- Return ONLY JSON, no markdown, no explanation`;

    try {
      const resp = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: text }],
      });
      const content = resp.content[0];
      if (content.type !== 'text') throw new Error('Non-text response');
      const cleaned = content.text.replace(/```json|```/g, '').trim();
      return JSON.parse(cleaned) as ClaudeParseResult;
    } catch (e) {
      this.logger.error(`Claude parse failed: ${String(e)}`);
      return { intent: 'UNKNOWN', trips: [] };
    }
  }
}
