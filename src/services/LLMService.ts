import OpenAI from 'openai';
import { logger } from '../config/logger';

export interface TripExtraction {
  origin?: string;
  destination?: string;
  departureDate?: string;
  departureTime?: string;
}

export interface TripExtractionResult {
  extracted: TripExtraction;
  missingFields: string[];
  raw: Record<string, any>;
}

export class LLMService {
  private client: OpenAI;
  private model: string;

  constructor(
    apiKey: string | undefined = process.env.OPENAI_API_KEY,
    model: string = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  ) {
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    this.client = new OpenAI({ apiKey });
    this.model = model;

    logger.info('LLMService initialized', {
      model: this.model,
      apiKeyPresent: Boolean(apiKey),
    });
  }

  async extractTripDetails(
    message: string,
    seed: TripExtraction = {}
  ): Promise<TripExtractionResult> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You extract structured travel details. Return JSON with keys origin, destination, departure_date (YYYY-MM-DD), departure_time (HH:MM 24h). Use null for unknown. Do not guess stations; keep what user said.',
        },
        {
          role: 'user',
          content: JSON.stringify({ message, defaults: seed }),
        },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content returned from LLM');
    }

    let parsed: Record<string, any>;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      throw new Error('Failed to parse LLM response');
    }

    const extracted: TripExtraction = {
      origin: this.normalizeValue(parsed.origin) || seed.origin,
      destination: this.normalizeValue(parsed.destination) || seed.destination,
      departureDate: this.normalizeValue(parsed.departure_date) || seed.departureDate,
      departureTime: this.normalizeValue(parsed.departure_time) || seed.departureTime,
    };

    const missingFields = ['origin', 'destination', 'departureDate', 'departureTime'].filter(
      (field) => !(extracted as any)[field]
    );

    return {
      extracted,
      missingFields,
      raw: parsed,
    };
  }

  private normalizeValue(value: any): string | undefined {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }
    return String(value);
  }
}
