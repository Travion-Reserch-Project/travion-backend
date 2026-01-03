import axios from 'axios';
import config from '../config/config';
import { SafetyRepository } from '../repositories/SafetyRepository';
import { GoogleMapsService, LocationFeatures } from './GoogleMapsService';
import { ISafetyAlert } from '../models/SafetyAlert';
import mongoose from 'mongoose';

// ML Model Input Interface (11 features - matches ML model schema)
export interface MLModelInput {
  lat: number;
  lon: number;
  area_cluster: number;
  is_beach: number;
  is_crowded: number;
  is_tourist_place: number;
  is_transit: number;
  hour: number;
  day_of_week: number;
  is_weekend: number;
  police_nearby: number;
}

// Risk Prediction Interface
export interface RiskPrediction {
  incidentType: string;
  riskLevel: 'low' | 'medium' | 'high';
  confidence: number;
}

// Safety Alert Interface for Frontend
export interface SafetyAlert {
  id: string;
  title: string;
  description: string;
  level: 'low' | 'medium' | 'high';
  location: string;
  incidentType:
    | 'Scam'
    | 'Pickpocket'
    | 'Theft'
    | 'Money Theft'
    | 'Harassment'
    | 'Bag Snatching'
    | 'Extortion';
}

// Main Response Interface
export interface SafetyPredictionResponse {
  success: boolean;
  location: {
    latitude: number;
    longitude: number;
    address: string;
    locationName: string;
  };
  features: LocationFeatures;
  predictions: RiskPrediction[];
  alerts: SafetyAlert[];
  timestamp: string;
  error?: string;
}

export class SafetyService {
  private readonly safetyRepository: SafetyRepository;
  private readonly googleMapsService: GoogleMapsService;
  private readonly mlApiUrl: string;

  constructor() {
    this.safetyRepository = new SafetyRepository();
    this.googleMapsService = new GoogleMapsService();
    this.mlApiUrl = config.mlServices.safetyApiUrl;
  }

  /**
   * MAIN METHOD: Get safety predictions for a location
   * Complete Flow: lat/lon → Google Maps API (extract features) → ML Model (predict risks) → Frontend
   * userId is optional - if null, predictions won't be saved to database
   */
  async getSafetyPredictions(
    userId: string | null,
    latitude: number,
    longitude: number
  ): Promise<SafetyPredictionResponse> {
    try {
      console.log(`[Safety] Extracting features for: ${latitude}, ${longitude}`);

      const locationInfo = await this.googleMapsService.extractLocationFeatures(
        latitude,
        longitude
      );

      console.log('[Safety] Extracted features:', locationInfo.features);

      const mlInput: MLModelInput = {
        lat: latitude,
        lon: longitude,
        ...locationInfo.features,
      };

      // ✅ STEP 3A: Short-circuit rule (NO ML CALL)
      const { is_beach, is_crowded, is_tourist_place, is_transit, police_nearby } =
        locationInfo.features;

      const shouldSkipML =
        is_beach === 0 &&
        is_crowded === 0 &&
        is_tourist_place === 0 &&
        is_transit === 0 &&
        police_nearby === 0;

      let predictions: any;

      if (shouldSkipML) {
        console.log('[Safety] Skipping ML model – all context flags are 0');
        predictions = [
          { incidentType: 'Scam', riskLevel: 'low', confidence: 0.2 },
          { incidentType: 'Pickpocket', riskLevel: 'low', confidence: 0.2 },
          { incidentType: 'Theft', riskLevel: 'low', confidence: 0.2 },
          { incidentType: 'Money Theft', riskLevel: 'low', confidence: 0.2 },
          { incidentType: 'Harassment', riskLevel: 'low', confidence: 0.2 },
          { incidentType: 'Bag Snatching', riskLevel: 'low', confidence: 0.2 },
          { incidentType: 'Extortion', riskLevel: 'low', confidence: 0.2 },
        ];
      } else {
        console.log('[Safety] Calling ML model with input:', mlInput);
        predictions = await this.callMLModel(mlInput);
      }

      // Step 4: Convert predictions to frontend alerts
      const alerts = this.convertToAlerts(predictions, locationInfo.locationName);

      // Step 5: Save only if authenticated
      if (userId) {
        await this.safetyRepository.create({
          userId: new mongoose.Types.ObjectId(userId),
          location: {
            latitude,
            longitude,
            address: locationInfo.address,
            locationName: locationInfo.locationName,
          },
          features: locationInfo.features,
          predictions,
          timestamp: new Date(),
        } as any);

        console.log('[Safety] Predictions saved successfully');
      }

      return {
        success: true,
        location: {
          latitude,
          longitude,
          address: locationInfo.address,
          locationName: locationInfo.locationName,
        },
        features: locationInfo.features,
        predictions,
        alerts,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[Safety] Error:', error);
      throw new Error(`Failed to get safety predictions: ${(error as Error).message}`);
    }
  }

  /**
   * Call ML model API to get risk predictions
   */
  private async callMLModel(input: MLModelInput): Promise<RiskPrediction[]> {
    try {
      // ML service expects nested structure: { features: {...} }
      const requestBody = {
        features: input,
        user_location: null, // Optional field
      };

      const response = await axios.post(`${this.mlApiUrl}/predict`, requestBody, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000, // 15 second timeout
      });

      console.log('[Safety] ML model response:', JSON.stringify(response.data, null, 2));

      if (!response.data || !response.data.prediction) {
        throw new Error('Invalid response from ML model');
      }

      // Transform ML model output
      const transformed = this.transformMLPredictions(response.data.prediction);
      console.log('[Safety] Transformed predictions:', transformed);
      return transformed;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`ML model error: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Transform ML model predictions to our format
   * ML model returns 7 incident types with severity levels
   */
  private transformMLPredictions(mlPredictions: any): RiskPrediction[] {
    const incidentMap: { label: string; key: string }[] = [
      { label: 'Scam', key: 'risk_scam' },
      { label: 'Pickpocket', key: 'risk_pickpocket' },
      { label: 'Theft', key: 'risk_theft' },
      { label: 'Money Theft', key: 'risk_money_theft' },
      { label: 'Harassment', key: 'risk_harassment' },
      { label: 'Bag Snatching', key: 'risk_bag_snatching' },
      { label: 'Extortion', key: 'risk_extortion' },
    ];

    return incidentMap.map(({ label, key }) => {
      const riskValue = mlPredictions[key]; // "Low" | "Medium" | "High"

      const riskLevel = (riskValue || 'Low').toLowerCase() as 'low' | 'medium' | 'high';

      // simple confidence mapping (can be improved later)
      const confidence = riskLevel === 'high' ? 0.8 : riskLevel === 'medium' ? 0.5 : 0.2;

      return {
        incidentType: label,
        riskLevel,
        confidence: Number(confidence.toFixed(2)),
      };
    });
  }

  /**
   * Convert predictions to frontend alerts format
   */
  private convertToAlerts(predictions: RiskPrediction[], locationName: string): SafetyAlert[] {
    // Show ALL 7 incident types with their predicted risk levels
    const alerts = predictions.map((pred, index) => ({
      id: String(index + 1),
      title: `${pred.incidentType} Risk Level: ${pred.riskLevel.charAt(0).toUpperCase() + pred.riskLevel.slice(1)}`,
      description: this.generateDescription(pred.incidentType, pred.riskLevel),
      level: pred.riskLevel,
      location: locationName,
      incidentType: pred.incidentType as SafetyAlert['incidentType'],
    }));

    console.log('[Safety] Converted alerts:', alerts);
    return alerts;
  }

  /**
   * Generate alert descriptions
   */
  private generateDescription(incidentType: string, level: string): string {
    const descriptions: Record<string, Record<string, string>> = {
      Scam: {
        low: 'Low scam risk detected. Area is relatively safe.',
        medium: 'Moderate scam risk. Be cautious with strangers offering deals.',
        high: 'High scam risk detected. Avoid engaging with suspicious individuals.',
      },
      Pickpocket: {
        low: 'Low pickpocket risk. Area is relatively safe.',
        medium: 'Moderate pickpocket risk. Watch your belongings in crowded areas.',
        high: 'High pickpocket risk. Keep bags and wallets close and secured.',
      },
      Theft: {
        low: 'Low theft risk. Area is relatively safe.',
        medium:
          'Moderate theft risk. Secure valuable items and avoid leaving belongings unattended.',
        high: 'High theft risk detected. Keep valuables out of sight and stay alert.',
      },
      'Money Theft': {
        low: 'Low money theft risk. Area is relatively safe.',
        medium: 'Moderate money theft risk. Be careful with cash transactions.',
        high: 'High money theft risk. Avoid carrying large amounts of cash.',
      },
      Harassment: {
        low: 'Low harassment risk. Area is relatively safe.',
        medium: 'Moderate harassment risk. Stay in groups when possible.',
        high: 'High harassment risk. Avoid isolated areas and stay with companions.',
      },
      'Bag Snatching': {
        low: 'Low bag snatching risk. Area is relatively safe.',
        medium: 'Moderate bag snatching risk. Hold bags firmly and stay alert.',
        high: 'High bag snatching risk. Keep bags close to your body.',
      },
      Extortion: {
        low: 'Low extortion risk. Area is relatively safe.',
        medium: 'Moderate extortion risk. Avoid deals that seem too good to be true.',
        high: 'High extortion risk. Report suspicious demands to authorities.',
      },
    };

    return descriptions[incidentType]?.[level] || 'Be cautious in this area.';
  }

  /**
   * Get user's safety alert history
   */
  async getUserAlertHistory(userId: string, limit = 10, skip = 0): Promise<ISafetyAlert[]> {
    return await this.safetyRepository.findByUserId(userId, limit, skip);
  }

  /**
   * Get high risk alerts for a user
   */
  async getHighRiskAlerts(userId: string, limit = 5): Promise<ISafetyAlert[]> {
    return await this.safetyRepository.getHighRiskAlertsForUser(userId, limit);
  }

  /**
   * Get recent alerts near a location
   */
  async getNearbyAlerts(
    latitude: number,
    longitude: number,
    radiusInKm = 5,
    limit = 10
  ): Promise<ISafetyAlert[]> {
    return await this.safetyRepository.findRecentByLocation(latitude, longitude, radiusInKm, limit);
  }

  /**
   * Check ML service health
   */
  async checkHealth(): Promise<{ status: 'healthy' | 'unhealthy'; lastCheck: Date }> {
    try {
      await axios.get(`${this.mlApiUrl}/health`, { timeout: 5000 });
      return { status: 'healthy', lastCheck: new Date() };
    } catch (error) {
      return { status: 'unhealthy', lastCheck: new Date() };
    }
  }
}
