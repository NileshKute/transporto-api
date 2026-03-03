import { Injectable } from '@nestjs/common';

export type ParsedMessageType =
  | 'TRIP_START'
  | 'TRIP_END'
  | 'FUEL'
  | 'EMERGENCY'
  | 'LOCATION'
  | 'GENERAL';

export interface ParsedResult {
  type: ParsedMessageType;
  parsedData: Record<string, unknown>;
  confidence: number;
}

@Injectable()
export class WhatsAppParserService {
  /**
   * Parse incoming WhatsApp message into one of 6 types using regex.
   * Returns { type, parsedData, confidence }.
   */
  parse(body: string): ParsedResult {
    const trimmed = (body || '').trim();
    const lower = trimmed.toLowerCase();

    // TRIP_START: "trip start [origin] to [destination] [vehicle_reg]"
    const tripStartMatch = lower.match(
      /^trip\s+start\s+(.+?)\s+to\s+(.+?)\s+([A-Za-z0-9\s\-]+)\s*$/i,
    );
    if (tripStartMatch) {
      return {
        type: 'TRIP_START',
        parsedData: {
          origin: tripStartMatch[1].trim(),
          destination: tripStartMatch[2].trim(),
          vehicle_reg: tripStartMatch[3].trim(),
        },
        confidence: 0.95,
      };
    }

    // TRIP_END: "trip end [vehicle_reg] [km_reading]"
    const tripEndMatch = lower.match(
      /^trip\s+end\s+([A-Za-z0-9\s\-]+)\s+(\d+(?:\.\d+)?)\s*$/i,
    );
    if (tripEndMatch) {
      return {
        type: 'TRIP_END',
        parsedData: {
          vehicle_reg: tripEndMatch[1].trim(),
          km_reading: parseFloat(tripEndMatch[2]),
        },
        confidence: 0.95,
      };
    }

    // FUEL: "fuel [liters]L ₹[amount] [station]"
    const fuelMatch = trimmed.match(
      /^fuel\s+(\d+(?:\.\d+)?)\s*L\s*[₹Rs.]?\s*(\d+(?:\.\d+)?)\s+(.+)$/i,
    );
    if (fuelMatch) {
      return {
        type: 'FUEL',
        parsedData: {
          liters: parseFloat(fuelMatch[1]),
          amount: parseFloat(fuelMatch[2]),
          station: fuelMatch[3].trim(),
        },
        confidence: 0.92,
      };
    }

    // EMERGENCY: "emergency [type] [location] [vehicle_reg]"
    const emergencyMatch = lower.match(
      /^emergency\s+(\w+(?:\s+\w+)?)\s+(.+?)\s+([A-Za-z0-9\s\-]+)\s*$/i,
    );
    if (emergencyMatch) {
      const typeMap: Record<string, string> = {
        puncture: 'PUNCTURE',
        accident: 'ACCIDENT',
        breakdown: 'BREAKDOWN',
        enginefailure: 'ENGINE_FAILURE',
        'engine failure': 'ENGINE_FAILURE',
        fuelempty: 'FUEL_EMPTY',
        'fuel empty': 'FUEL_EMPTY',
        electricalfailure: 'ELECTRICAL_FAILURE',
        'electrical failure': 'ELECTRICAL_FAILURE',
        brakefailure: 'BRAKE_FAILURE',
        'brake failure': 'BRAKE_FAILURE',
        fire: 'FIRE',
        theft: 'THEFT',
        other: 'OTHER',
      };
      const rawType = emergencyMatch[1].replace(/\s+/g, ' ').trim().toLowerCase();
      const key = rawType.replace(/\s+/g, '');
      const emergencyType =
        typeMap[key] || typeMap[rawType] || 'OTHER';
      return {
        type: 'EMERGENCY',
        parsedData: {
          type: emergencyType,
          location: emergencyMatch[2].trim(),
          vehicle_reg: emergencyMatch[3].trim(),
        },
        confidence: 0.9,
      };
    }

    // LOCATION: "reached [place]" or "location [place]"
    const reachedMatch = lower.match(/^reached\s+(.+)$/);
    if (reachedMatch) {
      return {
        type: 'LOCATION',
        parsedData: { place: reachedMatch[1].trim() },
        confidence: 0.88,
      };
    }
    const locationMatch = lower.match(/^location\s+(.+)$/);
    if (locationMatch) {
      return {
        type: 'LOCATION',
        parsedData: { place: locationMatch[1].trim() },
        confidence: 0.88,
      };
    }

    // GENERAL: anything else
    return {
      type: 'GENERAL',
      parsedData: { raw: trimmed },
      confidence: 0.5,
    };
  }
}
