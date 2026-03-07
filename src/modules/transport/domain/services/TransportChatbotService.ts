import { ConversationService } from './ConversationService';
import { TransportService } from './TransportService';
import { WeatherService } from './WeatherService';
import { LLMService } from './LLMService';
import { GoogleMapsService } from './GoogleMapsService';
import { RouteContextBuilder, StaticRouteData, RouteContext } from './RouteContextBuilder';
import { RankingService, RankedRoute } from './RankingService';
import { IncidentService, IncidentResponse } from './IncidentService';
import { MockTimetableService } from './MockTimetableService';
import { logger } from '../../../../shared/config/logger';
import { IMessage } from '../models/Message';
import { IConversation } from '../models/Conversation';
import { ICity } from '../models/City';

// Extended StaticRouteData with additional fields used in route creation
interface ExtendedStaticRouteData extends StaticRouteData {
  origin_city_id?: number | string;
  destination_city_id?: number | string;
  distance_km?: number;
  has_transfer?: boolean;
}

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
    road_incidents?: {
      active_incidents: IncidentResponse[];
      incident_count: number;
      critical_incidents: number;
      high_incidents: number;
    };
    station_data?: {
      origin: {
        requested_name: string;
        matched_city_id?: number;
        matched_city_name?: string;
        matched_city_slug?: string;
        matched_by?: 'direct' | 'nearest';
        has_railway_access?: boolean;
        has_bus_access?: boolean;
        nearest_railway_station?: {
          station_id?: string;
          station_name?: string;
          distance_km?: number;
          latitude?: number;
          longitude?: number;
          location?: string;
        };
        nearest_bus_station?: {
          station_id?: string;
          station_name?: string;
          distance_km?: number;
          latitude?: number;
          longitude?: number;
          operator?: string;
        };
        distance_to_nearest_railway_km?: number;
        distance_to_nearest_bus_km?: number;
      };
      destination: {
        requested_name: string;
        matched_city_id?: number;
        matched_city_name?: string;
        matched_city_slug?: string;
        matched_by?: 'direct' | 'nearest';
        has_railway_access?: boolean;
        has_bus_access?: boolean;
        nearest_railway_station?: {
          station_id?: string;
          station_name?: string;
          distance_km?: number;
          latitude?: number;
          longitude?: number;
          location?: string;
        };
        nearest_bus_station?: {
          station_id?: string;
          station_name?: string;
          distance_km?: number;
          latitude?: number;
          longitude?: number;
          operator?: string;
        };
        distance_to_nearest_railway_km?: number;
        distance_to_nearest_bus_km?: number;
      };
    };
    map_data?: {
      origin: { lat: number; lng: number };
      destination: { lat: number; lng: number };
      routes: Array<{
        route_id: string;
        transport_type: string;
        polyline?: string;
        navigation_steps?: Array<{
          instruction: string;
          maneuver?: string;
          duration: number;
          distance: number;
          travel_mode: string;
          start_location?: { lat: number; lng: number };
          end_location?: { lat: number; lng: number };
        }>;
        color: string;
      }>;
    };
    processing_time_ms: number;
  };
  suggestions?: string[];
}

export interface ExtractedIntent {
  intent:
    | 'route_query'
    | 'time_query'
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
  private googleMapsService: GoogleMapsService;
  private routeContextBuilder: RouteContextBuilder;
  private rankingService: RankingService;
  private incidentService: IncidentService;
  private mockTimetableService: MockTimetableService;

  constructor() {
    this.conversationService = new ConversationService();
    this.transportService = new TransportService();
    this.weatherService = new WeatherService();
    this.llmService = new LLMService();
    this.googleMapsService = new GoogleMapsService();
    this.routeContextBuilder = new RouteContextBuilder();
    this.rankingService = new RankingService();
    this.incidentService = new IncidentService();
    this.mockTimetableService = new MockTimetableService();
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

      const isRouteIntent = intent.intent === 'route_query';
      let hadPendingRouteContext = false;

      if (isRouteIntent) {
        // Check and merge with pending route query context only for route intents
        let originRestoredFromContext = false;
        let destinationRestoredFromContext = false;
        const pendingQuery = this.conversationService.getPendingRouteQuery(activeConversation);

        if (pendingQuery) {
          hadPendingRouteContext = true;
          logger.info('Found pending route query context:', pendingQuery);

          if (!intent.entities.origin && pendingQuery.origin) {
            intent.entities.origin = pendingQuery.origin.name;
            originRestoredFromContext = true;
            logger.info('Restored origin from context:', pendingQuery.origin.name);
          }

          if (!intent.entities.destination && pendingQuery.destination) {
            intent.entities.destination = pendingQuery.destination.name;
            destinationRestoredFromContext = true;
            logger.info('Restored destination from context:', pendingQuery.destination.name);
          }
        }

        // Save NEW route entities for follow-up route turns only
        const hasNewOrigin = Boolean(intent.entities.origin && !originRestoredFromContext);
        const hasNewDestination = Boolean(
          intent.entities.destination && !destinationRestoredFromContext
        );

        if (hasNewOrigin || hasNewDestination) {
          await this.saveToPendingContext(
            activeConversation,
            hasNewOrigin ? intent.entities.origin : undefined,
            hasNewDestination ? intent.entities.destination : undefined
          );
        }
      }

      // Process based on intent
      let response: ChatResponse;
      switch (intent.intent) {
        case 'route_query':
          response = await this.handleRouteQuery(activeConversation, request, intent);
          break;
        case 'time_query':
          response = await this.handleTimeQuery(activeConversation, request, intent);
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

      // Clear pending context after a successful full route answer
      if (isRouteIntent && response.message_type === 'route_suggestion') {
        logger.info('Route suggestion completed - clearing pending route context');
        await this.conversationService.clearPendingRouteQuery(String(activeConversation._id));
      }

      // Clear stale route context when user asks a non-route question
      if (!isRouteIntent && hadPendingRouteContext) {
        logger.info('Non-route intent with stale route context - clearing pending route context');
        await this.conversationService.clearPendingRouteQuery(String(activeConversation._id));
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
   * Save location mentions to pending context for cross-message queries
   */
  private async saveToPendingContext(
    conversation: IConversation,
    origin?: string,
    destination?: string
  ): Promise<void> {
    try {
      let savedOrigin: any = undefined;
      let savedDestination: any = undefined;

      // Resolve origin if provided
      if (origin) {
        const originCity = await this.transportService.findCity({ cityName: origin });
        if (originCity) {
          savedOrigin = {
            name: origin,
            city_id: originCity.city_id,
            coordinates: {
              lat: originCity.location.coordinates[1],
              lng: originCity.location.coordinates[0],
            },
          };
          logger.info('Saving origin to pending context:', { origin });
        }
      }

      // Resolve destination if provided
      if (destination) {
        const destCity = await this.transportService.findCity({ cityName: destination });
        if (destCity) {
          savedDestination = {
            name: destination,
            city_id: destCity.city_id,
            coordinates: {
              lat: destCity.location.coordinates[1],
              lng: destCity.location.coordinates[0],
            },
          };
          logger.info('Saving destination to pending context:', { destination });
        }
      }

      // Update pending context if we have anything to save
      if (savedOrigin || savedDestination) {
        await this.conversationService.updatePendingRouteQuery(
          String(conversation._id),
          savedOrigin,
          savedDestination
        );
      }
    } catch (error) {
      logger.warn('Error saving to pending context:', error);
      // Non-critical error, continue processing
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
- Intent types: route_query, time_query, weather_query, location_info, general_question, greeting, unknown

INTENT DEFINITIONS:
- route_query: User wants to find routes/transport options (e.g., "How to go from A to B", "Show me routes")
- time_query: User asks about departure times, schedules, or timetables (e.g., "What time is the next bus", "When does the train leave", "Departure times")
- weather_query: User asks about weather conditions
- greeting: User says hi/hello
- general_question: Questions about prices, speed, comfort, etc.

IMPORTANT EXTRACTION RULES:
1. Extract ONLY the city/location names, NOT the full phrase
2. For "I'm in Colombo and I want to go to Kandy" → origin: "Colombo", destination: "Kandy"
3. For "from Galle to Matara" → origin: "Galle", destination: "Matara"
4. Remove any surrounding words like "and", "I want to", "go to", etc.
5. If the user previously said where they want to go, and now just mentions where they're from, combine them
6. If the user previously said where they're from, and now just mentions where they want to go, combine them
7. For time queries, check if origin/destination was mentioned in previous messages and include them

EXAMPLES:
- "I'm in Colombo and i want to go to embilipitiya" → intent: "route_query", origin: "Colombo", destination: "embilipitiya"
- "How to get from Kandy to Nuwara Eliya?" → intent: "route_query", origin: "Kandy", destination: "Nuwara Eliya"
- "What is the next bus departure time" → intent: "time_query", origin: from_context, destination: from_context
- "When does the train leave" → intent: "time_query"
- "Show me the timetable" → intent: "time_query"
- "What time is the next bus" → intent: "time_query"
- "I'm at Negombo" + (previous: "going to Galle") → intent: "route_query", origin: "Negombo", destination: "Galle"

Return JSON with: intent, origin, destination, transport_type`;

      const result = await this.llmService.extractFieldsFromQuery(enhancedPrompt, [
        'origin',
        'destination',
        'transport_type',
        'intent',
      ]);

      logger.info(
        `LLM extracted intent: ${result.extracted.intent}, origin: "${result.extracted.origin}", destination: "${result.extracted.destination}"`
      );

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

    // Check for time-related queries (next bus/train time) - MUST CHECK BEFORE route_query
    const timeQueryPatterns = [
      /\b(?:next|when|what\s+time|what\s+is\s+the\s+next)\b.*\b(?:bus|train|departure)\b/i,
      /\b(?:bus|train)\b.*\b(?:time|departure|schedule|timetable)\b/i,
      /\bdeparture\s+time/i,
      /\bschedule|timetable|timings?\b/i,
      /when\s+(?:does|do|is|are)\s+(?:the\s+)?(?:next\s+)?(?:bus|train)/i,
    ];

    if (timeQueryPatterns.some((pattern) => pattern.test(lowerMessage))) {
      // Extract transport type
      const transportType = /train/i.test(lowerMessage)
        ? 'train'
        : /bus/i.test(lowerMessage)
          ? 'bus'
          : undefined;

      // Extract origin/destination if present
      const fromMatch = lowerMessage.match(/from\s+([a-z\s]+?)(?:\s+(?:to|and|but)|\?|$|,)/i);
      const toMatch = lowerMessage.match(
        /(?:to|going\s+to)\s+([a-z\s]+?)(?:\?|$|,|\s+from|\s+and|\s+but)/i
      );

      return {
        intent: 'time_query',
        entities: {
          transport_type: transportType,
          origin: fromMatch ? fromMatch[1].trim() : undefined,
          destination: toMatch ? toMatch[1].trim() : undefined,
        },
        confidence: 0.85,
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
      // Updated patterns to stop at common conjunctions and prepositions
      const fromMatch = lowerMessage.match(/from\s+([a-z\s]+?)(?:\s+(?:to|and|but)|\?|$|,)/i);
      const toMatch = lowerMessage.match(
        /(?:to|going\s+to|want\s+to\s+go\s+to)\s+([a-z\s]+?)(?:\?|$|,|\s+from|\s+and|\s+but)/i
      );
      const inMatch = lowerMessage.match(
        /(?:i'?m?\s+in|i'?m?\s+at)\s+([a-z\s]+?)(?:\s+(?:and|but|to)|\?|$|,)/i
      );
      const startingMatch = lowerMessage.match(
        /(?:starting|coming)\s+from\s+([a-z\s]+?)(?:\s+(?:to|and|but)|\?|$|,)/i
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
   * Handle route query with intelligent ranking and explanation
   */
  private async handleRouteQuery(
    conversation: IConversation,
    request: ChatRequest,
    intent: ExtractedIntent
  ): Promise<ChatResponse> {
    try {
      const { origin, destination } = intent.entities;

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

      // Validate and find locations
      const originCity = await this.transportService.findCity({ cityName: origin });
      const destCity = await this.transportService.findCity({ cityName: destination });

      // If cities not found in DB, try geocoding with Google Maps
      let originCoords: { lat: number; lng: number } | null = null;
      let destCoords: { lat: number; lng: number } | null = null;

      if (originCity) {
        originCoords = {
          lat: originCity.location.coordinates[1],
          lng: originCity.location.coordinates[0],
        };
      } else {
        // Try Google Maps geocoding
        logger.info(`City "${origin}" not found in DB, trying Google Maps geocoding`);
        originCoords = await this.googleMapsService.geocode(`${origin}, Sri Lanka`);
        if (!originCoords) {
          return {
            conversation_id: String(conversation._id),
            message: `I couldn't find the location "${origin}". Could you please check the spelling or try a nearby city?`,
            message_type: 'text',
          };
        }
        logger.info(`Geocoded "${origin}": ${JSON.stringify(originCoords)}`);
      }

      if (destCity) {
        destCoords = {
          lat: destCity.location.coordinates[1],
          lng: destCity.location.coordinates[0],
        };
      } else {
        // Try Google Maps geocoding
        logger.info(`City "${destination}" not found in DB, trying Google Maps geocoding`);
        destCoords = await this.googleMapsService.geocode(`${destination}, Sri Lanka`);
        if (!destCoords) {
          return {
            conversation_id: String(conversation._id),
            message: `I couldn't find the location "${destination}". Could you please check the spelling or try a nearby city?`,
            message_type: 'text',
          };
        }
        logger.info(`Geocoded "${destination}": ${JSON.stringify(destCoords)}`);
      }

      // Fetch routes directly from Google Maps API for multiple transport modes
      logger.info(`Fetching routes from Google Maps: "${origin}" → "${destination}"`);
      logger.info(
        `Origin coords: ${JSON.stringify(originCoords)}, Dest coords: ${JSON.stringify(destCoords)}`
      );

      // Sanity check: make sure origin and dest are not the same
      const areSameCoords =
        Math.abs(originCoords.lat - destCoords.lat) < 0.001 &&
        Math.abs(originCoords.lng - destCoords.lng) < 0.001;
      if (areSameCoords) {
        logger.error(
          `Origin and destination have same coordinates! Origin: ${JSON.stringify(originCoords)}, Dest: ${JSON.stringify(destCoords)}`
        );
        return {
          conversation_id: String(conversation._id),
          message: `It seems both locations are the same or very close to each other. Please check:\n• Origin: ${origin}\n• Destination: ${destination}`,
          message_type: 'error',
        };
      }

      try {
        // If cities not found in DB, find nearest cities by coordinates for train lookup
        let originCityForTrains = originCity;
        let destCityForTrains = destCity;

        if (!originCityForTrains && originCoords) {
          logger.info(`Origin not in DB, finding nearest city for train lookup`);
          originCityForTrains = await this.transportService.findCity({
            coordinates: originCoords,
          });
          if (originCityForTrains) {
            logger.info(
              `Found nearest city for origin: ${originCityForTrains.name} (${originCityForTrains.city_id})`
            );
          }
        }

        if (!destCityForTrains && destCoords) {
          logger.info(`Destination not in DB, finding nearest city for train lookup`);
          destCityForTrains = await this.transportService.findCity({
            coordinates: destCoords,
          });
          if (destCityForTrains) {
            logger.info(
              `Found nearest city for destination: ${destCityForTrains.name} (${destCityForTrains.city_id})`
            );
          }
        }

        // Fetch routes only from Google Maps
        const [transitRoutes, drivingRoutes] = await Promise.all([
          // Google Maps routes (for real-time directions)
          this.googleMapsService
            .getDirections(originCoords, destCoords, 'transit', true)
            .catch((err) => {
              logger.warn(`Transit route fetch failed: ${err.message}`);
              return [];
            }),
          this.googleMapsService
            .getDirections(originCoords, destCoords, 'driving', true)
            .catch((err) => {
              logger.warn(`Driving route fetch failed: ${err.message}`);
              return [];
            }),
        ]);

        logger.info(
          `Fetched ${transitRoutes.length} transit routes, ${drivingRoutes.length} driving routes from Google Maps`
        );

        // Log first route details for debugging
        if (transitRoutes.length > 0) {
          logger.info(
            `First transit route: distance=${transitRoutes[0].distance}m, duration=${transitRoutes[0].duration}s, steps=${transitRoutes[0].steps?.length}`
          );
        }
        if (drivingRoutes.length > 0) {
          logger.info(
            `First driving route: distance=${drivingRoutes[0].distance}m, duration=${drivingRoutes[0].duration}s, steps=${drivingRoutes[0].steps?.length}`
          );
        }

        // Create synthetic route objects from Google Maps responses
        const allRoutes: ExtendedStaticRouteData[] = [];
        const accessOriginCity = originCity || originCityForTrains;
        const accessDestCity = destCity || destCityForTrains;
        const hasBusOnBothEnds = Boolean(
          accessOriginCity?.transport_access?.has_bus && accessDestCity?.transport_access?.has_bus
        );
        const hasRailOnBothEnds =
          this.hasReliableRailwayAccess(accessOriginCity) &&
          this.hasReliableRailwayAccess(accessDestCity);

        // Add Google transit-derived bus/train only when both cities support that mode
        if (transitRoutes.length > 0) {
          const sortedTransit = [...transitRoutes].sort((a, b) => a.duration - b.duration);
          const bestTransit = sortedTransit[0];
          const transitDistanceKm = bestTransit.distance / 1000;
          const transitDurationMin = Math.round(bestTransit.duration / 60);

          if (hasBusOnBothEnds) {
            allRoutes.push({
              route_id: 'GMAPS_TRANSIT_BUS',
              origin_city_id: accessOriginCity?.city_id || 'geocoded',
              destination_city_id: accessDestCity?.city_id || 'geocoded',
              transport_type: 'bus',
              distance_km: transitDistanceKm,
              estimated_duration_min: transitDurationMin,
              base_fare_lkr: Math.round(transitDistanceKm * 50),
              has_transfer: bestTransit.steps?.length > 3,
              scenic_score: 0.6,
              comfort_score: 0.7,
              operator_name: 'Public Transit',
              polyline: bestTransit.polyline,
              navigation_steps: bestTransit.steps,
            });
          }

          if (hasRailOnBothEnds) {
            allRoutes.push({
              route_id: 'GMAPS_TRANSIT_TRAIN',
              origin_city_id: accessOriginCity?.city_id || 'geocoded',
              destination_city_id: accessDestCity?.city_id || 'geocoded',
              transport_type: 'train',
              distance_km: transitDistanceKm,
              estimated_duration_min: Math.round(transitDurationMin * 1.05),
              base_fare_lkr: Math.round(transitDistanceKm * 40),
              has_transfer: bestTransit.steps?.length > 2,
              scenic_score: 0.8,
              comfort_score: 0.75,
              operator_name: 'Sri Lanka Railways (maps transit)',
              polyline: bestTransit.polyline,
              navigation_steps: bestTransit.steps,
            });
          }

          logger.info('Added Google transit public transport options by city access', {
            hasBusOnBothEnds,
            hasRailOnBothEnds,
            transitDistanceKm,
            transitDurationMin,
          });
        }

        // Always include driving options as optional alternatives
        drivingRoutes.forEach((route, idx) => {
          allRoutes.push({
            route_id: `GMAPS_DRIVING_${idx}`,
            origin_city_id: accessOriginCity?.city_id || 'geocoded',
            destination_city_id: accessDestCity?.city_id || 'geocoded',
            transport_type: 'car',
            distance_km: route.distance / 1000,
            estimated_duration_min: Math.round(route.duration / 60),
            base_fare_lkr: Math.round((route.distance / 1000) * 150),
            has_transfer: false,
            scenic_score: 0.7,
            comfort_score: 0.9,
            operator_name: 'PickMe/Uber',
            polyline: route.polyline,
            navigation_steps: route.steps,
          });
        });

        // If transit is unavailable, synthesize bus/train from city access + driving baseline
        if (transitRoutes.length === 0 && drivingRoutes.length > 0) {
          const baseDriving = drivingRoutes[0];
          const baseDistanceKm = baseDriving.distance / 1000;
          const baseDrivingMin = Math.round(baseDriving.duration / 60);

          if (hasBusOnBothEnds) {
            allRoutes.push({
              route_id: 'CITY_GMAPS_BUS_FALLBACK',
              origin_city_id: accessOriginCity?.city_id || 'geocoded',
              destination_city_id: accessDestCity?.city_id || 'geocoded',
              transport_type: 'bus',
              distance_km: baseDistanceKm,
              estimated_duration_min: Math.round(baseDrivingMin * 1.35),
              base_fare_lkr: Math.round(baseDistanceKm * 50),
              has_transfer: baseDistanceKm > 140,
              scenic_score: 0.6,
              comfort_score: 0.65,
              operator_name: 'Public Bus (city+maps estimate)',
            });
          }

          if (hasRailOnBothEnds) {
            allRoutes.push({
              route_id: 'CITY_GMAPS_TRAIN_FALLBACK',
              origin_city_id: accessOriginCity?.city_id || 'geocoded',
              destination_city_id: accessDestCity?.city_id || 'geocoded',
              transport_type: 'train',
              distance_km: baseDistanceKm,
              estimated_duration_min: Math.round(baseDrivingMin * 1.2),
              base_fare_lkr: Math.round(baseDistanceKm * 40),
              has_transfer: baseDistanceKm > 220,
              scenic_score: 0.8,
              comfort_score: 0.75,
              operator_name: 'Sri Lanka Railways (city+maps estimate)',
            });
          }

          logger.info('Added City+Google fallback public transport options', {
            hasBusOnBothEnds,
            hasRailOnBothEnds,
            distanceKm: baseDistanceKm,
          });
        }

        if (allRoutes.length === 0) {
          return {
            conversation_id: String(conversation._id),
            message: `I couldn't find any routes between ${origin} and ${destination}. This might be due to Google Maps API limitations. Please try different locations or check back later.`,
            message_type: 'text',
          };
        }

        logger.info(`Found ${allRoutes.length} routes from Google Maps`);

        // Log details of all routes for debugging
        allRoutes.forEach((route, idx) => {
          logger.info(
            `  Route ${idx + 1}: ${route.transport_type} - ${(route.distance_km || 0).toFixed(1)}km, ${route.estimated_duration_min || 0}min, fare: LKR ${route.base_fare_lkr || 0}`
          );
        });

        // Build route contexts with real-time data (parallel)
        const routeContexts = await this.routeContextBuilder.buildRouteContexts(
          allRoutes,
          originCoords,
          destCoords
        );

        // Filter out failed contexts
        const validContexts = routeContexts.filter((ctx) => ctx !== null) as RouteContext[];
        if (validContexts.length === 0) {
          return {
            conversation_id: String(conversation._id),
            message: 'Could not fetch real-time data for available routes. Please try again.',
            message_type: 'error',
          };
        }

        // Infer user preferences from message and rank routes
        const userWeights = this.rankingService.guessUserWeights(request.message);
        const departureTime = this.resolveDepartureTime(intent.entities.time, request.message);

        // Pass coordinates to enable ML ranking
        const rankedRoutes = await this.rankingService.rankRoutes(validContexts, userWeights, {
          origin: originCoords,
          destination: destCoords,
          departureTime,
        });

        // Fetch incidents affecting this route
        let routeIncidents: IncidentResponse[] = [];
        try {
          routeIncidents = await this.incidentService.getIncidentsForRoute(
            originCoords.lat,
            originCoords.lng,
            destCoords.lat,
            destCoords.lng,
            15 // 15km corridor radius
          );
        } catch (error) {
          logger.warn('Error fetching route incidents:', error);
          // Continue without incidents
        }

        // Generate natural language explanation from top routes (fallback if LLM unavailable)
        let explanation: string;
        try {
          explanation = await this.llmService.generateRouteExplanation(
            rankedRoutes,
            origin!,
            destination!
          );
        } catch (error) {
          logger.warn('Error generating explanation:', (error as Error).message);
          // Fallback explanation
          explanation = `I found ${rankedRoutes.length} route options from ${origin} to ${destination}.`;
        }

        // Format detailed response with top 3 routes and incidents
        const detailedResponse = this.formatIntelligentRouteResponse(
          rankedRoutes,
          explanation,
          departureTime,
          routeIncidents
        );

        // Update conversation context (only if both cities were found in database)
        // This ensures time queries can reliably use stored city names
        if (originCity && destCity) {
          await this.conversationService.updateContext(String(conversation._id), {
            current_location: {
              city_id: originCity.city_id,
              city_name: originCity.name?.en || originCity.city_name || origin,
              coordinates: [originCoords.lng, originCoords.lat],
            },
            destination: {
              city_id: destCity.city_id,
              city_name: destCity.name?.en || destCity.city_name || destination,
              coordinates: [destCoords.lng, destCoords.lat],
            },
          });
          logger.info('Updated conversation context with valid cities:', {
            origin: originCity.name?.en || originCity.city_name,
            destination: destCity.name?.en || destCity.city_name,
          });
        } else {
          logger.info('Skipping context update - using geocoded locations without DB cities');
        }

        return {
          conversation_id: String(conversation._id),
          message: detailedResponse,
          message_type: 'route_suggestion',
          metadata: {
            intent: 'route_query',
            locations_identified: [
              {
                name: origin!,
                city_id: originCity?.city_id ? Number(originCity.city_id) : undefined,
                confidence: 0.95,
              },
              {
                name: destination!,
                city_id: destCity?.city_id ? Number(destCity.city_id) : undefined,
                confidence: 0.95,
              },
            ],
            transport_recommendations: {
              ranking_weights: userWeights,
              ranked_routes: rankedRoutes.slice(0, 3).map((route) => ({
                route_id: route.route_id,
                transport_type: route.transport_type,
                score: route.score,
                ml_confidence: route.ml_confidence,
                recommendation_reason: route.recommendation_reason,
              })),
            },
            road_incidents: {
              active_incidents: routeIncidents,
              incident_count: routeIncidents.length,
              critical_incidents: routeIncidents.filter((i) => i.severity === 'critical').length,
              high_incidents: routeIncidents.filter((i) => i.severity === 'high').length,
            },
            station_data: {
              origin: this.buildCityStationData(
                origin!,
                originCity || originCityForTrains,
                originCity ? 'direct' : 'nearest'
              ),
              destination: this.buildCityStationData(
                destination!,
                destCity || destCityForTrains,
                destCity ? 'direct' : 'nearest'
              ),
            },
            map_data: {
              origin: originCoords,
              destination: destCoords,
              routes: rankedRoutes.slice(0, 3).map((route) => ({
                route_id: route.route_id,
                transport_type: route.transport_type,
                polyline: route.static.polyline,
                navigation_steps: route.static.navigation_steps,
                color: this.getRouteColor(route.transport_type),
              })),
            },
            processing_time_ms: 0,
          },
          suggestions: [
            'Show me more options',
            'What about cheaper routes?',
            'Which is fastest?',
            'Tell me about weather',
          ],
        };
      } catch (googleMapsError) {
        logger.error('Error fetching routes from Google Maps:', googleMapsError);
        return {
          conversation_id: String(conversation._id),
          message: `I'm having trouble finding routes between ${origin} and ${destination} right now. This could be due to:\n\n• Google Maps API is not configured\n• Network connectivity issues\n• The locations are too far apart\n\nPlease try again later or contact support if the problem persists.`,
          message_type: 'error',
        };
      }
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
   * Format intelligent route response with ranked options
   */
  private formatIntelligentRouteResponse(
    rankedRoutes: RankedRoute[],
    explanation: string,
    departureTime: Date,
    incidents?: IncidentResponse[]
  ): string {
    let response = `${explanation}\n\n`;

    const topRoute = rankedRoutes[0];
    const isNightWindow = this.isNightTravelWindow(departureTime);
    const shortTrip = topRoute ? topRoute.dynamic.distance_km < 25 : false;

    // Add incident warning if there are any
    if (incidents && incidents.length > 0) {
      const criticalIncidents = incidents.filter((i) => i.severity === 'critical');
      const highIncidents = incidents.filter((i) => i.severity === 'high');
      const mediumIncidents = incidents.filter((i) => i.severity === 'medium');

      if (criticalIncidents.length > 0) {
        response += '🚨 **CRITICAL INCIDENTS ON ROUTE:**\n';
        criticalIncidents.forEach((incident) => {
          const distanceInfo = incident.distance_from_user_km
            ? ` (${incident.distance_from_user_km.toFixed(1)} km from origin)`
            : '';
          response += `• ${incident.title}${distanceInfo}\n`;
          response += `  ${incident.description.substring(0, 80)}...\n`;
          if (incident.estimated_delay_min) {
            response += `  ⏱️ Expected delay: ${incident.estimated_delay_min} minutes\n`;
          }
        });
        response += '\n';
      }

      if (highIncidents.length > 0) {
        response += '⚠️ **Important Road Conditions:**\n';
        highIncidents.forEach((incident) => {
          const distanceInfo = incident.distance_from_user_km
            ? ` - ${incident.distance_from_user_km.toFixed(1)} km from origin`
            : '';
          response += `• ${incident.title} (${incident.incident_type})${distanceInfo}\n`;
        });
        response += '\n';
      }

      if (mediumIncidents.length > 0) {
        response += 'ℹ️ **Reported Road Issues:**\n';
        mediumIncidents.slice(0, 3).forEach((incident) => {
          const distanceInfo = incident.distance_from_user_km
            ? ` - ${incident.distance_from_user_km.toFixed(1)} km from origin`
            : '';
          response += `• ${incident.title}${distanceInfo}\n`;
        });
        if (mediumIncidents.length > 3) {
          response += `• ...and ${mediumIncidents.length - 3} more\n`;
        }
        response += '\n';
      }

      const lowIncidents =
        incidents.length - criticalIncidents.length - highIncidents.length - mediumIncidents.length;
      if (lowIncidents > 0) {
        response += `💡 ${lowIncidents} minor incident(s) also reported in this area.\n\n`;
      }
    }

    response += '**Route Summary:**\n';
    if (topRoute) {
      response += `• Departure time considered: ${departureTime.toLocaleTimeString('en-LK', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })} (${isNightWindow ? 'night window' : 'day window'})\n`;
      response += `• Estimated trip distance: ${topRoute.dynamic.distance_km.toFixed(1)} km\n`;
      if (isNightWindow && shortTrip) {
        response +=
          '• Reasoning: For trips under 25 km during 8:00 PM–5:00 AM, ride-hailing (PickMe/Uber) is prioritized because public transport availability is less reliable.\n';
      } else {
        response +=
          '• Reasoning: Ranked by travel time, fare, comfort, safety, weather, traffic, incidents, and ML confidence.\n';
      }
    }

    response += '\n';

    // Show top 3 routes with detailed metrics
    if (rankedRoutes.length > 0) {
      response += '**Detailed Route Options:**\n\n';

      rankedRoutes.slice(0, 3).forEach((route, index) => {
        const medalEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
        response += `${medalEmoji} **Option ${index + 1}: ${route.transport_type.toUpperCase()}**\n`;
        response += `   Provider: ${route.static.operator_name}\n`;
        response += `   Score: ${(route.score * 100).toFixed(0)}/100\n`;
        response += `   ⏱ Duration: ${route.dynamic.duration_min} min\n`;
        response += `   📏 Distance: ${route.dynamic.distance_km.toFixed(1)} km\n`;

        // Add next departure time for bus/train
        if (route.transport_type === 'bus' || route.transport_type === 'train') {
          const nextDeparture = this.mockTimetableService.getNextDeparture(
            route.dynamic.distance_km,
            route.transport_type,
            departureTime
          );
          if (nextDeparture) {
            response += `   🕐 Next Departure: ${this.mockTimetableService.formatDepartureForDisplay(nextDeparture)}\n`;
          }
        } else if (route.transport_type === 'car') {
          response += `   🕐 Available: On demand (book anytime)\n`;
        }

        // Show key metrics
        const metrics = [];
        if (route.dynamic.weather_risk < 0.3) metrics.push('✅ Good weather');
        if (route.dynamic.congestion === 'low') metrics.push('🟢 Low traffic');
        if (route.static.scenic_score > 0.7) metrics.push('🌄 Scenic route');
        if (route.static.comfort_score > 0.7) metrics.push('🪑 Comfortable');

        if (metrics.length > 0) {
          response += `   ${metrics.join(' • ')}\n`;
        }

        if (route.recommendation_reason) {
          response += `   🧠 Why this rank: ${route.recommendation_reason}\n`;
        }

        // Show turn-by-turn navigation for the top route only
        if (
          index === 0 &&
          route.static.navigation_steps &&
          route.static.navigation_steps.length > 0
        ) {
          response += '\n   **🗺️ Turn-by-Turn Directions:**\n';
          const stepsToShow = route.static.navigation_steps.slice(0, 8); // Show first 8 steps
          stepsToShow.forEach((step, stepIdx: number) => {
            const maneuverEmoji = this.getManeuverEmoji(step.maneuver);
            const distanceKm = (step.distance / 1000).toFixed(1);
            response += `   ${stepIdx + 1}. ${maneuverEmoji} ${step.instruction} (${distanceKm} km)\n`;
          });
          if (route.static.navigation_steps.length > 8) {
            response += `   ... and ${route.static.navigation_steps.length - 8} more steps\n`;
          }
        }

        response += '\n';
      });
    }

    response +=
      '💡 *Tip: You can ask me for cheaper options, faster routes, or more comfortable transport!*';
    return response;
  }

  private buildCityStationData(
    requestedName: string,
    city: ICity | null | undefined,
    matchedBy: 'direct' | 'nearest'
  ) {
    if (!city) {
      return {
        requested_name: requestedName,
      };
    }

    return {
      requested_name: requestedName,
      matched_city_id: city.city_id,
      matched_city_name: city.name?.en || city.city_name,
      matched_city_slug: city.slug,
      matched_by: matchedBy,
      has_railway_access: city.transport_access?.has_railway,
      has_bus_access: city.transport_access?.has_bus,
      nearest_railway_station: city.nearest_railway_station
        ? {
            station_id: city.nearest_railway_station.station_id,
            station_name: city.nearest_railway_station.station_name,
            distance_km: city.nearest_railway_station.distance_km,
            latitude: city.nearest_railway_station.latitude,
            longitude: city.nearest_railway_station.longitude,
            location: city.nearest_railway_station.location,
          }
        : undefined,
      nearest_bus_station: city.nearest_bus_station
        ? {
            station_id: city.nearest_bus_station.station_id,
            station_name: city.nearest_bus_station.station_name,
            distance_km: city.nearest_bus_station.distance_km,
            latitude: city.nearest_bus_station.latitude,
            longitude: city.nearest_bus_station.longitude,
            operator: city.nearest_bus_station.operator,
          }
        : undefined,
      distance_to_nearest_railway_km:
        city.distance_to_nearest_railway_km ?? city.transport_stats?.distance_to_nearest_railway_km,
      distance_to_nearest_bus_km:
        city.distance_to_nearest_bus_km ?? city.transport_stats?.distance_to_nearest_bus_km,
    };
  }

  private hasReliableRailwayAccess(city: ICity | null | undefined): boolean {
    if (!city?.transport_access?.has_railway) {
      return false;
    }

    const station = city.nearest_railway_station;
    if (!station) {
      return false;
    }

    const stationName = (station.station_name || '').trim();
    if (!stationName) {
      return false;
    }

    const stationId = (station.station_id || '').toString().trim().toLowerCase();
    const hasKnownStationId = stationId.length > 0 && stationId !== 'unknown';
    const hasLocationHint = Boolean((station.location || '').trim());

    // Keep railway eligibility only for reasonably trustworthy station metadata.
    return hasKnownStationId || hasLocationHint;
  }

  private resolveDepartureTime(extractedTime?: string, message?: string): Date {
    const baseDate = new Date();
    const candidates = [extractedTime, message].filter((v): v is string => Boolean(v));

    for (const text of candidates) {
      const match = text.match(/\b(1[0-2]|0?[1-9])(?::([0-5][0-9]))?\s*(am|pm)\b/i);
      if (!match) {
        continue;
      }

      let hour = Number(match[1]);
      const minute = Number(match[2] || '0');
      const period = match[3].toLowerCase();

      if (period === 'pm' && hour !== 12) {
        hour += 12;
      }
      if (period === 'am' && hour === 12) {
        hour = 0;
      }

      const parsed = new Date(baseDate);
      parsed.setHours(hour, minute, 0, 0);
      return parsed;
    }

    return baseDate;
  }

  private isNightTravelWindow(departureTime: Date): boolean {
    const hour = departureTime.getHours();
    return hour >= 20 || hour < 5;
  }

  /**
   * Get color for route type (for map rendering)
   */
  private getRouteColor(transportType: string): string {
    const colorMap: Record<string, string> = {
      bus: '#3B82F6', // Blue
      train: '#10B981', // Green
      car: '#F59E0B', // Amber
      taxi: '#F59E0B', // Amber
      tuk_tuk: '#8B5CF6', // Purple
    };
    return colorMap[transportType.toLowerCase()] || '#6B7280'; // Gray default
  }

  /**
   * Get emoji for navigation maneuver
   */
  private getManeuverEmoji(maneuver?: string): string {
    if (!maneuver) return '➡️';

    const maneuverMap: Record<string, string> = {
      'turn-left': '↰',
      'turn-slight-left': '↖️',
      'turn-sharp-left': '↰',
      'turn-right': '↱',
      'turn-slight-right': '↗️',
      'turn-sharp-right': '↱',
      straight: '⬆️',
      'ramp-left': '🛣️',
      'ramp-right': '🛣️',
      merge: '🔀',
      'fork-left': '↖️',
      'fork-right': '↗️',
      'roundabout-left': '🔄',
      'roundabout-right': '🔄',
      'uturn-left': '↩️',
      'uturn-right': '↪️',
    };

    return maneuverMap[maneuver.toLowerCase()] || '➡️';
  }

  /**
   * Generate a humanized, conversational departure times response using LLM
   */
  private async generateHumanizedTimeResponse(
    origin: string,
    destination: string,
    distanceKm: number,
    timingData: Array<{
      mode: string;
      available: boolean;
      nextDeparture?: string;
      upcomingDepartures?: string[];
      reason?: string;
    }>
  ): Promise<string> {
    try {
      // Build structured data for LLM
      const dataString = JSON.stringify(
        {
          route: `${origin} → ${destination}`,
          distance_km: distanceKm.toFixed(1),
          transport_options: timingData,
        },
        null,
        2
      );

      const systemPrompt = `You are a friendly, helpful Sri Lankan transport assistant. Your job is to present departure times in a clear, conversational way.

Guidelines:
- Start with a friendly greeting about the route
- Present the distance naturally in the conversation
- For each transport mode, clearly show:
  * Bus: Use 🚌 emoji
  * Train: Use 🚊 emoji  
  * Car/Taxi: Use 🚗 emoji
- Show next departure time prominently
- List upcoming departures if available (just the times, cleanly formatted)
- If a mode is not available, explain why briefly and positively
- Keep the tone warm and conversational, like talking to a friend
- Don't mention "mock times" or "estimates" - present the information as factual timetable data
- Keep it concise but complete

Keep the response structured but natural - it should feel helpful and easy to scan.`;

      const userPrompt = `Present these departure times in a friendly, conversational way:\n\n${dataString}`;

      const response = await this.llmService.generateCompletionWithSystem(
        systemPrompt,
        userPrompt,
        600,
        0.7
      );

      return (
        response || this.buildFallbackTimeResponse(origin, destination, distanceKm, timingData)
      );
    } catch (error) {
      logger.error('Error generating humanized time response:', error);
      // Fallback to structured response if LLM fails
      return this.buildFallbackTimeResponse(origin, destination, distanceKm, timingData);
    }
  }

  /**
   * Fallback time response if LLM fails
   */
  private buildFallbackTimeResponse(
    origin: string,
    destination: string,
    distanceKm: number,
    timingData: Array<{
      mode: string;
      available: boolean;
      nextDeparture?: string;
      upcomingDepartures?: string[];
      reason?: string;
    }>
  ): string {
    let response = `**Departure Times: ${origin} → ${destination}**\n`;
    response += `Distance: ${distanceKm.toFixed(1)} km\n\n`;

    let hasAvailableMode = false;

    for (const data of timingData) {
      if (!data.available) {
        response += `❌ **${data.mode}**: Not available\n`;
        if (data.reason) {
          response += `   (${data.reason})\n`;
        }
        response += '\n';
        continue;
      }

      hasAvailableMode = true;

      const modeEmoji = data.mode === 'Bus' ? '🚌' : data.mode === 'Train' ? '🚊' : '🚗';
      response += `${modeEmoji} **${data.mode}**\n`;

      if (data.nextDeparture) {
        if (data.mode === 'Car/Taxi') {
          response += `   ✅ ${data.nextDeparture}\n`;
          response += `   💡 PickMe, Uber, or local taxi services\n`;
        } else {
          response += `   🕐 Next Departure: ${data.nextDeparture}\n`;

          if (data.upcomingDepartures && data.upcomingDepartures.length > 0) {
            response += `   📅 Upcoming:\n`;
            data.upcomingDepartures.forEach((dep) => {
              response += `      • ${dep}\n`;
            });
          }
        }
      } else if (data.reason) {
        response += `   ⚠️ ${data.reason}\n`;
      }
      response += '\n';
    }

    if (!hasAvailableMode) {
      response += '💡 No public transport available on this route. Consider car/taxi services.\n';
    }

    return response;
  }

  /**
   * Handle time query (next bus/train departure times)
   */
  private async handleTimeQuery(
    conversation: IConversation,
    _request: ChatRequest,
    intent: ExtractedIntent
  ): Promise<ChatResponse> {
    try {
      const { origin, destination, transport_type } = intent.entities;

      // Try to get route context from conversation context first (from last route query)
      let finalOrigin = origin;
      let finalDestination = destination;

      // If not provided, check conversation context (stored after route query)
      if (!finalOrigin || !finalDestination) {
        const context = conversation.context;
        if (context?.current_location?.city_name && !finalOrigin) {
          finalOrigin = context.current_location.city_name;
          logger.info('Using origin from conversation context:', finalOrigin);
        }
        if (context?.destination?.city_name && !finalDestination) {
          finalDestination = context.destination.city_name;
          logger.info('Using destination from conversation context:', finalDestination);
        }
      }

      // Fallback to pending query context if still not found
      if (!finalOrigin || !finalDestination) {
        const pendingQuery = this.conversationService.getPendingRouteQuery(conversation);
        if (!finalOrigin && pendingQuery?.origin?.name) {
          finalOrigin = pendingQuery.origin.name;
        }
        if (!finalDestination && pendingQuery?.destination?.name) {
          finalDestination = pendingQuery.destination.name;
        }
      }

      // If we still don't have both locations, ask for them
      if (!finalOrigin || !finalDestination) {
        logger.warn('Time query without complete location context', {
          hasOrigin: !!finalOrigin,
          hasDestination: !!finalDestination,
          conversationContext: conversation.context,
        });

        return {
          conversation_id: String(conversation._id),
          message: `To check departure times, I need a complete route first.\n\n💡 **Try asking:** "I want to go from Colombo to Kandy"\n\nThen you can ask about departure times, and I'll remember your route!`,
          message_type: 'text',
          suggestions: [
            'I want to go from Colombo to Kandy',
            'Show routes from Galle to Colombo',
            'Nugegoda to Anuradhapura',
          ],
        };
      }

      logger.info('Using locations for time query:', {
        origin: finalOrigin,
        destination: finalDestination,
        fromContext: !origin && !destination,
      });

      // Find cities
      const originCity = await this.transportService.findCity({ cityName: finalOrigin });
      const destCity = await this.transportService.findCity({ cityName: finalDestination });

      if (!originCity || !destCity) {
        const missingCity = !originCity ? finalOrigin : finalDestination;
        const wasFromContext = !origin && !destination;

        let message = `I couldn't find "${missingCity}". `;

        if (wasFromContext) {
          message += `This location might have been saved incorrectly from a previous query.\n\n💡 **Try asking for a new route:**\n"I want to go from Colombo to Kandy"`;
        } else {
          message += `Please check the spelling or try a nearby city.`;
        }

        logger.warn('City not found in time query', {
          missingCity,
          wasFromContext,
          origin: finalOrigin,
          destination: finalDestination,
        });

        return {
          conversation_id: String(conversation._id),
          message,
          message_type: 'text',
          suggestions: [
            'I want to go from Colombo to Kandy',
            'Show routes from Galle to Colombo',
            'Transport options to Anuradhapura',
          ],
        };
      }

      // Calculate distance between cities
      const originCoords = {
        lat: originCity.location.coordinates[1],
        lng: originCity.location.coordinates[0],
      };
      const destCoords = {
        lat: destCity.location.coordinates[1],
        lng: destCity.location.coordinates[0],
      };

      // Get distance from Google Maps
      const routes = await this.googleMapsService.getDirections(
        originCoords,
        destCoords,
        'driving',
        false
      );
      const distanceKm = routes.length > 0 ? routes[0].distance / 1000 : 0;

      // Collect departure data for all available modes
      const modes: Array<{ type: 'bus' | 'train' | 'car'; name: string; available: boolean }> = [
        {
          type: 'bus',
          name: 'Bus',
          available: Boolean(
            originCity.transport_access?.has_bus && destCity.transport_access?.has_bus
          ),
        },
        {
          type: 'train',
          name: 'Train',
          available:
            this.hasReliableRailwayAccess(originCity) && this.hasReliableRailwayAccess(destCity),
        },
        {
          type: 'car',
          name: 'Car/Taxi',
          available: true, // Always available
        },
      ];

      // Filter by transport type if specified
      const targetModes = transport_type ? modes.filter((m) => m.type === transport_type) : modes;

      // Collect timing data for LLM
      const timingData: Array<{
        mode: string;
        available: boolean;
        nextDeparture?: string;
        upcomingDepartures?: string[];
        reason?: string;
      }> = [];

      for (const mode of targetModes) {
        if (!mode.available) {
          let reason = '';
          if (mode.type === 'bus') {
            reason = 'One or both cities lack bus access';
          } else if (mode.type === 'train') {
            reason = 'No railway stations at origin or destination';
          }
          timingData.push({
            mode: mode.name,
            available: false,
            reason,
          });
          continue;
        }

        const nextDeparture = this.mockTimetableService.getNextDeparture(
          distanceKm,
          mode.type,
          new Date()
        );

        if (!nextDeparture) {
          timingData.push({
            mode: mode.name,
            available: true,
            reason: 'Unable to fetch timing',
          });
          continue;
        }

        const upcomingDepartures = this.mockTimetableService.getUpcomingDepartures(
          distanceKm,
          mode.type,
          3,
          new Date()
        );

        if (mode.type === 'car') {
          timingData.push({
            mode: mode.name,
            available: true,
            nextDeparture: 'On demand (book anytime)',
          });
        } else {
          timingData.push({
            mode: mode.name,
            available: true,
            nextDeparture: this.mockTimetableService.formatDepartureForDisplay(nextDeparture),
            upcomingDepartures:
              upcomingDepartures.length > 1
                ? upcomingDepartures
                    .slice(1, 3)
                    .map((dep) => this.mockTimetableService.formatDepartureForDisplay(dep))
                : undefined,
          });
        }
      }

      // Generate humanized response using LLM
      const response = await this.generateHumanizedTimeResponse(
        finalOrigin,
        finalDestination,
        distanceKm,
        timingData
      );

      return {
        conversation_id: String(conversation._id),
        message: response,
        message_type: 'text',
        metadata: {
          intent: 'time_query',
          locations_identified: [
            { name: finalOrigin, city_id: originCity.city_id, confidence: 0.95 },
            { name: finalDestination, city_id: destCity.city_id, confidence: 0.95 },
          ],
          processing_time_ms: 0,
        },
        suggestions: ['Show me route options', 'What about cheaper routes?', 'Weather information'],
      };
    } catch (error) {
      logger.error('Error handling time query:', error);
      return {
        conversation_id: String(conversation._id),
        message: 'I encountered an error while fetching departure times. Please try again.',
        message_type: 'error',
      };
    }
  }

  /**
   * Handle weather query
   */
  private async handleWeatherQuery(
    conversation: IConversation,
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

    // Extract lat/lon from GeoJSON coordinates [longitude, latitude]
    const latitude = city.location.coordinates[1];
    const longitude = city.location.coordinates[0];

    const weather = await this.weatherService.getCurrentWeather(latitude, longitude);

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
    conversation: IConversation,
    request: ChatRequest,
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

    // Check if this is a tourism/attraction question
    const lowerMessage = request.message.toLowerCase();
    const isTourismQuestion =
      /(?:attraction|tourist|destination|place|visit|see|thing|explore|sight|best|top|popular|beautiful|nice|scenic|spot|point|interest|landmark)/i.test(
        lowerMessage
      );

    // If it's a tourism question, use the LLM to answer dynamically
    if (isTourismQuestion) {
      try {
        // Get conversation history for context
        const recentMessages = await this.conversationService.getRecentMessages(
          String(conversation._id),
          10
        );

        const systemPrompt = `You are a helpful Sri Lankan transport and tourism assistant. 
You specialize in:
1. **Transport routes** - Buses, trains, and travel connections across Sri Lanka
2. **Tourist attractions** - You know about popular destinations, landmarks, beaches, national parks, and things to do in every region of Sri Lanka
3. **Travel tips** - Cultural awareness, best times to visit, local recommendations

When asked about tourist destinations or attractions:
- Provide specific attraction names and descriptions
- Mention what makes each place special
- Include practical transport tips (how to get there)
- Be enthusiastic and helpful
- Use relevant emojis to make responses engaging

IMPORTANT: The user is asking about locations between ${intent.entities.origin || 'their origin'} and ${intent.entities.destination || 'their destination'}. 
Focus on attractions ALONG OR NEAR this route.`;

        const conversationHistory = recentMessages
          .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
          .join('\n');

        const response = await this.llmService.generateCompletionWithSystem(
          systemPrompt,
          `Conversation history:\n${conversationHistory}\n\nUser: ${request.message}`,
          1000,
          0.7
        );

        return {
          conversation_id: String(conversation._id),
          message: response,
          message_type: 'text',
        };
      } catch (error) {
        logger.warn('LLM failed for tourism question in location_info, using fallback', error);
        // Fallback: provide helpful guidance
        return {
          conversation_id: String(conversation._id),
          message: `I'd love to tell you about attractions between ${intent.entities.origin || 'your origin'} and ${intent.entities.destination || 'your destination'}! 🌍\n\nWhile I can't provide detailed information right now, I recommend:\n\n• Searching online for "${intent.entities.origin} to ${intent.entities.destination} attractions"\n• Asking locals along the route\n• Checking for national parks, beaches, temples, or historical sites\n\nI can help you plan the transport for your journey though! Just let me know if you need route information.`,
          message_type: 'text',
          suggestions: [
            `Route from ${intent.entities.origin} to ${intent.entities.destination}`,
            `Weather along the route`,
            `Tell me about ${intent.entities.destination}`,
          ],
        };
      }
    }

    // Standard location info (non-tourism)
    const city = await this.transportService.findCity({ cityName: location });
    if (!city) {
      return {
        conversation_id: String(conversation._id),
        message: `I couldn't find information about "${location}".`,
        message_type: 'text',
      };
    }

    let message = `I see you mentioned ${city.name.en}! 🌍\n\n`;
    message += `I can help you with:\n`;
    message += `• Getting TO ${city.name.en} - just tell me where you're starting from\n`;
    message += `• Traveling FROM ${city.name.en} - let me know your destination\n`;
    message += `• Weather conditions in ${city.name.en}\n`;
    message += `• Information about the city\n\n`;
    message += `What would you like to know?`;

    return {
      conversation_id: String(conversation._id),
      message,
      message_type: 'text',
      suggestions: [
        `How to get to ${city.name.en}?`,
        `Routes from ${city.name.en}`,
        `Weather in ${city.name.en}`,
      ],
    };
  }

  /**
   * Handle greeting
   */
  private async handleGreeting(
    conversation: IConversation,
    _request: ChatRequest
  ): Promise<ChatResponse> {
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
    conversation: IConversation,
    request: ChatRequest,
    context: IMessage[]
  ): Promise<ChatResponse> {
    try {
      const systemPrompt = `You are a helpful Sri Lankan transport and tourism assistant. 
You specialize in:
1. **Transport routes** - Buses, trains, and travel connections across Sri Lanka
2. **Tourist attractions** - You know about popular destinations, landmarks, beaches, national parks, and things to do in every region of Sri Lanka
3. **Travel tips** - Cultural awareness, best times to visit, local recommendations

When asked about tourist destinations or attractions:
- Provide specific attraction names and descriptions
- Mention what makes each place special
- Include practical transport tips (how to get there)
- Be enthusiastic and helpful
- Use relevant emojis to make responses engaging

Be friendly, culturally aware, and helpful. If you don't know something, admit it and suggest alternatives.`;

      const conversationHistory = context
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n');

      const response = await this.llmService.generateCompletionWithSystem(
        systemPrompt,
        `Conversation history:\n${conversationHistory}\n\nUser: ${request.message}`,
        1000,
        0.7
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
  ): Promise<{ conversations: IConversation[]; total: number }> {
    return this.conversationService.getUserConversations(userId, page, limit);
  }

  /**
   * Get specific conversation with messages
   */
  async getConversationWithMessages(
    conversationId: string
  ): Promise<{ conversation: IConversation; messages: IMessage[] } | null> {
    return this.conversationService.getConversation(conversationId);
  }

  /**
   * Start a fresh trip conversation (used by "New Trip" button)
   */
  async startNewTripConversation(
    userId: string,
    title?: string
  ): Promise<{
    conversation_id: string;
    status: 'started';
    ended_previous_conversation: boolean;
    title: string;
    created_at: Date;
  }> {
    const activeConversation = await this.conversationService.getActiveConversation(userId);

    let endedPreviousConversation = false;
    if (activeConversation) {
      await this.conversationService.endConversation(String(activeConversation._id));
      endedPreviousConversation = true;
    }

    const now = new Date();
    const defaultTitle = `Trip ${now.toLocaleDateString('en-LK')} ${now.toLocaleTimeString(
      'en-LK',
      {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }
    )}`;

    const newConversation = await this.conversationService.createConversation({
      user_id: userId,
      title: title?.trim() || defaultTitle,
    });

    return {
      conversation_id: String(newConversation._id),
      status: 'started',
      ended_previous_conversation: endedPreviousConversation,
      title: newConversation.title || defaultTitle,
      created_at: newConversation.createdAt,
    };
  }
}
