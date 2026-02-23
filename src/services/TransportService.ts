import { CityRepository } from '../repositories/CityRepository';
import { TransportStationRepository } from '../repositories/TransportStationRepository';
import { TransportRouteRepository } from '../repositories/TransportRouteRepository';
import { GoogleMapsService } from './GoogleMapsService';
import { MLService } from './MLService';
import { logger } from '../config/logger';
import { ICity } from '../models/City';
import { ITransportStation } from '../models/TransportStation';
import { ITransportRoute } from '../models/TransportRoute';

export interface LocationInput {
  cityName?: string;
  cityId?: number;
  coordinates?: { lat: number; lng: number };
}

export interface TransportRecommendation {
  recommended_mode: 'bus' | 'train' | 'mixed';
  confidence: number;
  origin: {
    city: ICity;
    nearest_stations: ITransportStation[];
  };
  destination: {
    city: ICity;
    nearest_stations: ITransportStation[];
  };
  routes: Array<{
    transport_type: 'bus' | 'train';
    distance_km: number;
    estimated_time_min: number;
    fare_lkr?: number;
    has_transfer: boolean;
    route_details?: ITransportRoute;
    google_route?: {
      duration: number;
      distance: number;
      steps: unknown[];
    };
  }>;
  step_by_step_instructions: string[];
  ml_recommendation?: {
    predicted_mode: string;
    confidence: number;
    factors: string[];
  };
}

export class TransportService {
  private cityRepo: CityRepository;
  private stationRepo: TransportStationRepository;
  private routeRepo: TransportRouteRepository;
  private googleMaps: GoogleMapsService;
  private mlService: MLService;

  constructor() {
    this.cityRepo = new CityRepository();
    this.stationRepo = new TransportStationRepository();
    this.routeRepo = new TransportRouteRepository();
    this.googleMaps = new GoogleMapsService();
    this.mlService = new MLService();
  }

  /**
   * Find a city by name or ID
   */
  async findCity(input: LocationInput): Promise<ICity | null> {
    if (input.cityId) {
      return this.cityRepo.findById(input.cityId);
    }

    if (input.cityName) {
      const cities = await this.cityRepo.searchByName(input.cityName);
      return cities.length > 0 ? cities[0] : null;
    }

    if (input.coordinates) {
      const cities = await this.cityRepo.findNearby(
        input.coordinates.lng,
        input.coordinates.lat,
        10
      );
      return cities.length > 0 ? cities[0] : null;
    }

    return null;
  }

  /**
   * Get transport recommendations between two locations
   */
  async getTransportRecommendation(
    origin: LocationInput,
    destination: LocationInput,
    preferences?: {
      transport_type?: 'bus' | 'train' | 'any';
      budget?: 'low' | 'medium' | 'high';
    }
  ): Promise<TransportRecommendation | null> {
    try {
      // Find origin and destination cities
      const originCity = await this.findCity(origin);
      const destCity = await this.findCity(destination);

      if (!originCity || !destCity) {
        logger.warn('Could not find origin or destination city');
        return null;
      }

      // Find nearest stations
      const originStations = await this.stationRepo.findByCity(originCity.city_id);
      const destStations = await this.stationRepo.findByCity(destCity.city_id);

      // Find transport routes in database
      const dbRoutes = await this.routeRepo.findByOriginAndDestination(
        originCity.city_id,
        destCity.city_id,
        preferences?.transport_type === 'any' ? undefined : preferences?.transport_type
      );

      // Get Google Maps routes for comparison
      let googleRoutes: Array<{
        duration: number;
        distance: number;
        steps: unknown[];
      }> = [];
      try {
        googleRoutes = await this.googleMaps.getDirections(
          { lat: originCity.location.coordinates[1], lng: originCity.location.coordinates[0] },
          { lat: destCity.location.coordinates[1], lng: destCity.location.coordinates[0] },
          'transit'
        );
      } catch (error) {
        logger.warn('Could not fetch Google Maps routes:', error);
      }

      // Get ML recommendation
      let mlRecommendation;
      try {
        mlRecommendation = await this.mlService.predictTransportMode({
          origin: {
            latitude: originCity.location.coordinates[1],
            longitude: originCity.location.coordinates[0],
          },
          destination: {
            latitude: destCity.location.coordinates[1],
            longitude: destCity.location.coordinates[0],
          },
          distance_km: this.calculateDistance(
            originCity.location.coordinates[1],
            originCity.location.coordinates[0],
            destCity.location.coordinates[1],
            destCity.location.coordinates[0]
          ),
        });
      } catch (error) {
        logger.warn('Could not get ML recommendation:', error);
      }

      // Build routes array
      const routes = dbRoutes.map((route, index) => ({
        transport_type: route.transport_type as 'bus' | 'train',
        distance_km: route.distance_km,
        estimated_time_min: route.estimated_time_min,
        fare_lkr: route.base_fare_lkr,
        has_transfer: route.has_transfer,
        route_details: route,
        google_route: googleRoutes[index],
      }));

      // Determine recommended mode
      const recommendedMode = this.determineRecommendedMode(routes, mlRecommendation, preferences);

      // Generate step-by-step instructions
      const instructions = this.generateInstructions(
        originCity,
        destCity,
        originStations,
        destStations,
        routes,
        recommendedMode
      );

      return {
        recommended_mode: recommendedMode,
        confidence: mlRecommendation?.confidence || 0.7,
        origin: {
          city: originCity,
          nearest_stations: originStations,
        },
        destination: {
          city: destCity,
          nearest_stations: destStations,
        },
        routes,
        step_by_step_instructions: instructions,
        ml_recommendation: mlRecommendation
          ? {
              predicted_mode: mlRecommendation.predicted_mode,
              confidence: mlRecommendation.confidence,
              factors: mlRecommendation.explanation?.factors || [],
            }
          : undefined,
      };
    } catch (error) {
      logger.error('Error getting transport recommendation:', error);
      throw error;
    }
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  /**
   * Determine the best transport mode
   */
  private determineRecommendedMode(
    routes: TransportRecommendation['routes'],
    mlRecommendation: { predicted_mode: string } | undefined,
    preferences?: { transport_type?: 'bus' | 'train' | 'any' }
  ): 'bus' | 'train' | 'mixed' {
    // User preference takes priority
    if (preferences?.transport_type && preferences.transport_type !== 'any') {
      return preferences.transport_type;
    }

    // ML recommendation
    if (
      mlRecommendation?.predicted_mode === 'train' ||
      mlRecommendation?.predicted_mode === 'bus'
    ) {
      return mlRecommendation.predicted_mode as 'bus' | 'train';
    }

    // Fallback to fastest route
    if (routes.length === 0) return 'mixed';

    const sortedRoutes = [...routes].sort((a, b) => a.estimated_time_min - b.estimated_time_min);
    return sortedRoutes[0].transport_type;
  }

  /**
   * Generate step-by-step instructions
   */
  private generateInstructions(
    origin: ICity,
    destination: ICity,
    originStations: ITransportStation[],
    destStations: ITransportStation[],
    routes: TransportRecommendation['routes'],
    recommendedMode: 'bus' | 'train' | 'mixed'
  ): string[] {
    const instructions: string[] = [];

    instructions.push(`Starting from ${origin.name.en} to ${destination.name.en}`);

    // Find the best route based on recommended mode
    const bestRoute = routes.find((r) => r.transport_type === recommendedMode) || routes[0];

    if (!bestRoute) {
      instructions.push('No direct routes available. Consider alternative transport options.');
      return instructions;
    }

    // Find nearest station
    const nearestOriginStation = originStations.find(
      (s) => s.station_type === bestRoute.transport_type
    );
    const nearestDestStation = destStations.find(
      (s) => s.station_type === bestRoute.transport_type
    );

    if (nearestOriginStation) {
      instructions.push(
        `1. Go to ${nearestOriginStation.name} ${bestRoute.transport_type} station`
      );
    }

    instructions.push(`2. Take a ${bestRoute.transport_type} towards ${destination.name.en}`);

    if (bestRoute.has_transfer) {
      instructions.push('3. You may need to change transport at an intermediate point');
    }

    if (nearestDestStation) {
      instructions.push(
        `${bestRoute.has_transfer ? '4' : '3'}. Arrive at ${nearestDestStation.name} station`
      );
    }

    instructions.push(
      `Expected travel time: ${bestRoute.estimated_time_min} minutes (${bestRoute.distance_km.toFixed(1)} km)`
    );

    if (bestRoute.fare_lkr) {
      instructions.push(`Estimated fare: LKR ${bestRoute.fare_lkr}`);
    }

    return instructions;
  }

  /**
   * Search cities by name
   */
  async searchCities(searchTerm: string): Promise<ICity[]> {
    return this.cityRepo.searchByName(searchTerm);
  }

  /**
   * Get stations near a location
   */
  async getNearbyStations(
    lat: number,
    lng: number,
    maxDistanceKm: number = 5,
    stationType?: 'bus' | 'train'
  ): Promise<ITransportStation[]> {
    return this.stationRepo.findNearby(lng, lat, maxDistanceKm, stationType);
  }
}
