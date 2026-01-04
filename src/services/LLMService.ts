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
    seed: TripExtraction = {},
    expectedField?: string
  ): Promise<TripExtractionResult> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: expectedField
            ? `You extract structured travel details from user input. The user is specifically answering a question about: "${expectedField}". Return JSON with keys origin, destination, departure_date (YYYY-MM-DD format), departure_time (HH:MM 24-hour format). For the field "${expectedField}", extract the user's response carefully. For time: if user says "3:00pm" convert to "15:00", "2:30am" to "02:30", etc. Use null for unknown fields. Do not guess or hallucinate locations; keep exactly what user said.`
            : 'You extract structured travel details. Return JSON with keys origin, destination, departure_date (YYYY-MM-DD format), departure_time (HH:MM 24-hour format). For time: if user says "3:00pm" convert to "15:00", "2:30am" to "02:30", etc. Use null for unknown fields. Do not guess or hallucinate locations; keep exactly what user said.',
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

  async generateFollowUpQuestion(
    extracted: TripExtraction,
    missingFields: string[]
  ): Promise<string> {
    const friendlyLabels: Record<string, string> = {
      origin: 'starting location',
      destination: 'destination',
      departureDate: 'travel date (YYYY-MM-DD)',
      departureTime: 'travel time (HH:MM 24h)',
    };

    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: `You are Travion, a warm, intelligent, and highly capable travel assistant. Your mission is to help users plan their journeys effortlessly. Follow these guidelines:

TONE & PERSONALITY:
- Be genuinely friendly, encouraging, and helpful
- Use conversational language (not robotic)
- Show enthusiasm about their travel plans
- Make users feel heard and understood

GREETING LOGIC:
- If extracting has 0-1 fields filled (e.g., user just said "hi", "hey", "help"), greet warmly as Travion and ask ONE smart question
- Example greeting: "Hi there! I'm Travion, your travel companion. To find the best options for you, could you tell me where you're traveling from?"
- Only include greeting when very little is known; otherwise skip it

QUESTION GENERATION (Multi-turn):
- Ask ONE focused, natural question per turn
- Prioritize by importance: Origin → Destination → Date → Time
- Reference known info to feel personalized: "Since you're heading to [destination], what date works best?"
- Make questions specific and scannable (include format hints in parentheses when necessary)
- Avoid asking for info already provided

CONTEXT AWARENESS:
- If origin is Sri Lankan city, suggest common destinations intelligently
- If time is missing and date is provided, ask for time: "What time would you prefer to depart on [date]?"
- If only one field is missing, acknowledge progress: "Great! Just one more thing—what time works for you?"
- Adapt language based on what's known (less formal greeting if some details exist)

EFFICIENCY:
- Keep questions short (1-2 sentences max)
- Be direct and clear
- Avoid unnecessary elaboration
- Guide users toward completion without making them feel rushed

OUTPUT:
- Return ONLY the question (with brief greeting if starting fresh)
- No extra text, explanations, or follow-ups
- Ensure the question is immediately actionable`,
        },
        {
          role: 'user',
          content: JSON.stringify({ extracted, missingFields, labels: friendlyLabels }),
        },
      ],
    });

    const question = completion.choices[0]?.message?.content?.trim();
    if (!question) {
      throw new Error('No follow-up question generated');
    }
    return question;
  }
}
