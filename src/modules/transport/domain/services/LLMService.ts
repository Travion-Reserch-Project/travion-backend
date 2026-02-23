import OpenAI from 'openai';
import { logger } from '../../../../shared/config/logger';

export interface LLMExtractionResult {
  extracted: Record<string, string | undefined>;
  raw: Record<string, unknown>;
  missing_fields: string[];
}

export class LLMService {
  private client: OpenAI | null;
  private model: string;
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('OpenAI API key not configured');
      this.client = null;
    } else {
      this.client = new OpenAI({
        apiKey: this.apiKey,
      });
    }

    this.model = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';
  }

  /**
   * Check if LLM service is available
   */
  private ensureConfigured(): void {
    if (!this.client || !this.apiKey) {
      throw new Error(
        'OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.'
      );
    }
  }

  /**
   * Generate text completion
   */
  async generateCompletion(
    prompt: string,
    maxTokens: number = 500,
    temperature: number = 0.7
  ): Promise<string> {
    this.ensureConfigured();
    try {
      const completion = await this.client!.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: maxTokens,
        temperature,
      });

      return completion.choices[0]?.message?.content || '';
    } catch (error) {
      logger.error('Error generating completion:', error);
      throw error;
    }
  }

  /**
   * Generate completion with system prompt
   */
  async generateCompletionWithSystem(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number = 500,
    temperature: number = 0.7
  ): Promise<string> {
    this.ensureConfigured();
    try {
      const completion = await this.client!.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        max_tokens: maxTokens,
        temperature,
      });

      return completion.choices[0]?.message?.content || '';
    } catch (error) {
      logger.error('Error generating completion with system:', error);
      throw error;
    }
  }

  /**
   * Extract structured fields from query
   */
  async extractFieldsFromQuery(
    query: string,
    fields: string[],
    contextPrompt?: string
  ): Promise<LLMExtractionResult> {
    this.ensureConfigured();
    try {
      const systemPrompt = `You are a data extraction assistant. Extract the following fields from the user's query: ${fields.join(', ')}.
Return a JSON object with the extracted values. If a field is not found, set it to null.
Only return the JSON object, no other text.

Example format:
{
  "origin": "Nugegoda",
  "destination": "Embilipitiya",
  "transport_type": "any"
}`;

      const userPrompt = contextPrompt
        ? `${contextPrompt}\n\nQuery: ${query}\n\nExtract: ${fields.join(', ')}`
        : `Query: ${query}\n\nExtract: ${fields.join(', ')}`;

      const completion = await this.client!.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        max_tokens: 300,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const responseText = completion.choices[0]?.message?.content || '{}';
      const parsed: Record<string, unknown> = JSON.parse(responseText);

      const extracted: Record<string, string | undefined> = {};
      const missingFields: string[] = [];

      fields.forEach((field) => {
        const value = this.normalizeValue(parsed[field]);
        extracted[field] = value;
        if (!value) {
          missingFields.push(field);
        }
      });

      return {
        extracted,
        raw: parsed,
        missing_fields: missingFields,
      };
    } catch (error) {
      logger.error('Error extracting fields:', error);
      throw error;
    }
  }

  /**
   * Normalize extracted value
   */
  private normalizeValue(value: unknown): string | undefined {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.toLowerCase() === 'null' || trimmed === '' ? undefined : trimmed;
    }
    return String(value);
  }

  /**
   * Classify intent from text
   */
  async classifyIntent(
    text: string,
    possibleIntents: string[]
  ): Promise<{ intent: string; confidence: number }> {
    this.ensureConfigured();
    try {
      const systemPrompt = `You are an intent classifier. Classify the user's message into one of these intents: ${possibleIntents.join(', ')}.
Return a JSON object with "intent" and "confidence" (0-1).

Example:
{
  "intent": "route_query",
  "confidence": 0.95
}`;

      const completion = await this.client!.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: text,
          },
        ],
        max_tokens: 100,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const responseText = completion.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(responseText);

      return {
        intent: parsed.intent || 'unknown',
        confidence: parsed.confidence || 0.5,
      };
    } catch (error) {
      logger.error('Error classifying intent:', error);
      return { intent: 'unknown', confidence: 0.5 };
    }
  }

  /**
   * Generate chat response with conversation context
   */
  async generateChatResponse(
    systemPrompt: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    userMessage: string
  ): Promise<string> {
    this.ensureConfigured();
    try {
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        {
          role: 'system',
          content: systemPrompt,
        },
      ];

      // Add conversation history
      conversationHistory.forEach((msg) => {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      });

      // Add current user message
      messages.push({
        role: 'user',
        content: userMessage,
      });

      const completion = await this.client!.chat.completions.create({
        model: this.model,
        messages,
        max_tokens: 800,
        temperature: 0.7,
      });

      return completion.choices[0]?.message?.content || '';
    } catch (error) {
      logger.error('Error generating chat response:', error);
      throw error;
    }
  }

  /**
   * Summarize conversation
   */
  async summarizeConversation(messages: string[]): Promise<string> {
    this.ensureConfigured();
    try {
      const conversation = messages.join('\n');

      const systemPrompt = `Summarize this conversation concisely (max 100 words). Focus on the main query and outcome.`;

      const completion = await this.client!.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: conversation,
          },
        ],
        max_tokens: 150,
        temperature: 0.5,
      });

      return completion.choices[0]?.message?.content || 'No summary available';
    } catch (error) {
      logger.error('Error summarizing conversation:', error);
      return 'Summary unavailable';
    }
  }

  /**
   * Translate text
   */
  async translate(text: string, targetLanguage: 'si' | 'ta' | 'en'): Promise<string> {
    this.ensureConfigured();
    try {
      const languageNames = {
        si: 'Sinhala',
        ta: 'Tamil',
        en: 'English',
      };

      const systemPrompt = `Translate the following text to ${languageNames[targetLanguage]}. Return only the translation.`;

      const completion = await this.client!.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: text,
          },
        ],
        max_tokens: 500,
        temperature: 0.3,
      });

      return completion.choices[0]?.message?.content || text;
    } catch (error) {
      logger.error('Error translating text:', error);
      return text;
    }
  }

  /**
   * Extract intent and entities for transport query
   */
  async extractIntentAndEntities(message: string): Promise<{
    intent: string;
    origin?: string;
    destination?: string;
    transport_type?: string;
  }> {
    try {
      this.ensureConfigured();

      const systemPrompt = `You are an intent extractor for Sri Lankan transport queries.
Extract:
- intent: "transport_query", "general_question", or "other"
- origin: starting city (if mentioned)
- destination: target city (if mentioned)  
- transport_type: "bus", "train", "any", or null

Return ONLY valid JSON.`;

      const completion = await this.client!.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: `Analyze this message: "${message}"`,
          },
        ],
        max_tokens: 150,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const response = completion.choices[0]?.message?.content || '{}';
      return JSON.parse(response);
    } catch (error) {
      logger.warn('Error extracting intent:', error);
      return { intent: 'other' };
    }
  }

  /**
   * Generate explanation for ranked routes
   */
  async generateRouteExplanation(
    rankedRoutes: Array<{
      route_id: string;
      transport_type: string;
      operator_name: string;
      dynamic: {
        duration_min: number;
        distance_km: number;
        weather_risk: number;
        traffic_delay_min: number;
      };
      static: {
        base_fare_lkr: number;
        scenic_score: number;
        comfort_score: number;
      };
      score: number;
    }>,
    origin: string,
    destination: string
  ): Promise<string> {
    try {
      this.ensureConfigured();

      const routesDescription = rankedRoutes
        .slice(0, 3) // Top 3 routes
        .map(
          (route, idx) => `
Route Option ${idx + 1}:
- Transport: ${route.transport_type} (${route.operator_name})
- Duration: ${route.dynamic.duration_min} minutes
- Distance: ${route.dynamic.distance_km.toFixed(1)} km
- Fare: LKR ${route.static.base_fare_lkr}
- Weather Risk: ${(route.dynamic.weather_risk * 100).toFixed(0)}%
- Traffic Delay: ${route.dynamic.traffic_delay_min} minutes
- Comfort Score: ${(route.static.comfort_score * 100).toFixed(0)}%
- Scenic Score: ${(route.static.scenic_score * 100).toFixed(0)}%
- Overall Score: ${(route.score * 100).toFixed(0)}/100
`
        )
        .join('\n');

      const systemPrompt = `You are a helpful Sri Lankan transport assistant.
Based on the structured route data, explain why the top route is recommended.
Be concise, specific, and do NOT invent routes or details.
Only reference the data provided.`;

      const completion = await this.client!.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: `I want to go from ${origin} to ${destination}.

${routesDescription}

Recommend the best option and explain why.`,
          },
        ],
        max_tokens: 300,
        temperature: 0.7,
      });

      return (
        completion.choices[0]?.message?.content ||
        'I recommend the top-ranked route based on your preferences.'
      );
    } catch (error) {
      logger.warn('Error generating explanation:', error);
      return 'I found several transport options for you. The top option offers the best balance of time, cost, and comfort.';
    }
  }
}
