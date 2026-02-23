import { City, ICity } from '../models/City';

export class CityRepository {
  async findById(cityId: number): Promise<ICity | null> {
    return City.findOne({ city_id: cityId });
  }

  async findByName(name: string, language: 'en' | 'si' | 'ta' = 'en'): Promise<ICity[]> {
    const query: Record<string, unknown> = {};
    query[`name.${language}`] = new RegExp(name, 'i');
    return City.find(query);
  }

  async searchByName(searchTerm: string): Promise<ICity[]> {
    return City.find({
      $or: [
        { 'name.en': new RegExp(searchTerm, 'i') },
        { 'name.si': new RegExp(searchTerm, 'i') },
        { 'name.ta': new RegExp(searchTerm, 'i') },
      ],
    }).limit(10);
  }

  async findNearby(
    longitude: number,
    latitude: number,
    maxDistanceKm: number = 50
  ): Promise<ICity[]> {
    return City.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude],
          },
          $maxDistance: maxDistanceKm * 1000, // Convert to meters
        },
      },
    }).limit(10);
  }

  async findByDistrict(districtId: number): Promise<ICity[]> {
    return City.find({ district_id: districtId });
  }

  async findWithTransportType(transportType: 'railway' | 'bus' | 'both'): Promise<ICity[]> {
    const query: Record<string, unknown> = {};
    if (transportType === 'railway') {
      query['transport_access.has_railway'] = true;
    } else if (transportType === 'bus') {
      query['transport_access.has_bus'] = true;
    } else if (transportType === 'both') {
      query['transport_access.has_both'] = true;
    }
    return City.find(query);
  }

  async create(cityData: Partial<ICity>): Promise<ICity> {
    const city = new City(cityData);
    return city.save();
  }

  async update(cityId: number, updateData: Partial<ICity>): Promise<ICity | null> {
    return City.findOneAndUpdate({ city_id: cityId }, updateData, { new: true });
  }

  async findAll(limit: number = 100, skip: number = 0): Promise<ICity[]> {
    return City.find().limit(limit).skip(skip);
  }
}
