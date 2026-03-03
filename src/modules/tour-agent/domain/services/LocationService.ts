/**
 * Location Service
 * Handles location data and image management
 */

import Location from '../../../auth/domain/models/Location';

export class LocationService {
  /**
   * Get images for a single location by name
   */
  static async getLocationImages(name: string): Promise<{
    name: string;
    imageUrls: string[];
    primaryImage: string | null;
    totalImages: number;
  }> {
    const location = await Location.findOne({
      name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    }).lean();

    if (!location) {
      return {
        name,
        imageUrls: [],
        primaryImage: null,
        totalImages: 0,
      };
    }

    const validUrls = (location.imageUrls || []).filter(
      (url: string) => url && url !== 'N/A' && url.startsWith('http')
    );

    return {
      name: location.name,
      imageUrls: validUrls,
      primaryImage: validUrls.length > 0 ? validUrls[0] : null,
      totalImages: validUrls.length,
    };
  }

  /**
   * Get images for multiple locations by name (bulk)
   */
  static async getMultipleLocationImages(names: string[]): Promise<Map<string, any>> {
    // Use $or with case-insensitive regex for each name
    const orConditions = names.map((name) => ({
      name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    }));

    const locations = await Location.find({
      $or: orConditions,
    }).lean();

    // Build a map of lowercase name -> location for fast lookup
    const locationMap = new Map<string, any>();
    for (const loc of locations) {
      locationMap.set(loc.name.toLowerCase(), loc);
    }

    const results = new Map<string, any>();

    for (const name of names) {
      const location = locationMap.get(name.toLowerCase());

      if (location) {
        const validUrls = (location.imageUrls || []).filter(
          (url: string) => url && url !== 'N/A' && url.startsWith('http')
        );
        results.set(name, {
          name: location.name,
          imageUrls: validUrls,
          primaryImage: validUrls.length > 0 ? validUrls[0] : null,
          totalImages: validUrls.length,
        });
      } else {
        results.set(name, {
          name,
          imageUrls: [],
          primaryImage: null,
          totalImages: 0,
        });
      }
    }

    return results;
  }

  /**
   * Search locations by name query
   */
  static async searchLocations(query: string, limit: number = 10): Promise<any[]> {
    const locations = await Location.find({
      name: { $regex: new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
    })
      .limit(limit)
      .lean();

    return locations.map((loc: any) => ({
      name: loc.name,
      coordinates: loc.coordinates,
      preferenceScores: loc.preferenceScores,
      isOutdoor: loc.isOutdoor,
      imageUrls: (loc.imageUrls || []).filter((url: string) => url && url !== 'N/A'),
    }));
  }

  /**
   * Get all locations (paginated)
   */
  static async getAllLocations(page: number = 1, limit: number = 20): Promise<any> {
    const skip = (page - 1) * limit;
    const [locations, total] = await Promise.all([
      Location.find().skip(skip).limit(limit).lean(),
      Location.countDocuments(),
    ]);

    return {
      locations: locations.map((loc: any) => ({
        name: loc.name,
        coordinates: loc.coordinates,
        preferenceScores: loc.preferenceScores,
        isOutdoor: loc.isOutdoor,
        imageUrls: (loc.imageUrls || []).filter((url: string) => url && url !== 'N/A'),
      })),
      total,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a single location by name
   */
  static async getLocationByName(name: string): Promise<any | null> {
    const location = await Location.findOne({
      name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    }).lean();

    if (!location) return null;

    return {
      name: location.name,
      coordinates: location.coordinates,
      preferenceScores: location.preferenceScores,
      isOutdoor: location.isOutdoor,
      imageUrls: (location.imageUrls || []).filter((url: string) => url && url !== 'N/A'),
    };
  }

  /**
   * Proxy an image URL (fetch with browser User-Agent)
   */
  static async imageProxy(url: string): Promise<Buffer> {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        Accept: 'image/*,*/*;q=0.8',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
