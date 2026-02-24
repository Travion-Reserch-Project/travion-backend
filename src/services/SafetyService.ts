import axios from 'axios';
import config from '../config/config';
import { SafetyRepository } from '../repositories/SafetyRepository';
import { IncidentReportRepository } from '../repositories/IncidentReportRepository';
import { GoogleMapsService, LocationFeatures } from './GoogleMapsService';
import { ISafetyAlert } from '../models/SafetyAlert';
import { IIncidentReport } from '../models/IncidentReport';
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
    | 'Extortion'
    | 'Other';
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
  private readonly incidentReportRepository: IncidentReportRepository;
  private readonly googleMapsService: GoogleMapsService;
  private readonly mlApiUrl: string;

  constructor() {
    this.safetyRepository = new SafetyRepository();
    this.incidentReportRepository = new IncidentReportRepository();
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
      console.log(`[Safety] Calling ML service at: ${this.mlApiUrl}/predict`);

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
        console.warn('[Safety] Invalid ML response, using fallback predictions');
        return this.getFallbackPredictions();
      }

      // Transform ML model output
      const transformed = this.transformMLPredictions(response.data.prediction);
      console.log('[Safety] Transformed predictions:', transformed);
      return transformed;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          console.error('[Safety] ML service not running at', this.mlApiUrl);
          console.warn('[Safety] Using fallback predictions - ML service unavailable');
          return this.getFallbackPredictions();
        }
        if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
          console.error('[Safety] ML service timeout');
          console.warn('[Safety] Using fallback predictions - ML service timeout');
          return this.getFallbackPredictions();
        }
        console.error('[Safety] ML API error:', error.response?.data || error.message);
        console.warn('[Safety] Using fallback predictions due to error');
        return this.getFallbackPredictions();
      }
      console.error('[Safety] Unexpected error calling ML service:', error);
      return this.getFallbackPredictions();
    }
  }

  /**
   * Get fallback predictions when ML service is unavailable
   * Returns moderate-low risk for all incident types
   */
  private getFallbackPredictions(): RiskPrediction[] {
    console.log('[Safety] Generating fallback predictions (ML service unavailable)');
    return [
      { incidentType: 'Scam', riskLevel: 'low', confidence: 0.3 },
      { incidentType: 'Pickpocket', riskLevel: 'low', confidence: 0.3 },
      { incidentType: 'Theft', riskLevel: 'low', confidence: 0.3 },
      { incidentType: 'Money Theft', riskLevel: 'low', confidence: 0.3 },
      { incidentType: 'Harassment', riskLevel: 'low', confidence: 0.3 },
      { incidentType: 'Bag Snatching', riskLevel: 'low', confidence: 0.3 },
      { incidentType: 'Extortion', riskLevel: 'low', confidence: 0.3 },
    ];
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

  /**
   * Get nearby user-reported incidents and transform them to alert format
   * These are real incidents reported by other users in the area
   */
  async getUserReportedIncidents(
    latitude: number,
    longitude: number,
    radiusInKm = 5,
    limit = 20
  ): Promise<SafetyAlert[]> {
    try {
      console.log(`[Safety] Fetching user-reported incidents near: ${latitude}, ${longitude}`);

      // Fetch verified/pending incidents from database (exclude rejected)
      const incidents = await this.incidentReportRepository.findRecentByLocation(
        latitude,
        longitude,
        radiusInKm,
        limit
      );

      console.log(`[Safety] Found ${incidents.length} user-reported incidents`);

      // Transform incidents to alert format
      const alerts = incidents.map((incident, index) =>
        this.transformIncidentToAlert(incident, index)
      );

      return alerts;
    } catch (error) {
      console.error('[Safety] Error fetching user-reported incidents:', error);
      return [];
    }
  }

  /**
   * Transform incident report to safety alert format
   */
  private transformIncidentToAlert(incident: IIncidentReport, index: number): SafetyAlert {
    const riskLevel = this.calculateIncidentRiskLevel(incident.incidentTime);
    const protectionAdvice = this.generateIncidentProtectionDescription(incident.incidentType);

    // Map incident type to standard format (handle variations)
    const standardIncidentType = this.mapIncidentType(incident.incidentType);

    // Calculate time ago
    const timeAgo = this.getTimeAgo(incident.incidentTime);

    return {
      id: `incident-${incident._id || index}`,
      title: `Reported ${timeAgo}`, // Simple title - UI will prepend incident type and severity
      description: protectionAdvice,
      level: riskLevel,
      location: incident.location.address,
      incidentType: standardIncidentType,
    };
  }

  /**
   * Calculate risk level based on how recent the incident is
   */
  private calculateIncidentRiskLevel(incidentTime: Date): 'low' | 'medium' | 'high' {
    const now = new Date();
    const hoursAgo = (now.getTime() - new Date(incidentTime).getTime()) / (1000 * 60 * 60);

    if (hoursAgo <= 24) {
      // Last 24 hours - HIGH risk
      return 'high';
    } else if (hoursAgo <= 168) {
      // Last 7 days - MEDIUM risk
      return 'medium';
    } else {
      // Older than 7 days - LOW risk
      return 'low';
    }
  }

  /**
   * Generate protection advice for each incident type
   */
  private generateIncidentProtectionDescription(incidentType: string): string {
    const protectionAdvice: Record<string, string> = {
      Pickpocketing:
        'An incident was reported here. Keep valuables in front pockets and stay alert in crowds. Hold bags firmly.',
      'Bag Snatching':
        'Bag snatching reported in this area. Keep bags close to your body and avoid displaying valuables.',
      Scam: 'Scam activity reported. Verify credentials before any transactions. Avoid deals that seem too good to be true.',
      'Money Theft':
        'Money theft reported nearby. Avoid carrying large amounts of cash. Use secure payment methods when possible.',
      Harassment:
        'Harassment incident reported. Stay in well-lit areas and with groups when possible. Contact authorities if needed.',
      Extortion:
        'Extortion reported in this area. Report any suspicious demands to authorities immediately. Stay in public areas.',
      Theft:
        'Theft reported nearby. Secure valuable items and avoid leaving belongings unattended. Stay vigilant.',
      Other:
        'An incident was reported in this area. Stay alert and follow general safety precautions.',
    };

    return protectionAdvice[incidentType] || 'Stay alert and be cautious in this area.';
  }

  /**
   * Map incident type to standard format
   */
  private mapIncidentType(
    type: string
  ):
    | 'Scam'
    | 'Pickpocket'
    | 'Theft'
    | 'Money Theft'
    | 'Harassment'
    | 'Bag Snatching'
    | 'Extortion'
    | 'Other' {
    // Map Pickpocketing -> Pickpocket
    if (type === 'Pickpocketing') return 'Pickpocket';

    // Return as is if it matches our standard types
    const validTypes = [
      'Scam',
      'Pickpocket',
      'Theft',
      'Money Theft',
      'Harassment',
      'Bag Snatching',
      'Extortion',
      'Other',
    ];
    if (validTypes.includes(type)) {
      return type as any;
    }

    // Default to Other for unknown types
    return 'Other';
  }

  /**
   * Calculate human-readable time ago
   */
  private getTimeAgo(date: Date): string {
    const now = new Date();
    const secondsAgo = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);

    if (secondsAgo < 60) return 'just now';
    if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)} min ago`;
    if (secondsAgo < 86400) return `${Math.floor(secondsAgo / 3600)} hours ago`;
    if (secondsAgo < 604800) return `${Math.floor(secondsAgo / 86400)} days ago`;
    return `${Math.floor(secondsAgo / 604800)} weeks ago`;
  }

  /**
   * Run comprehensive network diagnostics
   * Tests: MongoDB, Google Maps API, ML Service
   */
  async runDiagnostics(): Promise<any> {
    const results = {
      mongodb: { status: 'unknown', message: '' },
      googleMaps: { status: 'unknown', message: '', apiKey: '' },
      mlService: { status: 'unknown', message: '', url: this.mlApiUrl },
      timestamp: new Date().toISOString(),
    };

    // Test 1: MongoDB (check if already connected)
    try {
      const mongoose = require('mongoose');
      if (mongoose.connection.readyState === 1) {
        results.mongodb.status = 'connected';
        results.mongodb.message = 'MongoDB is connected';
      } else {
        results.mongodb.status = 'disconnected';
        results.mongodb.message = 'MongoDB is not connected';
      }
    } catch (error) {
      results.mongodb.status = 'error';
      results.mongodb.message = (error as Error).message;
    }

    // Test 2: Google Maps API (simple geocode test)
    try {
      const testLat = 6.9271; // Colombo, Sri Lanka
      const testLon = 79.8612;
      results.googleMaps.apiKey = `${config.googleMaps.apiKey.substring(0, 10)}...`;

      const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
          latlng: `${testLat},${testLon}`,
          key: config.googleMaps.apiKey,
        },
        timeout: 8000,
      });

      if (response.data.status === 'OK') {
        results.googleMaps.status = 'working';
        results.googleMaps.message = 'Google Maps API is accessible and working';
      } else if (response.data.status === 'REQUEST_DENIED') {
        results.googleMaps.status = 'error';
        results.googleMaps.message = 'API key invalid or API not enabled';
      } else if (response.data.status === 'OVER_QUERY_LIMIT') {
        results.googleMaps.status = 'error';
        results.googleMaps.message = 'API quota exceeded';
      } else {
        results.googleMaps.status = 'error';
        results.googleMaps.message = `API returned status: ${response.data.status}`;
      }
    } catch (error: any) {
      results.googleMaps.status = 'error';
      if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
        results.googleMaps.message =
          'Network error: Cannot reach Google Maps API (DNS resolution failed)';
      } else if (error.code === 'ETIMEDOUT') {
        results.googleMaps.message = 'Request timeout - network may be slow or blocking API';
      } else {
        results.googleMaps.message = error.message || 'Unknown error';
      }
    }

    // Test 3: ML Service
    try {
      const response = await axios.get(`${this.mlApiUrl}/health`, {
        timeout: 5000,
      });

      if (response.status === 200) {
        results.mlService.status = 'working';
        results.mlService.message = 'ML Safety service is running';
      } else {
        results.mlService.status = 'error';
        results.mlService.message = `Service returned status: ${response.status}`;
      }
    } catch (error: any) {
      results.mlService.status = 'error';
      if (error.code === 'ECONNREFUSED') {
        results.mlService.message = 'ML service not running (connection refused)';
      } else if (error.code === 'ETIMEDOUT') {
        results.mlService.message = 'ML service timeout';
      } else {
        results.mlService.message = error.message || 'Unknown error';
      }
    }

    return results;
  }
}
