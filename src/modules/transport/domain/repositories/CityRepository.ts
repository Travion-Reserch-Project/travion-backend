import { City, ICity } from '../models/City';

export class CityRepository {
  private toSlug(value: string): string {
    return value
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  async findById(cityId: number): Promise<ICity | null> {
    return City.findOne({ city_id: cityId });
  }

  async findByName(name: string, language: 'en' | 'si' | 'ta' = 'en'): Promise<ICity[]> {
    const query: Record<string, unknown> = {};
    query[`name.${language}`] = new RegExp(name, 'i');
    return City.find(query);
  }

  async searchByName(searchTerm: string): Promise<ICity[]> {
    const trimmedTerm = searchTerm.trim();
    const slugTerm = this.toSlug(trimmedTerm);

    // Special handling for "Colombo" without number - match "Colombo 1" first
    if (/^colombo$/i.test(trimmedTerm)) {
      const colombo1 = await City.findOne({ 'name.en': /^Colombo 1$/i });
      if (colombo1) return [colombo1];
    }

    // Use word boundaries to prevent "Colombo 1" from matching "Colombo 15"
    // Escape special regex characters in search term
    const escapedTerm = trimmedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Try exact match first (case-insensitive)
    const exactMatch = await City.findOne({
      $or: [
        { city_name: new RegExp(`^${escapedTerm}$`, 'i') },
        { 'name.en': new RegExp(`^${escapedTerm}$`, 'i') },
        { 'name.si': new RegExp(`^${escapedTerm}$`, 'i') },
        { 'name.ta': new RegExp(`^${escapedTerm}$`, 'i') },
      ],
    });

    if (exactMatch) {
      return [exactMatch];
    }

    // Fallback to partial match with word boundaries
    return City.find({
      $or: [
        { city_name: new RegExp(`\\b${escapedTerm}\\b`, 'i') },
        { slug: slugTerm },
        { 'name.en': new RegExp(`\\b${escapedTerm}\\b`, 'i') },
        { 'name.si': new RegExp(`\\b${escapedTerm}\\b`, 'i') },
        { 'name.ta': new RegExp(`\\b${escapedTerm}\\b`, 'i') },
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
