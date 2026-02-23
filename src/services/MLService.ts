import axios, { AxiosInstance } from 'axios';
import { logger } from '../config/logger';

export interface TransportPredictionRequest {
  origin: {
    latitude: number;
    longitude: number;
  };
  destination: {
    latitude: number;
    longitude: number;
  };
  distance_km: number;
  departure_time?: string;
  day_of_week?: number;
  weather_condition?: string;
}

export interface TransportPredictionResponse {
  predicted_mode: 'bus' | 'train' | 'mixed';
  confidence: number;
  explanation?: {
    factors: string[];
    reasoning: string;
  };
  alternatives?: Array<{
    mode: string;
    confidence: number;
  }>;
}

export class MLService {
  private client: AxiosInstance;
  private baseUrl: string;
  private isEnabled: boolean;

  constructor() {
    this.baseUrl = process.env.ML_SERVICE_URL || 'http://localhost:5000';
    this.isEnabled = process.env.ML_SERVICE_ENABLED === 'true';

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!this.isEnabled) {
      logger.warn('ML Service is disabled');
    }
  }

  /**
   * Predict best transport mode between two locations
   */
  async predictTransportMode(
    request: TransportPredictionRequest
  ): Promise<TransportPredictionResponse> {
    if (!this.isEnabled) {
      logger.warn('ML Service is disabled, returning default prediction');
      return this.getDefaultPrediction(request);
    }

    try {
      const response = await this.client.post('/api/predict/transport', request);

      return {
        predicted_mode: response.data.predicted_mode || 'mixed',
        confidence: response.data.confidence || 0.5,
        explanation: response.data.explanation,
        alternatives: response.data.alternatives,
      };
    } catch (error) {
      logger.error('Error calling ML service:', error);
      return this.getDefaultPrediction(request);
    }
  }

  /**
   * Get route recommendations from ML model
   */
  async getRouteRecommendations(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    preferences?: {
      budget?: 'low' | 'medium' | 'high';
      time_preference?: 'fastest' | 'cheapest' | 'balanced';
    }
  ): Promise<{
    recommended_routes: Array<{
      transport_type: string;
      score: number;
      estimated_time: number;
      estimated_cost: number;
    }>;
  }> {
    if (!this.isEnabled) {
      return { recommended_routes: [] };
    }

    try {
      const response = await this.client.post('/api/recommend/routes', {
        origin,
        destination,
        preferences,
      });

      return response.data;
    } catch (error) {
      logger.error('Error getting route recommendations:', error);
      return { recommended_routes: [] };
    }
  }

  /**
   * Get default prediction when ML service is unavailable
   */
  private getDefaultPrediction(request: TransportPredictionRequest): TransportPredictionResponse {
    // Simple heuristic-based prediction
    let predictedMode: 'bus' | 'train' | 'mixed' = 'mixed';
    let confidence = 0.5;
    const factors: string[] = [];

    // If distance is short (< 30km), prefer bus
    if (request.distance_km < 30) {
      predictedMode = 'bus';
      confidence = 0.6;
      factors.push('Short distance favors bus transport');
    }
    // If distance is long (> 100km), prefer train
    else if (request.distance_km > 100) {
      predictedMode = 'train';
      confidence = 0.65;
      factors.push('Long distance favors train transport');
    }
    // Medium distance, use mixed
    else {
      predictedMode = 'mixed';
      confidence = 0.55;
      factors.push('Medium distance - both options viable');
    }

    return {
      predicted_mode: predictedMode,
      confidence,
      explanation: {
        factors,
        reasoning: 'Based on distance heuristics (ML service unavailable)',
      },
    };
  }

  /**
   * Analyze travel patterns
   */
  async analyzeTravelPatterns(
    userId: string,
    limit: number = 10
  ): Promise<{
    common_routes: Array<{
      origin: string;
      destination: string;
      frequency: number;
    }>;
    preferred_transport: string;
    average_trip_distance: number;
  } | null> {
    if (!this.isEnabled) {
      return null;
    }

    try {
      const response = await this.client.get(`/api/analyze/patterns/${userId}`, {
        params: { limit },
      });

      return response.data;
    } catch (error) {
      logger.error('Error analyzing travel patterns:', error);
      return null;
    }
  }

  /**
   * Get traffic predictions
   */
  async getTrafficPrediction(
    route: {
      origin: { lat: number; lng: number };
      destination: { lat: number; lng: number };
    },
    departureTime: Date
  ): Promise<{
    predicted_duration: number;
    traffic_level: 'low' | 'medium' | 'high';
    confidence: number;
  } | null> {
    if (!this.isEnabled) {
      return null;
    }

    try {
      const response = await this.client.post('/api/predict/traffic', {
        route,
        departure_time: departureTime.toISOString(),
      });

      return response.data;
    } catch (error) {
      logger.error('Error getting traffic prediction:', error);
      return null;
    }
  }

  /**
   * Check if ML service is healthy
   */
  async healthCheck(): Promise<boolean> {
    if (!this.isEnabled) {
      return false;
    }

    try {
      const response = await this.client.get('/health', { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      logger.error('ML service health check failed:', error);
      return false;
    }
  }
}
