import { ConversationService } from './ConversationService';
import { TransportService } from './TransportService';
import { WeatherService } from './WeatherService';
import { LLMService } from './LLMService';
import { GoogleMapsService } from './GoogleMapsService';
import { RouteContextBuilder } from './RouteContextBuilder';
import { RankingService } from './RankingService';
import { logger } from '../../../../shared/config/logger';
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
  private googleMapsService: GoogleMapsService;
  private routeContextBuilder: RouteContextBuilder;
  private rankingService: RankingService;

  constructor() {
    this.conversationService = new ConversationService();
    this.transportService = new TransportService();
    this.weatherService = new WeatherService();
    this.llmService = new LLMService();
    this.googleMapsService = new GoogleMapsService();
    this.routeContextBuilder = new RouteContextBuilder();
    this.rankingService = new RankingService();
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
   * Calculate distance between two coordinates using Haversine formula
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of Earth in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Handle route query with intelligent ranking and explanation
   */
  private async handleRouteQuery(
    conversation: any,
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
      logger.info(`Fetching routes from Google Maps: ${origin} → ${destination}`);
      logger.info(
        `Origin coords: ${JSON.stringify(originCoords)}, Dest coords: ${JSON.stringify(destCoords)}`
      );

      try {
        // Fetch routes for different transport modes in parallel
        const [transitRoutes, drivingRoutes] = await Promise.all([
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
          `Fetched ${transitRoutes.length} transit routes and ${drivingRoutes.length} driving routes`
        );

        // Create synthetic route objects from Google Maps responses
        const allRoutes: any[] = [];

        // Add transit routes (bus/train)
        transitRoutes.forEach((route, idx) => {
          allRoutes.push({
            route_id: `GMAPS_TRANSIT_${idx}`,
            origin_city_id: originCity?.city_id || 'geocoded',
            destination_city_id: destCity?.city_id || 'geocoded',
            transport_type: 'bus',
            distance_km: route.distance / 1000,
            estimated_time_min: Math.round(route.duration / 60),
            base_fare_lkr: Math.round((route.distance / 1000) * 50), // Estimate: 50 LKR per km
            has_transfer: route.steps?.length > 3,
            scenic_score: 0.6,
            comfort_score: 0.7,
            operator_name: 'Public Transit',
            navigation_steps: route.steps, // Include turn-by-turn navigation
          });
        });

        // Add driving routes (car/taxi)
        drivingRoutes.forEach((route, idx) => {
          allRoutes.push({
            route_id: `GMAPS_DRIVING_${idx}`,
            origin_city_id: originCity?.city_id || 'geocoded',
            destination_city_id: destCity?.city_id || 'geocoded',
            transport_type: 'car',
            distance_km: route.distance / 1000,
            estimated_time_min: Math.round(route.duration / 60),
            base_fare_lkr: Math.round((route.distance / 1000) * 150), // Estimate: 150 LKR per km
            has_transfer: false,
            scenic_score: 0.7,
            comfort_score: 0.9,
            operator_name: 'Private Car/Taxi',
            navigation_steps: route.steps, // Include turn-by-turn navigation
          });
        });

        if (allRoutes.length === 0) {
          // Fallback: Create basic routes using direct distance calculation
          logger.warn(
            'No routes from Google Maps, creating fallback routes based on direct distance'
          );

          const directDistance = this.calculateDistance(
            originCoords.lat,
            originCoords.lng,
            destCoords.lat,
            destCoords.lng
          );

          const estimatedDuration = Math.round(directDistance * 1.5); // Rough estimate: ~40 km/h average

          // Create fallback routes
          allRoutes.push(
            {
              route_id: 'FALLBACK_BUS',
              origin_city_id: originCity?.city_id || 'geocoded',
              destination_city_id: destCity?.city_id || 'geocoded',
              transport_type: 'bus',
              distance_km: directDistance,
              estimated_time_min: estimatedDuration,
              base_fare_lkr: Math.round(directDistance * 50),
              has_transfer: directDistance > 100,
              scenic_score: 0.6,
              comfort_score: 0.7,
              operator_name: 'Public Transport',
            },
            {
              route_id: 'FALLBACK_CAR',
              origin_city_id: originCity?.city_id || 'geocoded',
              destination_city_id: destCity?.city_id || 'geocoded',
              transport_type: 'car',
              distance_km: directDistance,
              estimated_time_min: Math.round(estimatedDuration * 0.8), // Cars slightly faster
              base_fare_lkr: Math.round(directDistance * 150),
              has_transfer: false,
              scenic_score: 0.7,
              comfort_score: 0.9,
              operator_name: 'Private Car/Taxi',
            }
          );

          logger.info(
            `Created ${allRoutes.length} fallback routes (${directDistance.toFixed(1)} km)`
          );
        }

        if (allRoutes.length === 0) {
          return {
            conversation_id: String(conversation._id),
            message: `I couldn't find any routes between ${origin} and ${destination}. This might be due to Google Maps API limitations. Please try different locations or check back later.`,
            message_type: 'text',
          };
        }

        logger.info(`Found ${allRoutes.length} routes from Google Maps`);

        // Build route contexts with real-time data (parallel)
        const routeContexts = await this.routeContextBuilder.buildRouteContexts(
          allRoutes,
          originCoords,
          destCoords
        );

        // Filter out failed contexts
        const validContexts = routeContexts.filter((ctx) => ctx !== null) as any[];
        if (validContexts.length === 0) {
          return {
            conversation_id: String(conversation._id),
            message: 'Could not fetch real-time data for available routes. Please try again.',
            message_type: 'error',
          };
        }

        // Infer user preferences from message and rank routes
        const userWeights = this.rankingService.guessUserWeights(request.message);
        const rankedRoutes = await this.rankingService.rankRoutes(validContexts, userWeights);

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

        // Format detailed response with top 3 routes
        const detailedResponse = this.formatIntelligentRouteResponse(rankedRoutes, explanation);

        // Update conversation context
        await this.conversationService.updateContext(String(conversation._id), {
          current_location: {
            city_id: originCity?.city_id,
            city_name: origin,
            coordinates: [originCoords.lng, originCoords.lat],
          },
          destination: {
            city_id: destCity?.city_id,
            city_name: destination,
            coordinates: [destCoords.lng, destCoords.lat],
          },
        });

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
              ranked_routes: rankedRoutes.slice(0, 3),
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
  private formatIntelligentRouteResponse(rankedRoutes: any[], explanation: string): string {
    let response = `${explanation}\n\n`;

    // Show top 3 routes with detailed metrics
    if (rankedRoutes.length > 0) {
      response += '**Detailed Route Options:**\n\n';

      rankedRoutes.slice(0, 3).forEach((route, index) => {
        const medalEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
        response += `${medalEmoji} **Option ${index + 1}: ${route.transport_type.toUpperCase()}**\n`;
        response += `   Score: ${(route.score * 100).toFixed(0)}/100\n`;
        response += `   ⏱ Duration: ${route.dynamic.duration_min} min\n`;
        response += `   📏 Distance: ${route.dynamic.distance_km.toFixed(1)} km\n`;
        response += `   💰 Fare: LKR ${route.static.base_fare_lkr.toFixed(0)}\n`;

        // Show key metrics
        const metrics = [];
        if (route.dynamic.weather_risk < 0.3) metrics.push('✅ Good weather');
        if (route.dynamic.congestion === 'low') metrics.push('🟢 Low traffic');
        if (route.static.scenic_score > 0.7) metrics.push('🌄 Scenic route');
        if (route.static.comfort_score > 0.7) metrics.push('🪑 Comfortable');

        if (metrics.length > 0) {
          response += `   ${metrics.join(' • ')}\n`;
        }

        // Show turn-by-turn navigation for the top route only
        if (
          index === 0 &&
          route.static.navigation_steps &&
          route.static.navigation_steps.length > 0
        ) {
          response += '\n   **🗺️ Turn-by-Turn Directions:**\n';
          const stepsToShow = route.static.navigation_steps.slice(0, 8); // Show first 8 steps
          stepsToShow.forEach((step: any, stepIdx: number) => {
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
