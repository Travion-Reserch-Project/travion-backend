import { logger } from '../../../../shared/config/logger';
import { WeatherService, WeatherData } from '../services/WeatherService';
import { TrafficService } from '../services/TrafficService';
import { HolidayService } from './HolidayService';

/**
 * ML Features matching the transport prediction model
 */
export interface MLFeatures {
  distance_km: number;
  weather: 'sunny' | 'rain' | 'storm';
  is_friday: 0 | 1;
  is_poya_day: 0 | 1;
  traffic_score: number; // 0-1
  area_type: 'urban' | 'village';
  is_peak_hours: 0 | 1;
  is_weekend: 0 | 1;
  is_long_weekend: 0 | 1;
  trip_hour: number; // 0-23
}

export interface FeatureExtractionContext {
  distance_km: number;
  origin: {
    lat: number;
    lng: number;
    isUrban?: boolean; // Derived from city population/classification
  };
  destination: {
    lat: number;
    lng: number;
  };
  departureTime?: Date; // Defaults to now
}

/**
 * MLFeatureExtractor extracts features from route context
 * for transport mode prediction
 */
export class MLFeatureExtractor {
  private weatherService: WeatherService;
  private trafficService: TrafficService;
  private holidayService: HolidayService;

  constructor(
    weatherService: WeatherService,
    trafficService: TrafficService,
    holidayService: HolidayService
  ) {
    this.weatherService = weatherService;
    this.trafficService = trafficService;
    this.holidayService = holidayService;
  }

  /**
   * Extract all ML features from route context
   */
  async extractFeatures(context: FeatureExtractionContext): Promise<MLFeatures> {
    const departureTime = context.departureTime || new Date();

    logger.info('Extracting ML features', {
      distance: context.distance_km,
      departure: departureTime.toISOString(),
    });

    // Extract features in parallel for efficiency
    const [weather, trafficScore, isPoyaDay, isLongWeekend, isPublicHoliday, holidayName] =
      await Promise.all([
        this.extractWeatherFeature(context.origin.lat, context.origin.lng),
        this.extractTrafficScore(
          context.origin.lat,
          context.origin.lng,
          context.destination.lat,
          context.destination.lng,
          departureTime
        ),
        this.holidayService.isPoyaDay(departureTime),
        this.holidayService.isLongWeekend(departureTime),
        this.holidayService.isPublicHoliday(departureTime),
        this.holidayService.getHolidayName(departureTime),
      ]);

    logger.info('Holiday feature evaluation:', {
      departure_date: departureTime.toISOString(),
      is_public_holiday: isPublicHoliday,
      is_poya_day: isPoyaDay,
      is_long_weekend: isLongWeekend,
      holiday_name: holidayName,
    });

    const features: MLFeatures = {
      distance_km: context.distance_km,
      weather,
      is_friday: this.isFriday(departureTime),
      is_poya_day: isPoyaDay ? 1 : 0,
      traffic_score: trafficScore,
      area_type: this.determineAreaType(context.origin.isUrban),
      is_peak_hours: this.isPeakHours(departureTime),
      is_weekend: this.isWeekend(departureTime),
      is_long_weekend: isLongWeekend ? 1 : 0,
      trip_hour: departureTime.getHours(),
    };

    logger.info('ML features extracted successfully', features);
    return features;
  }

  /**
   * Extract weather feature from weather data
   */
  private async extractWeatherFeature(
    lat: number,
    lng: number
  ): Promise<'sunny' | 'rain' | 'storm'> {
    try {
      const weather = await this.weatherService.getCurrentWeather(lat, lng);

      if (!weather) {
        logger.warn('Weather data unavailable, defaulting to sunny');
        return 'sunny';
      }

      return this.mapWeatherToML(weather);
    } catch (error) {
      logger.warn('Error fetching weather, defaulting to sunny', error);
      return 'sunny';
    }
  }

  /**
   * Map weather data to ML categories
   */
  private mapWeatherToML(weather: WeatherData): 'sunny' | 'rain' | 'storm' {
    const description = weather.description.toLowerCase();
    const windSpeed = weather.wind_speed;

    // Storm: High winds or thunder/storm in description
    if (
      windSpeed > 15 ||
      description.includes('storm') ||
      description.includes('thunder') ||
      description.includes('hurricane') ||
      description.includes('typhoon')
    ) {
      return 'storm';
    }

    // Rain: Any rain-related condition
    if (
      description.includes('rain') ||
      description.includes('drizzle') ||
      description.includes('shower') ||
      weather.rain ||
      weather.humidity > 85
    ) {
      return 'rain';
    }

    // Sunny: Clear or light clouds
    return 'sunny';
  }

  /**
   * Extract traffic score (0-1 scale)
   */
  private async extractTrafficScore(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
    departureTime: Date
  ): Promise<number> {
    try {
      // Determine time of day
      const hour = departureTime.getHours();
      let timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
      if (hour >= 6 && hour < 12) timeOfDay = 'morning';
      else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
      else if (hour >= 17 && hour < 21) timeOfDay = 'evening';
      else timeOfDay = 'night';

      const trafficData = await this.trafficService.getTrafficConditions(
        originLat,
        originLng,
        destLat,
        destLng,
        timeOfDay
      );

      if (!trafficData) {
        logger.warn('Traffic data unavailable, using default score 0.3');
        return 0.3;
      }

      // Normalize traffic congestion to 0-1 scale
      // Congestion levels: 'low' = 0.2, 'medium' = 0.5, 'high' = 0.8, 'severe' = 1.0
      switch (trafficData.congestion_level) {
        case 'severe':
          return 1.0;
        case 'high':
          return 0.8;
        case 'medium':
          return 0.5;
        case 'low':
        default:
          return 0.2;
      }
    } catch (error) {
      logger.warn('Error fetching traffic, using default score 0.3', error);
      return 0.3;
    }
  }

  /**
   * Check if departure is on Friday
   */
  private isFriday(date: Date): 0 | 1 {
    return date.getDay() === 5 ? 1 : 0;
  }

  /**
   * Check if departure is during peak hours
   * Peak: 7-9 AM or 5-7 PM on weekdays
   */
  private isPeakHours(date: Date): 0 | 1 {
    const hour = date.getHours();
    const dayOfWeek = date.getDay();

    // Only weekdays have peak hours
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return 0;
    }

    // Morning peak: 7-9 AM
    if (hour >= 7 && hour < 9) {
      return 1;
    }

    // Evening peak: 5-7 PM
    if (hour >= 17 && hour < 19) {
      return 1;
    }

    return 0;
  }

  /**
   * Check if departure is on weekend
   */
  private isWeekend(date: Date): 0 | 1 {
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0;
  }

  /**
   * Determine area type based on city classification
   */
  private determineAreaType(isUrban?: boolean): 'urban' | 'village' {
    if (isUrban === undefined) {
      // Default to urban if not specified
      return 'urban';
    }
    return isUrban ? 'urban' : 'village';
  }

  /**
   * Get human-readable feature description
   */
  getFeatureDescription(features: MLFeatures): string {
    const parts: string[] = [];

    parts.push(`${features.distance_km.toFixed(1)}km trip`);
    parts.push(`${features.weather} weather`);

    if (features.is_poya_day) {
      parts.push('Poya day');
    } else if (features.is_long_weekend) {
      parts.push('long weekend');
    } else if (features.is_weekend) {
      parts.push('weekend');
    } else if (features.is_friday) {
      parts.push('Friday');
    }

    if (features.is_peak_hours) {
      parts.push('peak hours');
    }

    parts.push(`${(features.traffic_score * 100).toFixed(0)}% traffic`);
    parts.push(`${features.area_type} area`);

    return parts.join(', ');
  }
}

// Export singleton instance factory
export const createMLFeatureExtractor = (
  weatherService: WeatherService,
  trafficService: TrafficService,
  holidayService: HolidayService
): MLFeatureExtractor => {
  return new MLFeatureExtractor(weatherService, trafficService, holidayService);
};
