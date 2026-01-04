import { IChatSession } from '../models/ChatSession';
import { IChatQuery } from '../models/ChatQuery';
import { ChatRepository } from '../repositories/ChatRepository';
import { ChatPreferencesRepository } from '../repositories/ChatPreferencesRepository';
import { logger } from '../config/logger';
import { MLService, MLServiceRequest } from './MLService';
import { LLMService, TripExtraction } from './LLMService';
import { RecommendationService, RecommendationResponse } from './RecommendationService';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';

export interface ChatQueryRequest {
  query: string;
  userLocation?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  sessionId?: mongoose.Types.ObjectId | string;
  deviceInfo?: {
    platform: string;
    version?: string;
  };
}

export interface ChatQueryResponse {
  success: boolean;
  data: {
    queryId: string;
    sessionId: mongoose.Types.ObjectId;
    response: string;
    queryType: string;
    responseTime: number;
    mlServiceLatency: number;
  };
  error?: {
    message: string;
    code: string;
  };
}

export interface ChatFeedbackRequest {
  queryId: string;
  rating?: number; // 1-5
  feedback?: string;
  wasHelpful?: boolean;
}

export interface SessionFeedbackRequest {
  sessionId: mongoose.Types.ObjectId | string;
  satisfactionScore: number; // 1-5
}

export interface TravelRecommendationRequest {
  message: string;
  origin?: string;
  destination?: string;
  departureDate?: string;
  departureTime?: string;
  state?: TripExtraction;
  answeredField?: 'origin' | 'destination' | 'departureDate' | 'departureTime';
  pendingFields?: Array<'origin' | 'destination' | 'departureDate' | 'departureTime'>;
  currentField?: 'origin' | 'destination' | 'departureDate' | 'departureTime';
  sessionId?: mongoose.Types.ObjectId | string;
  deviceInfo?: { platform: string; version?: string };
}

export interface TravelRecommendationResponse {
  success: boolean;
  data?: {
    status: 'ready' | 'needs_clarification';
    extracted: TripExtraction;
    recommendation?: RecommendationResponse;
    missingFields?: string[];
    clarificationPrompt?: string;
    nextQuestion?: string;
    pendingFields?: string[];
    state?: TripExtraction;
    nextField?: 'origin' | 'destination' | 'departureDate' | 'departureTime';
    sessionId?: string;
  };
  error?: {
    message: string;
    code: string;
  };
}

export class ChatService {
  private mlService: MLService;
  private chatRepository: ChatRepository;
  private chatPreferencesRepository: ChatPreferencesRepository;
  private llmService?: LLMService;
  private recommendationService: RecommendationService;

  constructor() {
    this.mlService = new MLService();
    this.chatRepository = new ChatRepository();
    this.chatPreferencesRepository = new ChatPreferencesRepository();
    this.recommendationService = new RecommendationService();
  }

  // Process a chat query
  async processQuery(userId: string, request: ChatQueryRequest): Promise<ChatQueryResponse> {
    const startTime = Date.now();
    const queryId = uuidv4();

    try {
      const session = await this.getOrCreateSession(userId, request.sessionId, request.deviceInfo);

      // Get user preferences
      const userPreferences = await this.chatPreferencesRepository.findByUserId(userId);

      // Detect query type
      const queryType = this.mlService.detectQueryType(request.query);

      // Prepare ML service request
      const mlRequest: MLServiceRequest = {
        query: request.query,
        userLocation: request.userLocation,
        context: {
          userId,
          sessionId: session._id?.toString() || '',
          language: userPreferences?.language || 'en',
        },
      };

      // Send query to ML service
      const mlServiceStartTime = Date.now();
      const mlResult = await this.mlService.sendQuery(mlRequest);
      const mlServiceLatency = mlResult.latency;

      // Format response
      let formattedResponse: string;
      if (mlResult.response) {
        formattedResponse = this.mlService.formatResponse(mlResult.response, queryType);
      } else {
        formattedResponse = this.mlService['getFallbackResponse'](queryType);
      }

      const totalResponseTime = Date.now() - startTime;

      // Create chat query record
      await this.chatRepository.createQuery({
        queryId,
        sessionId: session._id as any,
        userId: new mongoose.Types.ObjectId(userId),
        queryText: request.query,
        queryType,
        userLocation: request.userLocation,
        mlServiceRequest: {
          endpoint: '/api/query',
          payload: mlRequest,
          timestamp: new Date(mlServiceStartTime),
        },
        mlServiceResponse: mlResult.response
          ? {
              data: mlResult.response,
              statusCode: 200,
              timestamp: new Date(mlServiceStartTime + mlServiceLatency),
            }
          : undefined,
        mlServiceLatency,
        mlServiceStatus: mlResult.status,
        formattedResponse,
        responseTime: totalResponseTime,
        errorDetails: mlResult.errorDetails,
        timestamp: new Date(startTime),
      });

      // Update session statistics
      await this.updateSessionStats(session._id as mongoose.Types.ObjectId, totalResponseTime);

      return {
        success: true,
        data: {
          queryId,
          sessionId: session._id as mongoose.Types.ObjectId,
          response: formattedResponse,
          queryType,
          responseTime: totalResponseTime,
          mlServiceLatency,
        },
      };
    } catch (error: any) {
      console.error('Error processing chat query:', error);

      // Log failed query
      try {
        await this.chatRepository.createQuery({
          queryId,
          sessionId: request.sessionId || 'unknown',
          userId,
          queryText: request.query,
          queryType: 'other',
          userLocation: request.userLocation,
          mlServiceLatency: 0,
          mlServiceStatus: 'error',
          formattedResponse:
            'I apologize, but I encountered an error processing your request. Please try again.',
          responseTime: Date.now() - startTime,
          errorDetails: {
            message: error.message,
            code: error.code || 'PROCESSING_ERROR',
            stack: error.stack,
          },
          timestamp: new Date(startTime),
        } as any);
      } catch (saveError) {
        console.error('Failed to save error query:', saveError);
      }

      return {
        success: false,
        data: {
          queryId,
          sessionId:
            (request.sessionId as mongoose.Types.ObjectId) || new mongoose.Types.ObjectId(),
          response:
            'I apologize, but I encountered an error processing your request. Please try again.',
          queryType: 'other',
          responseTime: Date.now() - startTime,
          mlServiceLatency: 0,
        },
        error: {
          message: 'Failed to process query',
          code: 'PROCESSING_ERROR',
        },
      };
    }
  }

  /**
   * Submit feedback for a specific query
   */
  async submitQueryFeedback(userId: string, request: ChatFeedbackRequest): Promise<void> {
    const query = await this.chatRepository.findQueryById(request.queryId);
    if (!query || String(query.userId) !== userId) {
      throw new Error('Query not found');
    }

    await this.chatRepository.updateQueryFeedback(request.queryId, {
      userRating: request.rating,
      userFeedback: request.feedback,
      wasHelpful: request.wasHelpful,
    });
  }

  /**
   * Submit feedback for a session
   */
  async submitSessionFeedback(userId: string, request: SessionFeedbackRequest): Promise<void> {
    const session = await this.chatRepository.findSessionById(String(request.sessionId));
    if (!session || String(session.userId) !== userId) {
      throw new Error('Session not found');
    }

    await this.chatRepository.updateSession(String(request.sessionId), {
      userSatisfactionScore: request.satisfactionScore,
    });
  }

  /**
   * Get chat history for a user
   */
  async getChatHistory(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    sessions: IChatSession[];
    queries: IChatQuery[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    // Get recent sessions
    const sessions = await this.chatRepository.findSessionsByUserId(userId, limit, skip);

    // Get queries for these sessions
    const sessionIds = sessions.map((s) => s._id);
    const queries: IChatQuery[] = [];
    for (const sessionId of sessionIds) {
      const sessionQueries = await this.chatRepository.findQueriesBySessionId(String(sessionId));
      queries.push(...sessionQueries);
    }

    const total = await this.chatRepository.countSessionsByUserId(userId);
    const totalPages = Math.ceil(total / limit);

    return {
      sessions,
      queries,
      total,
      page,
      totalPages,
    };
  }

  /**
   * End a chat session
   */
  async endSession(userId: string, sessionId: mongoose.Types.ObjectId | string): Promise<void> {
    const session = await this.chatRepository.findSessionById(String(sessionId));
    if (session && String(session.userId) === userId) {
      await this.chatRepository.endSession(String(sessionId));
    }
  }

  /**
   * Get analytics data
   */
  async getAnalytics(
    userId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalQueries: number;
    totalSessions: number;
    averageResponseTime: number;
    queryTypeDistribution: Record<string, number>;
    mlServicePerformance: {
      successRate: number;
      averageLatency: number;
      errorRate: number;
    };
    userSatisfaction: {
      averageRating: number;
      helpfulnessRate: number;
    };
  }> {
    const filter: any = {};
    if (userId) filter.userId = userId;
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = startDate;
      if (endDate) filter.timestamp.$lte = endDate;
    }

    // Aggregate query data
    const queryAggregation = await this.chatRepository.getQueryAnalytics(filter);

    // Query type distribution
    const queryTypeDistribution = await this.chatRepository.getQueryTypeDistribution(filter);

    // Session count
    const sessionFilter: any = {};
    if (userId) sessionFilter.userId = userId;
    if (startDate || endDate) {
      sessionFilter.startTime = {};
      if (startDate) sessionFilter.startTime.$gte = startDate;
      if (endDate) sessionFilter.startTime.$lte = endDate;
    }
    const sessionAnalytics = await this.chatRepository.getSessionAnalytics(sessionFilter);
    const totalSessions = sessionAnalytics[0]?.totalSessions || 0;

    const stats = queryAggregation[0] || {};
    const queryTypes = queryTypeDistribution.reduce(
      (acc, item) => {
        acc[item._id] = item.count;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalQueries: stats.totalQueries || 0,
      totalSessions,
      averageResponseTime: stats.averageResponseTime || 0,
      queryTypeDistribution: queryTypes,
      mlServicePerformance: {
        successRate: stats.totalQueries > 0 ? (stats.successCount / stats.totalQueries) * 100 : 0,
        averageLatency: stats.averageLatency || 0,
        errorRate:
          stats.totalQueries > 0
            ? ((stats.totalQueries - stats.successCount) / stats.totalQueries) * 100
            : 0,
      },
      userSatisfaction: {
        averageRating: stats.averageRating || 0,
        helpfulnessRate: stats.ratedCount > 0 ? (stats.helpfulCount / stats.ratedCount) * 100 : 0,
      },
    };
  }

  /**
   * Get or create a chat session
   */
  private async getOrCreateSession(
    userId: string,
    sessionId?: mongoose.Types.ObjectId | string,
    deviceInfo?: { platform: string; version?: string }
  ): Promise<IChatSession> {
    if (sessionId) {
      const existingSession = await this.chatRepository.findSessionById(String(sessionId));
      if (
        existingSession &&
        existingSession.sessionStatus === 'active' &&
        String(existingSession.userId) === userId
      ) {
        return existingSession;
      }
    }

    // Reuse the most recent active session for this user if available
    const activeSession = await this.chatRepository.findActiveSessionByUserId(userId);
    if (activeSession) {
      return activeSession;
    }

    // Create new session
    const session = await this.chatRepository.createSession({
      userId: new mongoose.Types.ObjectId(userId),
      startTime: new Date(),
      deviceInfo,
      totalQueries: 0,
      avgResponseTime: 0,
      sessionStatus: 'active',
    });

    return session;
  }

  /**
   * Update session statistics
   */
  private async updateSessionStats(
    sessionId: mongoose.Types.ObjectId,
    responseTime: number
  ): Promise<void> {
    const session = await this.chatRepository.findSessionById(String(sessionId));
    if (session) {
      const newTotalQueries = session.totalQueries + 1;
      const totalTime = session.avgResponseTime * session.totalQueries + responseTime;
      const newAvgResponseTime = totalTime / newTotalQueries;

      await this.chatRepository.updateSession(String(sessionId), {
        totalQueries: newTotalQueries,
        avgResponseTime: newAvgResponseTime,
      });
    }
  }

  async getTravelRecommendation(
    userId: string,
    request: TravelRecommendationRequest
  ): Promise<TravelRecommendationResponse> {
    try {
      if (!this.llmService) {
        this.llmService = new LLMService();
      }

      const session = await this.getOrCreateSession(userId, request.sessionId, request.deviceInfo);
      const sessionState = (session as any).travelState || {};

      const seed: TripExtraction = {
        ...sessionState,
        ...(request.state || {}),
        ...(request.origin ? { origin: request.origin } : {}),
        ...(request.destination ? { destination: request.destination } : {}),
        ...(request.departureDate ? { departureDate: request.departureDate } : {}),
        ...(request.departureTime ? { departureTime: request.departureTime } : {}),
      };

      let answeredField = request.answeredField;
      const pendingFromClient = request.pendingFields || [];
      const currentField = request.currentField;
      const lastAskedField = sessionState?.lastAskedField;

      // If client didn't specify answeredField, try to infer from context
      // Priority: currentField (client-provided) > lastAskedField (server-tracked) > first pending
      if (!answeredField && request.message.trim().length > 0) {
        if (currentField) {
          answeredField = currentField;
        } else if (lastAskedField) {
          answeredField = lastAskedField;
        } else if (pendingFromClient.length > 0) {
          answeredField = pendingFromClient[0];
        }
      }

      logger.info('getTravelRecommendation field inference', {
        userId,
        message: request.message,
        answeredField,
        lastAskedField,
        currentField,
        sessionState: { origin: sessionState?.origin, destination: sessionState?.destination },
      });

      // Apply the explicit answer up-front to avoid LLM ambiguity
      if (answeredField) {
        seed[answeredField] = request.message.trim();
      }

      const extraction = await this.llmService.extractTripDetails(
        request.message,
        seed,
        answeredField
      );

      // Merge while preserving already-known seed values; only fill blanks from extraction
      const merged: TripExtraction = { ...seed };
      (['origin', 'destination', 'departureDate', 'departureTime'] as const).forEach((field) => {
        const valueFromExtraction = (extraction.extracted as any)[field];
        if (!merged[field] && valueFromExtraction) {
          merged[field] = valueFromExtraction;
        }
      });

      // Ensure the explicitly answered field is kept exactly as the user provided
      if (answeredField) {
        merged[answeredField] = request.message.trim();
      }

      // Recompute missing fields after merge and answeredField assignment
      const missing = ['origin', 'destination', 'departureDate', 'departureTime'].filter(
        (field) => !(merged as any)[field]
      );

      if (missing.length > 0) {
        let nextQuestion: string;
        const nextField = missing[0] as typeof answeredField;
        try {
          nextQuestion = await this.llmService.generateFollowUpQuestion(merged, missing);
        } catch (err) {
          const firstMissing = missing[0];
          const fallbackByField: Record<string, string> = {
            origin: 'What city or station are you starting from?',
            destination: 'Where do you want to go?',
            departureDate: 'What date do you want to travel? (YYYY-MM-DD)',
            departureTime: 'What time do you want to travel? (HH:MM, 24h)',
          };
          nextQuestion = fallbackByField[firstMissing] || 'Could you share the missing details?';
        }

        const clarificationPrompt = `I need ${missing.join(
          ', '
        )}. Please provide them to continue.`;

        // Persist the field we're asking about so next request knows which field user is answering
        await this.chatRepository.updateSession(String(session._id), {
          travelState: {
            ...merged,
            pendingFields: missing,
            lastAskedField: nextField,
          },
        } as any);

        return {
          success: true,
          data: {
            status: 'needs_clarification',
            extracted: merged,
            missingFields: missing,
            clarificationPrompt,
            nextQuestion,
            pendingFields: missing,
            state: merged,
            nextField,
            sessionId: String(session._id),
          },
        };
      }

      // Persist state to session
      await this.chatRepository.updateSession(String(session._id), {
        travelState: {
          ...merged,
          pendingFields: [],
        },
      } as any);

      // Try to get recommendations, but don't fail if service is unavailable
      let recommendation: any = null;
      try {
        recommendation = await this.recommendationService.getRecommendations(merged);

        // Mark session as completed after successful recommendation (prepare for next trip)
        if (recommendation?.success) {
          await this.chatRepository.updateSession(String(session._id), {
            sessionStatus: 'completed',
            travelState: {
              origin: undefined,
              destination: undefined,
              departureDate: undefined,
              departureTime: undefined,
              pendingFields: ['origin', 'destination', 'departureDate', 'departureTime'],
              lastAskedField: undefined,
            },
          } as any);
          logger.info('Session marked as completed after recommendation', {
            sessionId: String(session._id),
          });
        }
      } catch (recError: any) {
        logger.warn('Recommendation service unavailable', {
          message: recError?.message,
          code: recError?.code,
        });
        // Continue without recommendations
      }

      return {
        success: true,
        data: {
          status: 'ready',
          extracted: merged,
          recommendation,
          state: merged,
          sessionId: String(session._id),
        },
      };
    } catch (error: any) {
      const message = error?.message || 'Failed to process travel recommendation';
      logger.error('getTravelRecommendation failed', { error: message, stack: error?.stack });
      return {
        success: false,
        error: {
          message,
          code: 'RECOMMENDATION_ERROR',
        },
      };
    }
  }
}
