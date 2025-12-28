/**
 * AI Engine Service
 * Service layer for communicating with the Python ML/AI Engine (FastAPI backend)
 * Provides methods for all AI Engine API endpoints
 */

import { httpClient } from '../utils/httpClient';
import { aiEngineConfig } from '../config/aiEngine';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../config/logger';
import {
  // Chat
  ChatRequest,
  ChatResponse,
  // Recommendations
  RecommendationRequest,
  RecommendationResponse,
  ExplainResponse,
  NearbyLocationsRequest,
  NearbyLocationsResponse,
  // CrowdCast
  CrowdPredictionRequest,
  CrowdPredictionResponse,
  // Event Sentinel
  EventImpactRequest,
  EventImpactResponse,
  // Golden Hour / Physics
  GoldenHourRequest,
  GoldenHourResponse,
  SunPositionRequest,
  SunPositionResponse,
  // Health
  HealthResponse,
  GraphResponse,
  // Common types
  UserPreferenceScores,
} from '../types/aiEngine';

export class AIEngineService {
  /**
   * Handle errors from AI Engine API calls
   */
  private handleError(error: unknown, operation: string): never {
    logger.error(`AI Engine ${operation} error:`, error);

    if (error && typeof error === 'object') {
      const axiosError = error as {
        response?: { data?: { detail?: string }; status?: number };
        code?: string;
        message?: string;
      };

      if (axiosError.response) {
        throw new AppError(
          axiosError.response.data?.detail || `AI Engine ${operation} failed`,
          axiosError.response.status || 500
        );
      }

      if (axiosError.code === 'ECONNREFUSED') {
        throw new AppError('AI Engine service is unavailable', 503);
      }

      if (axiosError.code === 'ETIMEDOUT' || axiosError.code === 'ECONNABORTED') {
        throw new AppError('AI Engine request timed out', 504);
      }

      throw new AppError(
        axiosError.message || `AI Engine ${operation} failed`,
        500
      );
    }

    throw new AppError(`AI Engine ${operation} failed`, 500);
  }

  // ============================================================================
  // CHAT API
  // ============================================================================

  /**
   * Send a message to the agentic chat system
   * POST /api/v1/chat
   */
  async chat(
    message: string,
    threadId?: string,
    context?: {
      currentLocation?: { latitude: number; longitude: number };
      preferences?: UserPreferenceScores;
    }
  ): Promise<ChatResponse> {
    try {
      const request: ChatRequest = {
        message,
        thread_id: threadId,
        context,
      };

      return await httpClient.post<ChatResponse>(
        aiEngineConfig.endpoints.chat,
        request
      );
    } catch (error) {
      this.handleError(error, 'chat');
    }
  }

  // ============================================================================
  // RECOMMENDATION API
  // ============================================================================

  /**
   * Get personalized location recommendations
   * POST /api/v1/recommend
   */
  async getRecommendations(
    request: RecommendationRequest
  ): Promise<RecommendationResponse> {
    try {
      return await httpClient.post<RecommendationResponse>(
        aiEngineConfig.endpoints.recommend,
        request
      );
    } catch (error) {
      this.handleError(error, 'recommendations');
    }
  }

  /**
   * Get explanation/reasoning for a location recommendation
   * GET /api/v1/explain/{location_name}
   */
  async getExplanation(
    locationName: string,
    userLat?: number,
    userLng?: number
  ): Promise<ExplainResponse> {
    try {
      const encodedLocation = encodeURIComponent(locationName);
      const params: Record<string, string> = {};

      if (userLat !== undefined) params.user_lat = userLat.toString();
      if (userLng !== undefined) params.user_lng = userLng.toString();

      return await httpClient.get<ExplainResponse>(
        `${aiEngineConfig.endpoints.explain}/${encodedLocation}`,
        { params }
      );
    } catch (error) {
      this.handleError(error, 'explanation');
    }
  }

  /**
   * Get nearby locations
   * GET /api/v1/locations/nearby
   */
  async getNearbyLocations(
    request: NearbyLocationsRequest
  ): Promise<NearbyLocationsResponse> {
    try {
      return await httpClient.get<NearbyLocationsResponse>(
        aiEngineConfig.endpoints.nearbyLocations,
        { params: request }
      );
    } catch (error) {
      this.handleError(error, 'nearby locations');
    }
  }

  // ============================================================================
  // CROWDCAST API
  // ============================================================================

  /**
   * Get crowd prediction for a location
   * POST /api/v1/crowd
   */
  async getCrowdPrediction(
    request: CrowdPredictionRequest
  ): Promise<CrowdPredictionResponse> {
    try {
      return await httpClient.post<CrowdPredictionResponse>(
        aiEngineConfig.endpoints.crowd,
        request
      );
    } catch (error) {
      this.handleError(error, 'crowd prediction');
    }
  }

  // ============================================================================
  // EVENT SENTINEL API
  // ============================================================================

  /**
   * Get event/holiday impact analysis
   * POST /api/v1/events/impact
   */
  async getEventImpact(
    request: EventImpactRequest
  ): Promise<EventImpactResponse> {
    try {
      return await httpClient.post<EventImpactResponse>(
        aiEngineConfig.endpoints.eventImpact,
        request
      );
    } catch (error) {
      this.handleError(error, 'event impact');
    }
  }

  /**
   * Check if a date is a Poya day or holiday
   * Convenience method using event impact
   */
  async checkHoliday(
    locationName: string,
    targetDate: string
  ): Promise<{
    isPoya: boolean;
    isHoliday: boolean;
    isNewYearShutdown: boolean;
    crowdModifier: number;
    warnings: string[];
  }> {
    try {
      const impact = await this.getEventImpact({
        location_name: locationName,
        target_date: targetDate,
      });

      return {
        isPoya: impact.is_poya_day,
        isHoliday: impact.temporal_context?.categories.includes('Public') || false,
        isNewYearShutdown: impact.is_new_year_shutdown,
        crowdModifier: impact.predicted_crowd_modifier,
        warnings: impact.travel_advice_strings,
      };
    } catch (error) {
      this.handleError(error, 'holiday check');
    }
  }

  // ============================================================================
  // GOLDEN HOUR / PHYSICS API
  // ============================================================================

  /**
   * Get golden hour calculation by coordinates
   * POST /api/v1/physics/golden-hour
   */
  async getGoldenHour(request: GoldenHourRequest): Promise<GoldenHourResponse> {
    try {
      return await httpClient.post<GoldenHourResponse>(
        aiEngineConfig.endpoints.physicsGoldenHour,
        request
      );
    } catch (error) {
      this.handleError(error, 'golden hour');
    }
  }

  /**
   * Get golden hour calculation by location name
   * GET /api/v1/physics/golden-hour/{location_name}
   */
  async getGoldenHourByLocation(
    locationName: string,
    date?: string,
    includeCurrentPosition?: boolean
  ): Promise<GoldenHourResponse> {
    try {
      const encodedLocation = encodeURIComponent(locationName);
      const params: Record<string, string | boolean> = {};

      if (date) params.date = date;
      if (includeCurrentPosition !== undefined) {
        params.include_current_position = includeCurrentPosition;
      }

      return await httpClient.get<GoldenHourResponse>(
        `${aiEngineConfig.endpoints.physicsGoldenHour}/${encodedLocation}`,
        { params }
      );
    } catch (error) {
      this.handleError(error, 'golden hour by location');
    }
  }

  /**
   * Get current sun position
   * GET /api/v1/physics/sun-position
   */
  async getSunPosition(request: SunPositionRequest): Promise<SunPositionResponse> {
    try {
      return await httpClient.get<SunPositionResponse>(
        aiEngineConfig.endpoints.sunPosition,
        { params: request }
      );
    } catch (error) {
      this.handleError(error, 'sun position');
    }
  }

  /**
   * Get current light quality for a location
   * Convenience method using sun position
   */
  async getCurrentLightQuality(
    latitude: number,
    longitude: number
  ): Promise<{
    quality: string;
    isDaylight: boolean;
    elevation: number;
    azimuth: number;
  }> {
    try {
      const position = await this.getSunPosition({ latitude, longitude });

      return {
        quality: position.light_quality,
        isDaylight: position.is_daylight,
        elevation: position.elevation_deg,
        azimuth: position.azimuth_deg,
      };
    } catch (error) {
      this.handleError(error, 'light quality');
    }
  }

  // ============================================================================
  // HEALTH CHECK API
  // ============================================================================

  /**
   * Check AI Engine health status
   * GET /api/v1/health
   */
  async checkHealth(): Promise<HealthResponse> {
    try {
      return await httpClient.get<HealthResponse>(aiEngineConfig.endpoints.health);
    } catch (error) {
      this.handleError(error, 'health check');
    }
  }

  /**
   * Get AI Engine graph visualization
   * GET /api/v1/graph
   */
  async getGraph(): Promise<GraphResponse> {
    try {
      return await httpClient.get<GraphResponse>(aiEngineConfig.endpoints.graph);
    } catch (error) {
      this.handleError(error, 'graph');
    }
  }

  /**
   * Check if AI Engine is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const health = await this.checkHealth();
      return health.status === 'healthy';
    } catch {
      return false;
    }
  }

  // ============================================================================
  // CONVENIENCE METHODS
  // ============================================================================

  /**
   * Get comprehensive location info combining multiple APIs
   * Returns recommendation + event impact + golden hour data
   */
  async getLocationInfo(
    locationName: string,
    targetDate?: string,
    userLocation?: { latitude: number; longitude: number }
  ): Promise<{
    explanation: ExplainResponse;
    eventImpact?: EventImpactResponse;
    goldenHour?: GoldenHourResponse;
  }> {
    try {
      // Get explanation (always)
      const explanation = await this.getExplanation(
        locationName,
        userLocation?.latitude,
        userLocation?.longitude
      );

      // Get event impact if date provided
      let eventImpact: EventImpactResponse | undefined;
      if (targetDate) {
        try {
          eventImpact = await this.getEventImpact({
            location_name: locationName,
            target_date: targetDate,
          });
        } catch (e) {
          logger.warn('Failed to get event impact:', e);
        }
      }

      // Get golden hour if date provided
      let goldenHour: GoldenHourResponse | undefined;
      if (targetDate) {
        try {
          goldenHour = await this.getGoldenHourByLocation(locationName, targetDate);
        } catch (e) {
          logger.warn('Failed to get golden hour:', e);
        }
      }

      return { explanation, eventImpact, goldenHour };
    } catch (error) {
      this.handleError(error, 'location info');
    }
  }

  /**
   * Get optimal visit time for a location
   * Combines crowd prediction and golden hour
   */
  async getOptimalVisitTime(
    locationName: string,
    _locationType: string,
    targetDate: string
  ): Promise<{
    recommendedTime: string;
    goldenHourMorning?: { start: string; end: string };
    goldenHourEvening?: { start: string; end: string };
    crowdStatus: string;
    warnings: string[];
  }> {
    try {
      // Get golden hour
      const goldenHour = await this.getGoldenHourByLocation(locationName, targetDate);

      // Get event impact for crowd info
      const eventImpact = await this.getEventImpact({
        location_name: locationName,
        target_date: targetDate,
      });

      // Determine recommended time
      let recommendedTime = goldenHour.morning_golden_hour.start_local;
      if (eventImpact.predicted_crowd_modifier > 2) {
        recommendedTime = `Before ${goldenHour.morning_golden_hour.start_local} (arrive early due to high crowds)`;
      }

      return {
        recommendedTime,
        goldenHourMorning: {
          start: goldenHour.morning_golden_hour.start_local,
          end: goldenHour.morning_golden_hour.end_local,
        },
        goldenHourEvening: {
          start: goldenHour.evening_golden_hour.start_local,
          end: goldenHour.evening_golden_hour.end_local,
        },
        crowdStatus: eventImpact.predicted_crowd_modifier > 2 ? 'HIGH' :
                     eventImpact.predicted_crowd_modifier > 1.5 ? 'MODERATE' : 'LOW',
        warnings: eventImpact.travel_advice_strings,
      };
    } catch (error) {
      this.handleError(error, 'optimal visit time');
    }
  }
}
