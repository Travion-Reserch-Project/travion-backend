import { CityRepository } from '../repositories/CityRepository';
import { TransportRouteRepository } from '../repositories/TransportRouteRepository';
import { ICity } from '../models/City';
import { ITransportRoute } from '../models/TransportRoute';

export interface LocationInput {
  cityName?: string;
  cityId?: number;
  coordinates?: { lat: number; lng: number };
}

export class TransportService {
  private cityRepo: CityRepository;
  private routeRepo: TransportRouteRepository;

  constructor() {
    this.cityRepo = new CityRepository();
    this.routeRepo = new TransportRouteRepository();
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
   * Find routes between two cities from database
   */
  async findRoutes(
    originCityId: number,
    destinationCityId: number,
    transportType?: 'bus' | 'train' | 'car'
  ): Promise<ITransportRoute[]> {
    return this.routeRepo.findByOriginAndDestination(
      originCityId,
      destinationCityId,
      transportType
    );
  }
}
