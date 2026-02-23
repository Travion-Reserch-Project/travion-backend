import { CityRepository } from '../repositories/CityRepository';
import { ICity } from '../models/City';

export interface LocationInput {
  cityName?: string;
  cityId?: number;
  coordinates?: { lat: number; lng: number };
}

export class TransportService {
  private cityRepo: CityRepository;

  constructor() {
    this.cityRepo = new CityRepository();
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
}
