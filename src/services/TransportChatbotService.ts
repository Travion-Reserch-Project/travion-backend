import { ConversationService } from './ConversationService';
import { TransportService } from './TransportService';
import { WeatherService } from './WeatherService';
import { LLMService } from './LLMService';
import { logger } from '../config/logger';
import { IMessage } from '../models/Message';

export interface ChatRequest {
  user_id: string;
  message: string;
  conversation_id?: string;
  language?: 'en' | 'si' | 'ta';
  context?: {
    current_location?: {
      lat: number;
      lng: number;
    };
  };
}

export interface ChatResponse {
  conversation_id: string;
  message: string;
  message_type: IMessage['message_type'];
  metadata?: {
    intent?: string;
    locations_identified?: Array<{
      name: string;
      city_id?: number;
      confidence: number;
    }>;
    transport_recommendations?: unknown;
    weather_info?: unknown;
    processing_time_ms: number;
  };
  suggestions?: string[];
}

export interface ExtractedIntent {
  intent:
    | 'route_query'
    | 'weather_query'
    | 'location_info'
    | 'general_question'
    | 'greeting'
    | 'unknown';
  entities: {
    origin?: string;
    destination?: string;
    transport_type?: 'bus' | 'train' | 'any';
    date?: string;
    time?: string;
  };
  confidence: number;
}

export class TransportChatbotService {
  private conversationService: ConversationService;
  private transportService: TransportService;
  private weatherService: WeatherService;
  private llmService: LLMService;

  constructor() {
    this.conversationService = new ConversationService();
    this.transportService = new TransportService();
    this.weatherService = new WeatherService();
    this.llmService = new LLMService();
  }

  /**
   * Process user query
   */
  async processQuery(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();

    try {
      // Get or create conversation
      const conversation = request.conversation_id
        ? await this.conversationService.getConversation(request.conversation_id)
        : null;

      const activeConversation = conversation
        ? conversation.conversation
        : await this.conversationService.getOrCreateActiveConversation(request.user_id);

      // Save user message
      await this.conversationService.addMessage({
        conversation_id: String(activeConversation._id),
        user_id: request.user_id,
        role: 'user',
        content: request.message,
      });

      // Get conversation history for context
      const recentMessages = await this.conversationService.getRecentMessages(
        String(activeConversation._id),
        5
      );

      // Extract intent and entities using LLM
      const intent = await this.extractIntent(request.message, recentMessages);

      logger.info('Intent extraction result:', {
        message: request.message,
        intent: intent.intent,
        entities: intent.entities,
        confidence: intent.confidence,
      });

      // Process based on intent
      let response: ChatResponse;
      switch (intent.intent) {
        case 'route_query':
          response = await this.handleRouteQuery(activeConversation, request, intent);
          break;
        case 'weather_query':
          response = await this.handleWeatherQuery(activeConversation, request, intent);
          break;
        case 'location_info':
          response = await this.handleLocationInfo(activeConversation, request, intent);
          break;
        case 'greeting':
          response = await this.handleGreeting(activeConversation, request);
          break;
        default:
          response = await this.handleGeneralQuestion(activeConversation, request, recentMessages);
      }

      // Update processing time
      response.metadata = {
        ...response.metadata,
        processing_time_ms: Date.now() - startTime,
        intent: intent.intent,
      };

      // Save assistant message
      await this.conversationService.addMessage({
        conversation_id: String(activeConversation._id),
        user_id: request.user_id,
        role: 'assistant',
        content: response.message,
        message_type: response.message_type,
        metadata: response.metadata,
      });

      return response;
    } catch (error) {
      logger.error('Error processing chat query:', error);
      throw error;
    }
  }

  /**
   * Extract intent and entities from user message
   */
  private async extractIntent(message: string, context: IMessage[]): Promise<ExtractedIntent> {
    try {
      // Build context with previous entities from metadata
      const contextText = context
        .slice(-5)
        .map((m) => {
          let text = `${m.role}: ${m.content}`;
          if (m.metadata?.locations_identified && m.metadata.locations_identified.length > 0) {
            const locationNames = m.metadata.locations_identified.map((loc) => loc.name).join(', ');
            text += ` [Locations: ${locationNames}]`;
          }
          return text;
        })
        .join('\n');

      const enhancedPrompt = `You are analyzing a conversation about Sri Lankan transport.

CONVERSATION HISTORY:
${contextText}

CURRENT USER MESSAGE: ${message}

TASK: Extract intent and entities from the ENTIRE conversation, not just the current message.
- If origin or destination was mentioned earlier in the conversation, include it even if not in the current message
- Intent types: route_query, weather_query, location_info, general_question, greeting, unknown

IMPORTANT CONTEXT RULES:
1. If the user previously said where they want to go, and now just mentions where they're from, combine them
2. If the user previously said where they're from, and now just mentions where they want to go, combine them
3. Look for patterns like "I'm in [city]", "from [city]", "to [city]", "I want to go to [city]"

Return JSON with: intent, origin, destination, transport_type`;

      const result = await this.llmService.extractFieldsFromQuery(enhancedPrompt, [
        'origin',
        'destination',
        'transport_type',
        'intent',
      ]);

      return {
        intent: (result.extracted.intent as ExtractedIntent['intent']) || 'unknown',
        entities: {
          origin: result.extracted.origin,
          destination: result.extracted.destination,
          transport_type: result.extracted.transport_type as 'bus' | 'train' | 'any',
        },
        confidence: 0.8,
      };
    } catch (error) {
      logger.warn('LLM intent extraction failed, using pattern matching fallback');
      // Fallback to pattern matching when LLM is not available
      return this.extractIntentFallback(message, context);
    }
  }

  /**
   * Fallback intent extraction using pattern matching
   */
  private extractIntentFallback(message: string, context: IMessage[]): ExtractedIntent {
    const lowerMessage = message.toLowerCase();

    // Check for greetings
    if (/^(hi|hello|hey|greetings|good morning|good afternoon|good evening)/i.test(lowerMessage)) {
      return { intent: 'greeting', entities: {}, confidence: 0.9 };
    }

    // Check for weather queries
    if (/weather|temperature|rain|sunny|forecast|climate/i.test(lowerMessage)) {
      const locationMatch =
        lowerMessage.match(/in\s+([a-z\s]+?)(?:\?|$|,)/i) ||
        lowerMessage.match(/at\s+([a-z\s]+?)(?:\?|$|,)/i) ||
        lowerMessage.match(/weather\s+([a-z\s]+?)(?:\?|$|,)/i);

      return {
        intent: 'weather_query',
        entities: {
          destination: locationMatch ? locationMatch[1].trim() : undefined,
        },
        confidence: 0.8,
      };
    }

    // Check for route/transport queries
    const routePatterns = [
      /(?:go|travel|get|route|transport|bus|train)\s+(?:from|to)/i,
      /(?:from|to)\s+[a-z]/i,
      /how\s+(?:do\s+i|can\s+i|to)\s+(?:go|get|reach|travel)/i,
      /(?:i'?m?\s+in|starting\s+from|coming\s+from)/i,
    ];

    if (routePatterns.some((pattern) => pattern.test(lowerMessage))) {
      // Extract origin and destination from current message
      const fromMatch = lowerMessage.match(/from\s+([a-z\s]+?)(?:\s+to|\?|$|,)/i);
      const toMatch = lowerMessage.match(/to\s+([a-z\s]+?)(?:\?|$|,|\s+from)/i);
      const inMatch = lowerMessage.match(/(?:i'?m?\s+in|at)\s+([a-z\s]+?)(?:\?|$|,)/i);
      const startingMatch = lowerMessage.match(
        /(?:starting|coming)\s+from\s+([a-z\s]+?)(?:\?|$|,)/i
      );

      let origin = fromMatch
        ? fromMatch[1].trim()
        : startingMatch
          ? startingMatch[1].trim()
          : inMatch
            ? inMatch[1].trim()
            : undefined;
      let destination = toMatch ? toMatch[1].trim() : undefined;

      // Extract from conversation context if missing
      const previousLocations = this.extractLocationsFromContext(context);

      // If we only have destination, check if origin was mentioned before
      if (!origin && destination && previousLocations.origin) {
        origin = previousLocations.origin;
      }

      // If we only have origin, check if destination was mentioned before
      if (origin && !destination && previousLocations.destination) {
        destination = previousLocations.destination;
      }

      return {
        intent: 'route_query',
        entities: {
          origin,
          destination,
        },
        confidence: origin && destination ? 0.85 : 0.6,
      };
    }

    // Check for location info queries
    if (
      /(?:tell|about|info|information|describe|what\s+is)\s+.*?(?:city|town|place|location)/i.test(
        lowerMessage
      ) ||
      /(?:tell me about|what about|info on)\s+([a-z\s]+)/i.test(lowerMessage)
    ) {
      const locationMatch = lowerMessage.match(/(?:about|on)\s+([a-z\s]+?)(?:\?|$|,)/i);
      return {
        intent: 'location_info',
        entities: {
          destination: locationMatch ? locationMatch[1].trim() : undefined,
        },
        confidence: 0.7,
      };
    }

    // Default: treat as potential route query if it mentions any location words
    return {
      intent: 'unknown',
      entities: {},
      confidence: 0.3,
    };
  }

  /**
   * Extract previously mentioned locations from conversation context
   */
  private extractLocationsFromContext(context: IMessage[]): {
    origin?: string;
    destination?: string;
  } {
    let origin: string | undefined;
    let destination: string | undefined;

    // Check metadata first (most reliable)
    for (let i = context.length - 1; i >= 0; i--) {
      const msg = context[i];
      if (msg.metadata?.locations_identified && msg.metadata.locations_identified.length > 0) {
        const locations = msg.metadata.locations_identified.map((loc) => loc.name);
        if (locations.length >= 2) {
          origin = origin || locations[0];
          destination = destination || locations[1];
        } else if (locations.length === 1) {
          // Check message content to determine if it's origin or destination
          const content = msg.content.toLowerCase();
          if (/(?:from|in|at|starting)/i.test(content)) {
            origin = origin || locations[0];
          } else if (/(?:to|want to go)/i.test(content)) {
            destination = destination || locations[0];
          }
        }
      }
    }

    // Fallback: parse from text
    if (!origin || !destination) {
      for (let i = context.length - 1; i >= 0; i--) {
        const msg = context[i];
        if (msg.role === 'user') {
          const content = msg.content.toLowerCase();

          if (!origin) {
            const fromMatch =
              content.match(/from\s+([a-z\s]+?)(?:\s+to|\?|$|,)/i) ||
              content.match(/(?:i'?m?\s+in|at)\s+([a-z\s]+?)(?:\?|$|,)/i) ||
              content.match(/(?:starting|coming)\s+from\s+([a-z\s]+?)(?:\?|$|,)/i);
            if (fromMatch) origin = fromMatch[1].trim();
          }

          if (!destination) {
            const toMatch = content.match(/to\s+([a-z\s]+?)(?:\?|$|,|\s+from)/i);
            if (toMatch) destination = toMatch[1].trim();
          }

          if (origin && destination) break;
        }
      }
    }

    return { origin, destination };
  }

  /**
   * Handle route query
   */
  private async handleRouteQuery(
    conversation: any,
    _request: ChatRequest,
    intent: ExtractedIntent
  ): Promise<ChatResponse> {
    try {
      const { origin, destination, transport_type } = intent.entities;

      // Only destination provided - ask for origin
      if (!origin && destination) {
        return {
          conversation_id: String(conversation._id),
          message: `Great! You want to go to ${destination}. Where are you starting from? 🚏\n\nFor example, "I'm in Colombo" or "from Kandy"`,
          message_type: 'text',
          suggestions: ['I am in Colombo', 'From Kandy', 'Starting from Galle'],
          metadata: {
            processing_time_ms: 0,
            intent: 'route_query_partial',
            locations_identified: [{ name: destination, confidence: 0.8 }],
          },
        };
      }

      // Only origin provided - ask for destination
      if (origin && !destination) {
        return {
          conversation_id: String(conversation._id),
          message: `Got it! You're in ${origin}. Where would you like to go? 🎯\n\nFor example, "to Kandy" or "I want to go to Galle"`,
          message_type: 'text',
          suggestions: ['To Kandy', 'I want to go to Galle', 'Heading to Nuwara Eliya'],
          metadata: {
            processing_time_ms: 0,
            intent: 'route_query_partial',
            locations_identified: [{ name: origin, confidence: 0.8 }],
          },
        };
      }

      // Neither origin nor destination
      if (!origin && !destination) {
        return {
          conversation_id: String(conversation._id),
          message:
            "I'd be happy to help you find transport! 🚌🚂\n\nCould you tell me:\n• Where are you starting from?\n• Where do you want to go?\n\nFor example: 'I want to go from Colombo to Kandy'",
          message_type: 'text',
          suggestions: [
            'I want to go from Colombo to Kandy',
            'How do I get to Galle from Negombo?',
            'Transport from Nugegoda to Embilipitiya',
          ],
        };
      }

      // Get transport recommendations
      const recommendation = await this.transportService.getTransportRecommendation(
        { cityName: origin },
        { cityName: destination },
        { transport_type: transport_type || 'any' }
      );

      if (!recommendation) {
        return {
          conversation_id: String(conversation._id),
          message: `I couldn't find the locations "${origin}" or "${destination}". Could you please check the spelling or try nearby cities?`,
          message_type: 'text',
        };
      }

      // Get weather info for destination
      let weatherInfo;
      try {
        const destCoords = recommendation.destination.city.location.coordinates;
        weatherInfo = await this.weatherService.getWeatherSummary(destCoords[1], destCoords[0]);
      } catch (error) {
        logger.warn('Could not fetch weather:', error);
      }

      // Generate response
      const responseMessage = this.formatRouteResponse(recommendation, weatherInfo);

      // Update conversation context
      await this.conversationService.updateContext(String(conversation._id), {
        current_location: {
          city_id: recommendation.origin.city.city_id,
          city_name: recommendation.origin.city.name.en,
          coordinates: [
            recommendation.origin.city.location.coordinates[0],
            recommendation.origin.city.location.coordinates[1],
          ],
        },
        destination: {
          city_id: recommendation.destination.city.city_id,
          city_name: recommendation.destination.city.name.en,
          coordinates: [
            recommendation.destination.city.location.coordinates[0],
            recommendation.destination.city.location.coordinates[1],
          ],
        },
      });

      return {
        conversation_id: String(conversation._id),
        message: responseMessage,
        message_type: 'route_suggestion',
        metadata: {
          transport_recommendations: recommendation,
          weather_info: weatherInfo,
          locations_identified: [
            origin && { name: origin, confidence: 0.9 },
            destination && { name: destination, confidence: 0.9 },
          ].filter((loc): loc is { name: string; confidence: number } => !!loc),
          processing_time_ms: 0,
        },
        suggestions: [
          'Tell me more about bus routes',
          'What about train options?',
          "What's the weather like?",
          'Show me alternative routes',
        ],
      };
    } catch (error) {
      logger.error('Error handling route query:', error);
      return {
        conversation_id: String(conversation._id),
        message:
          'I encountered an error while finding routes. Please try again or rephrase your question.',
        message_type: 'error',
      };
    }
  }

  /**
   * Format route response for user
   */
  private formatRouteResponse(recommendation: any, weatherInfo?: string): string {
    let response = `🚌 **Transport Options from ${recommendation.origin.city.name.en} to ${recommendation.destination.city.name.en}**\n\n`;

    response += `📍 Recommended: **${recommendation.recommended_mode.toUpperCase()}**\n\n`;

    // Add step-by-step instructions
    response += '**Step-by-Step Guide:**\n';
    recommendation.step_by_step_instructions.forEach((step: string, index: number) => {
      response += `${index === 0 ? '📌' : '➡️'} ${step}\n`;
    });

    // Add routes information
    if (recommendation.routes && recommendation.routes.length > 0) {
      response += '\n**Available Routes:**\n';
      recommendation.routes.slice(0, 3).forEach((route: any, index: number) => {
        response += `\n${index + 1}. **${route.transport_type.toUpperCase()}**\n`;
        response += `   ⏱ Duration: ~${route.estimated_time_min} minutes\n`;
        response += `   📏 Distance: ${route.distance_km.toFixed(1)} km\n`;
        if (route.fare_lkr) {
          response += `   💰 Fare: LKR ${route.fare_lkr}\n`;
        }
        if (route.has_transfer) {
          response += `   🔄 Requires transfer\n`;
        }
      });
    }

    // Add weather info
    if (weatherInfo) {
      response += `\n\n🌤 **Weather:** ${weatherInfo}\n`;
    }

    // Add ML insights if available
    if (recommendation.ml_recommendation) {
      response += `\n💡 **AI Recommendation:** ${recommendation.ml_recommendation.predicted_mode} (${(recommendation.ml_recommendation.confidence * 100).toFixed(0)}% confidence)\n`;
    }

    return response;
  }

  /**
   * Handle weather query
   */
  private async handleWeatherQuery(
    conversation: any,
    _request: ChatRequest,
    intent: ExtractedIntent
  ): Promise<ChatResponse> {
    const location = intent.entities.destination || intent.entities.origin;

    if (!location) {
      return {
        conversation_id: String(conversation._id),
        message: 'Which location would you like weather information for?',
        message_type: 'text',
      };
    }

    const city = await this.transportService.findCity({ cityName: location });
    if (!city) {
      return {
        conversation_id: String(conversation._id),
        message: `I couldn't find the location "${location}". Please try another city.`,
        message_type: 'text',
      };
    }

    const weather = await this.weatherService.getCurrentWeather(
      city.location.coordinates[1],
      city.location.coordinates[0]
    );

    if (!weather) {
      return {
        conversation_id: String(conversation._id),
        message: 'Weather information is currently unavailable.',
        message_type: 'error',
      };
    }

    const message =
      `🌤 **Weather in ${city.name.en}:**\n\n` +
      `Temperature: ${Math.round(weather.temperature)}°C (feels like ${Math.round(weather.feels_like)}°C)\n` +
      `Conditions: ${weather.description}\n` +
      `Humidity: ${weather.humidity}%\n` +
      `Wind Speed: ${weather.wind_speed} m/s`;

    return {
      conversation_id: String(conversation._id),
      message,
      message_type: 'weather_info',
      metadata: {
        weather_info: weather,
        processing_time_ms: 0,
      },
    };
  }

  /**
   * Handle location info query
   */
  private async handleLocationInfo(
    conversation: any,
    _request: ChatRequest,
    intent: ExtractedIntent
  ): Promise<ChatResponse> {
    const location = intent.entities.destination || intent.entities.origin;

    if (!location) {
      return {
        conversation_id: String(conversation._id),
        message: 'Which location would you like information about?',
        message_type: 'text',
      };
    }

    const city = await this.transportService.findCity({ cityName: location });
    if (!city) {
      return {
        conversation_id: String(conversation._id),
        message: `I couldn't find information about "${location}".`,
        message_type: 'text',
      };
    }

    let message = `📍 **${city.name.en}**\n\n`;
    message += `**Transport Access:**\n`;
    message += `🚂 Railway: ${city.transport_access.has_railway ? 'Available' : 'Not available'} (${city.transport_stats.railway_stations_count} stations)\n`;
    message += `🚌 Bus: ${city.transport_access.has_bus ? 'Available' : 'Not available'} (${city.transport_stats.bus_stations_count} stations)\n`;

    return {
      conversation_id: String(conversation._id),
      message,
      message_type: 'location_info',
    };
  }

  /**
   * Handle greeting
   */
  private async handleGreeting(conversation: any, _request: ChatRequest): Promise<ChatResponse> {
    const greetings = [
      "Hello! 👋 I'm your Sri Lankan transport assistant. I can help you find the best bus or train routes across Sri Lanka. Where would you like to go today?",
      'Hi there! 🚌 Welcome to Sri Lanka Transport Helper. I can help you plan your journey. Just tell me where you want to go!',
      "Greetings! 🌏 I'm here to help you navigate Sri Lanka's transport system. Where's your destination?",
    ];

    const message = greetings[Math.floor(Math.random() * greetings.length)];

    return {
      conversation_id: String(conversation._id),
      message,
      message_type: 'text',
      suggestions: [
        'I want to go from Colombo to Kandy',
        'Show me transport from Galle to Jaffna',
        "What's the weather in Nuwara Eliya?",
      ],
    };
  }

  /**
   * Handle general question using LLM
   */
  private async handleGeneralQuestion(
    conversation: any,
    request: ChatRequest,
    context: IMessage[]
  ): Promise<ChatResponse> {
    try {
      const systemPrompt = `You are a helpful Sri Lankan transport assistant specializing in buses and trains. 
You help tourists and locals navigate Sri Lanka's public transport system.
Be friendly, concise, and culturally aware. If you don't know something, admit it and suggest alternatives.`;

      const conversationHistory = context
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n');

      const response = await this.llmService.generateCompletion(
        `${systemPrompt}\n\nConversation history:\n${conversationHistory}\n\nUser: ${request.message}\n\nAssistant:`
      );

      return {
        conversation_id: String(conversation._id),
        message: response,
        message_type: 'text',
      };
    } catch (error) {
      logger.warn('LLM general question handling failed, using smart fallback');
      // Smart fallback responses when LLM is not available
      const lowerMessage = request.message.toLowerCase();

      // Check if message might be a location/route related
      const cityNames = [
        'colombo',
        'kandy',
        'galle',
        'jaffna',
        'negombo',
        'embilipitiya',
        'nugegoda',
        'nuwara eliya',
        'matara',
        'anuradhapura',
        'trincomalee',
        'batticaloa',
      ];

      const mentionedCity = cityNames.find((city) => lowerMessage.includes(city));

      if (mentionedCity) {
        return {
          conversation_id: String(conversation._id),
          message: `I see you mentioned ${mentionedCity}! 🌍\n\nI can help you with:\n• Getting TO ${mentionedCity} - just tell me where you're starting from\n• Traveling FROM ${mentionedCity} - let me know your destination\n• Weather conditions in ${mentionedCity}\n• Information about the city\n\nWhat would you like to know?`,
          message_type: 'text',
          suggestions: [
            `How do I get to ${mentionedCity}?`,
            `What's the weather in ${mentionedCity}?`,
            `Tell me about ${mentionedCity}`,
          ],
        };
      }

      // Generic helpful response
      return {
        conversation_id: String(conversation._id),
        message: `I'm your Sri Lankan transport assistant! 🇱🇰 I can help you with:\n\n🚌 **Transport Routes** - Bus and train connections\n🌤️ **Weather Info** - Check conditions before you travel\n🗺️ **City Information** - Learn about destinations\n\nJust ask me something like:\n• "How do I get from Colombo to Kandy?"\n• "What's the weather in Galle?"\n• "Tell me about Nuwara Eliya"\n\nWhat would you like to know?`,
        message_type: 'text',
        suggestions: [
          'I want to go from Colombo to Kandy',
          "What's the weather in Nuwara Eliya?",
          'Tell me about Galle',
        ],
      };
    }
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ conversations: any[]; total: number }> {
    return this.conversationService.getUserConversations(userId, page, limit);
  }

  /**
   * Get specific conversation with messages
   */
  async getConversationWithMessages(
    conversationId: string
  ): Promise<{ conversation: any; messages: any[] } | null> {
    return this.conversationService.getConversation(conversationId);
  }
}
