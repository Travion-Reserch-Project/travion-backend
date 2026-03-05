import { logger } from '../../../../shared/config/logger';
import { GoogleMapsService } from './GoogleMapsService';
import { WeatherService, WeatherData } from './WeatherService';
import { TrafficService } from './TrafficService';
import { cacheService } from '../../../../shared/libraries/cache/CacheService';

export interface StaticRouteData {
  route_id: string;
  transport_type: 'bus' | 'train' | 'tuk_tuk' | 'taxi' | 'car';
  operator_name: string;
  scenic_score: number; // 0-1
  comfort_score: number; // 0-1
  base_fare_lkr: number;
  estimated_duration_min: number;
  polyline?: string; // Encoded polyline for map rendering
  navigation_steps?: Array<{
    instruction: string;
    maneuver?: string;
    duration: number;
    distance: number;
    travel_mode: string;
    start_location?: { lat: number; lng: number };
    end_location?: { lat: number; lng: number };
  }>;
}

export interface DynamicRouteData {
  distance_km: number;
  duration_min: number;
  traffic_delay_min: number;
  weather_risk: number; // 0-1
  congestion: 'low' | 'medium' | 'high' | 'severe';
  accident_risk: number; // 0-1
}

export interface RouteContext {
  route_id: string;
  transport_type: 'bus' | 'train' | 'tuk_tuk' | 'taxi' | 'car';
  operator_name: string;
  static: StaticRouteData;
  dynamic: DynamicRouteData;
  recommendation_reason?: string;
}

export class RouteContextBuilder {
  private googleMapsService: GoogleMapsService;
  private weatherService: WeatherService;
  private trafficService: TrafficService;

  constructor() {
    this.googleMapsService = new GoogleMapsService();
    this.weatherService = new WeatherService();
    this.trafficService = new TrafficService();
  }

  /**
   * Build comprehensive route context by aggregating static and dynamic data
   */
  async buildRouteContext(
    staticRoute: StaticRouteData,
    originCoords: { lat: number; lng: number },
    destCoords: { lat: number; lng: number }
  ): Promise<RouteContext | null> {
    try {
      // Check cache
      const cacheKey = `route_context:${staticRoute.route_id}:${originCoords.lat},${originCoords.lng}:${destCoords.lat},${destCoords.lng}`;
      const cached = cacheService.get<RouteContext>(cacheKey);
      if (cached) {
        logger.debug(`Using cached route context for route ${staticRoute.route_id}`);
        return cached;
      }

      // Fetch real-time data in parallel (with error handling for optional APIs)
      const [distanceData, weatherDest, trafficData] = await Promise.all([
        this.googleMapsService
          .getRouteDistance(
            originCoords.lat,
            originCoords.lng,
            destCoords.lat,
            destCoords.lng,
            staticRoute.transport_type === 'train' ? 'transit' : 'driving'
          )
          .catch(() => null),
        this.weatherService.getCurrentWeather(destCoords.lat, destCoords.lng).catch(() => null), // Weather is optional
        this.trafficService
          .getTrafficConditions(originCoords.lat, originCoords.lng, destCoords.lat, destCoords.lng)
          .catch(() => ({
            congestion_level: 'low' as const,
            accident_risk_score: 0.1,
            road_condition: 'good',
            estimated_delay_min: 0,
          })),
      ]);

      // Handle null responses gracefully
      if (!distanceData) {
        logger.warn(`No distance data for route ${staticRoute.route_id}`);
        return null;
      }

      // Build dynamic context
      const dynamic: DynamicRouteData = {
        distance_km: distanceData.distance_km,
        duration_min: distanceData.duration_min + distanceData.traffic_delay_min,
        traffic_delay_min: distanceData.traffic_delay_min,
        weather_risk: weatherDest ? this.calculateWeatherRisk(weatherDest) : 0.3,
        congestion: trafficData.congestion_level,
        accident_risk: trafficData.accident_risk_score,
      };

      const context: RouteContext = {
        route_id: staticRoute.route_id,
        transport_type: staticRoute.transport_type,
        operator_name: staticRoute.operator_name,
        static: staticRoute,
        dynamic,
      };

      // Cache for 10 minutes
      cacheService.set(cacheKey, context, 10 * 60 * 1000);

      logger.info(`Built route context for ${staticRoute.route_id}:`, {
        distance_km: dynamic.distance_km,
        duration_min: dynamic.duration_min,
        weather_risk: dynamic.weather_risk,
        congestion: dynamic.congestion,
      });

      return context;
    } catch (error) {
      logger.error(`Error building route context for ${staticRoute.route_id}:`, error);
      return null;
    }
  }

  /**
   * Calculate weather risk score (0-1)
   */
  private calculateWeatherRisk(weather: WeatherData): number {
    let risk = 0.1; // base risk

    // Temperature considerations
    if (weather.temperature < 10 || weather.temperature > 35) {
      risk += 0.1;
    }

    // Humidity
    if (weather.humidity > 85) {
      risk += 0.05;
    }

    // Wind conditions (if available)
    if (weather.wind_speed && weather.wind_speed > 30) {
      risk += 0.15;
    }

    // Rain/Precipitation
    if (weather.rain && (weather.rain['1h'] || weather.rain['3h'])) {
      const rainVolume = (weather.rain['1h'] || 0) + (weather.rain['3h'] || 0);
      if (rainVolume > 30) {
        risk += 0.35; // Heavy rain
      } else if (rainVolume > 10) {
        risk += 0.2; // Moderate rain
      } else {
        risk += 0.1; // Light rain
      }
    }

    // UV Index
    if (weather.icon && weather.icon.includes('d')) {
      // Day time
      // Note: weather object doesn't have UV index from OpenWeather, this is extensible
      risk += 0.05;
    }

    return Math.min(risk, 1.0); // Cap at 1.0
  }

  /**
   * Build multiple route contexts in parallel
   */
  async buildRouteContexts(
    staticRoutes: StaticRouteData[],
    originCoords: { lat: number; lng: number },
    destCoords: { lat: number; lng: number }
  ): Promise<RouteContext[]> {
    const contexts = await Promise.all(
      staticRoutes.map((route) => this.buildRouteContext(route, originCoords, destCoords))
    );

    return contexts.filter((ctx): ctx is RouteContext => ctx !== null);
  }
}

export const routeContextBuilder = new RouteContextBuilder();
