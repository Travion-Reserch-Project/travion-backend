import { logger } from '../../../../shared/config/logger';
import { cacheService } from '../../../../shared/libraries/cache/CacheService';

export interface TrafficData {
  congestion_level: 'low' | 'medium' | 'high' | 'severe';
  accident_risk_score: number; // 0-1
  road_condition: string;
  estimated_delay_min: number;
}

/**
 * TrafficService provides traffic and congestion data
 * Currently implements simple rule-based model
 * Can be extended to use real-time APIs like TomTom or HERE
 */
export class TrafficService {
  constructor() {
    logger.info('TrafficService initialized');
  }

  /**
   * Get traffic conditions for a route
   * For now: simple rule-based model
   * Future: integrate with real-time traffic API
   */
  async getTrafficConditions(
    originLat: number,
    originLng: number,
    _destLat: number,
    _destLng: number,
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' = 'afternoon'
  ): Promise<TrafficData> {
    try {
      const cacheKey = `traffic:${originLat},${originLng}:${_destLat},${_destLng}:${timeOfDay}`;
      const cached = cacheService.get<TrafficData>(cacheKey);

      if (cached) {
        logger.debug(`Using cached traffic data for route`);
        return cached;
      }

      // Simple heuristic model
      const trafficData = this.calculateTrafficHeuristic(
        originLat,
        originLng,
        _destLat,
        _destLng,
        timeOfDay
      );

      // Cache for 5 minutes (traffic changes frequently)
      cacheService.set(cacheKey, trafficData, 5 * 60 * 1000);

      return trafficData;
    } catch (error) {
      logger.warn('Error getting traffic conditions:', error);
      // Return default safe values
      return {
        congestion_level: 'low',
        accident_risk_score: 0.2,
        road_condition: 'normal',
        estimated_delay_min: 0,
      };
    }
  }

  /**
   * Simple heuristic to estimate traffic based on time and location
   */
  private calculateTrafficHeuristic(
    originLat: number,
    originLng: number,
    _destLat: number,
    _destLng: number,
    timeOfDay: string
  ): TrafficData {
    // Sri Lanka major cities with high traffic during peak hours
    const majorCitiesCoords = [
      { lat: 6.9271, lng: 80.7789, name: 'Colombo', peak_hours: ['morning', 'evening'] },
      { lat: 6.8453, lng: 80.7744, name: 'Colombo South', peak_hours: ['morning', 'evening'] },
    ];

    let congestion_level: 'low' | 'medium' | 'high' | 'severe' = 'low';
    let accident_risk_score = 0.1;
    let estimated_delay_min = 0;

    // Check if route passes through major cities during peak hours
    const passesMajorCity = majorCitiesCoords.some((city) => {
      const distance = this.calculateDistance(originLat, originLng, city.lat, city.lng);
      return distance < 10 && city.peak_hours.includes(timeOfDay);
    });

    if (passesMajorCity) {
      if (timeOfDay === 'morning' || timeOfDay === 'evening') {
        congestion_level = 'high';
        accident_risk_score = 0.35;
        estimated_delay_min = 30;
      } else if (timeOfDay === 'afternoon') {
        congestion_level = 'medium';
        accident_risk_score = 0.2;
        estimated_delay_min = 15;
      }
    } else {
      // Non-peak areas
      if (timeOfDay === 'night') {
        congestion_level = 'low';
        accident_risk_score = 0.25; // Slightly higher accident risk at night
        estimated_delay_min = 0;
      } else {
        congestion_level = 'low';
        accident_risk_score = 0.1;
        estimated_delay_min = 0;
      }
    }

    return {
      congestion_level,
      accident_risk_score,
      road_condition: 'normal',
      estimated_delay_min,
    };
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

export const trafficService = new TrafficService();
