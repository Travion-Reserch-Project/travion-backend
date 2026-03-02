/**
 * AI Engine Service
 * Service layer for communicating with the Python ML/AI Engine (FastAPI backend)
 * Provides methods for all AI Engine API endpoints
 */

import { httpClient } from '../../../../shared/utils/httpClient';
import { aiEngineConfig } from '../../../../shared/config/aiEngine';
import { AppError } from '../../../../shared/middleware/errorHandler';
import { logger } from '../../../../shared/config/logger';
import type {
  // Chat
  ChatRequest,
  ChatResponse,
  // Tour Plan
  TourPlanGenerateRequest,
  TourPlanResponse,
  SelectedLocation,
  TourPlanUserPreferences,
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
  // Simple API types
  SimpleCrowdPredictionResponse,
  SimpleGoldenHourResponse,
  SimpleDescriptionResponse,
  SimpleRecommendationResponse,
  // Common types
  UserPreferenceScores,
} from '../types/aiEngine';

export class AIEngineService {
  /**
   * Handle errors from AI Engine API calls
   */
  private handleError(error: unknown, operation: string): never {
    // Extract safe error info to avoid circular reference issues
    const errorInfo = this.extractSafeErrorInfo(error);
    logger.error(`AI Engine ${operation} error:`, errorInfo);

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
        throw new AppError('AI Engine request timed out. The AI service may be overloaded.', 504);
      }

      throw new AppError(axiosError.message || `AI Engine ${operation} failed`, 500);
    }

    throw new AppError(`AI Engine ${operation} failed`, 500);
  }

  /**
   * Extract safe error info for logging (avoids circular references)
   */
  private extractSafeErrorInfo(error: unknown): Record<string, unknown> {
    if (!error || typeof error !== 'object') {
      return { message: String(error) };
    }

    const err = error as Record<string, unknown>;
    return {
      message: err.message,
      code: err.code,
      name: err.name,
      status: (err.response as Record<string, unknown>)?.status,
      statusText: (err.response as Record<string, unknown>)?.statusText,
      detail: ((err.response as Record<string, unknown>)?.data as Record<string, unknown>)?.detail,
    };
  }

  // ============================================================================
  // CHAT API
  // ============================================================================

  /**
   * Send a message to the agentic chat system
   */
  async chat(
    message: string,
    threadId?: string,
    context?: {
      currentLocation?: { latitude: number; longitude: number };
      preferences?: UserPreferenceScores;
    },
    userId?: string
  ): Promise<ChatResponse> {
    try {
      const request: ChatRequest = {
        message,
        thread_id: threadId,
        user_id: userId,
        context,
      };

      return await httpClient.postWithLongTimeout<ChatResponse>(
        aiEngineConfig.endpoints.chat,
        request,
        120000
      );
    } catch (error) {
      this.handleError(error, 'chat');
    }
  }

  // ============================================================================
  // TOUR PLAN GENERATION API
  // ============================================================================

  /**
   * Generate an optimized tour plan
   */
  async generateTourPlan(
    selectedLocations: SelectedLocation[],
    startDate: string,
    endDate: string,
    threadId?: string,
    preferences?: string[],
    message?: string,
    userId?: string,
    userPreferences?: TourPlanUserPreferences
  ): Promise<TourPlanResponse> {
    try {
      const request: TourPlanGenerateRequest = {
        selected_locations: selectedLocations,
        start_date: startDate,
        end_date: endDate,
        thread_id: threadId,
        user_id: userId,
        preferences,
        message,
        user_preferences: userPreferences,
      };

      logger.info(`Generating tour plan for ${selectedLocations.length} locations`);

      return await httpClient.postWithLongTimeout<TourPlanResponse>(
        `${aiEngineConfig.baseUrl}/api/v1/tour-plan/generate`,
        request,
        180000
      );
    } catch (error) {
      this.handleError(error, 'tour plan generation');
    }
  }

  /**
   * Refine an existing tour plan
   */
  async refineTourPlan(
    threadId: string,
    message: string,
    selectedLocations: SelectedLocation[],
    startDate: string,
    endDate: string,
    preferences?: string[],
    userId?: string,
    userPreferences?: TourPlanUserPreferences
  ): Promise<TourPlanResponse> {
    try {
      const request: TourPlanGenerateRequest = {
        selected_locations: selectedLocations,
        start_date: startDate,
        end_date: endDate,
        thread_id: threadId,
        user_id: userId,
        preferences,
        message,
        user_preferences: userPreferences,
      };

      logger.info(`Refining tour plan with thread ${threadId}`);

      return await httpClient.postWithLongTimeout<TourPlanResponse>(
        `${aiEngineConfig.baseUrl}/api/v1/tour-plan/refine`,
        request,
        180000
      );
    } catch (error) {
      this.handleError(error, 'tour plan refinement');
    }
  }

  // ============================================================================
  // RECOMMENDATION API
  // ============================================================================

  /**
   * Get personalized location recommendations
   */
  async getRecommendations(request: RecommendationRequest): Promise<RecommendationResponse> {
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
   */
  async getNearbyLocations(request: NearbyLocationsRequest): Promise<NearbyLocationsResponse> {
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
   */
  async getCrowdPrediction(request: CrowdPredictionRequest): Promise<CrowdPredictionResponse> {
    try {
      return await httpClient.post<CrowdPredictionResponse>(
        aiEngineConfig.endpoints.crowd,
        request
      );
    } catch (error) {
      this.handleError(error, 'crowd prediction');
    }
  }

  /**
   * Get simple crowd prediction by location name
   */
  async getSimpleCrowdPrediction(locationName: string): Promise<SimpleCrowdPredictionResponse> {
    try {
      return await httpClient.post<SimpleCrowdPredictionResponse>(
        aiEngineConfig.endpoints.simpleCrowd,
        { location_name: locationName }
      );
    } catch (error) {
      this.handleError(error, 'simple crowd prediction');
    }
  }

  // ============================================================================
  // EVENT SENTINEL API
  // ============================================================================

  /**
   * Get event/holiday impact analysis
   */
  async getEventImpact(request: EventImpactRequest): Promise<EventImpactResponse> {
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
   * Check if a date is a holiday
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
   */
  async getGoldenHour(request: GoldenHourRequest): Promise<GoldenHourResponse> {
    try {
      return await httpClient.post<GoldenHourResponse>(
        aiEngineConfig.endpoints.goldenHour,
        request
      );
    } catch (error) {
      this.handleError(error, 'golden hour');
    }
  }

  /**
   * Get golden hour calculation by location name
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
        `${aiEngineConfig.endpoints.goldenHour}/${encodedLocation}`,
        { params }
      );
    } catch (error) {
      this.handleError(error, 'golden hour by location');
    }
  }

  /**
   * Get current sun position
   */
  async getSunPosition(request: SunPositionRequest): Promise<SunPositionResponse> {
    try {
      return await httpClient.get<SunPositionResponse>(aiEngineConfig.endpoints.sunPosition, {
        params: request,
      });
    } catch (error) {
      this.handleError(error, 'sun position');
    }
  }

  /**
   * Get current light quality for a location
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
   * Get comprehensive location info
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
      const explanation = await this.getExplanation(
        locationName,
        userLocation?.latitude,
        userLocation?.longitude
      );

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
      const goldenHour = await this.getGoldenHourByLocation(locationName, targetDate);

      const eventImpact = await this.getEventImpact({
        location_name: locationName,
        target_date: targetDate,
      });

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
        crowdStatus:
          eventImpact.predicted_crowd_modifier > 2
            ? 'HIGH'
            : eventImpact.predicted_crowd_modifier > 1.5
              ? 'MODERATE'
              : 'LOW',
        warnings: eventImpact.travel_advice_strings,
      };
    } catch (error) {
      this.handleError(error, 'optimal visit time');
    }
  }

  // ============================================================================
  // SIMPLE API METHODS
  // ============================================================================

  /**
   * Get simple golden hour by location name
   */
  async getSimpleGoldenHour(locationName: string): Promise<SimpleGoldenHourResponse> {
    try {
      return await httpClient.post<SimpleGoldenHourResponse>(
        aiEngineConfig.endpoints.simpleGoldenHour,
        { location_name: locationName }
      );
    } catch (error) {
      this.handleError(error, 'simple golden hour');
    }
  }

  /**
   * Get simple location description with preference scores
   */
  async getSimpleDescription(
    locationName: string,
    preference: UserPreferenceScores
  ): Promise<SimpleDescriptionResponse> {
    try {
      return await httpClient.postWithLongTimeout<SimpleDescriptionResponse>(
        aiEngineConfig.endpoints.simpleDescription,
        { location_name: locationName, preference },
        60000
      );
    } catch (error) {
      this.handleError(error, 'simple description');
    }
  }

  /**
   * Get simple location recommendations
   */
  async getSimpleRecommendations(
    latitude: number,
    longitude: number,
    preferences: UserPreferenceScores,
    maxDistanceKm: number = 50,
    topK: number = 5
  ): Promise<SimpleRecommendationResponse> {
    try {
      return await httpClient.post<SimpleRecommendationResponse>(
        aiEngineConfig.endpoints.simpleRecommend,
        {
          latitude,
          longitude,
          preferences,
          max_distance_km: maxDistanceKm,
          top_k: topK,
        }
      );
    } catch (error) {
      this.handleError(error, 'simple recommendations');
    }
  }
}
