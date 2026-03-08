/**
 * Location Service
 * Service for managing location data including images
 */

import Location from '../models/Location';
import { AppError } from '../middleware/errorHandler';

export interface LocationWithImages {
  name: string;
  imageUrls: string[];
  coordinates: {
    latitude: number;
    longitude: number;
  };
  preferenceScores: {
    history: number;
    adventure: number;
    nature: number;
    relaxation: number;
  };
  isOutdoor: boolean;
}

export interface LocationImagesResponse {
  name: string;
  imageUrls: string[];
  primaryImage: string | null;
  totalImages: number;
}

class LocationServiceClass {
  /**
   * Get location images by name (fuzzy search)
   */
  async getLocationImages(locationName: string): Promise<LocationImagesResponse> {
    // Try exact match first
    let location = await Location.findOne({ name: locationName });

    // If no exact match, try case-insensitive search
    if (!location) {
      location = await Location.findOne({
        name: { $regex: new RegExp(`^${locationName}$`, 'i') },
      });
    }

    // If still no match, try partial match
    if (!location) {
      location = await Location.findOne({
        name: { $regex: new RegExp(locationName, 'i') },
      });
    }

    if (!location) {
      throw new AppError(`Location not found: ${locationName}`, 404);
    }

    return {
      name: location.name,
      imageUrls: location.imageUrls || [],
      primaryImage: location.imageUrls?.[0] || null,
      totalImages: location.imageUrls?.length || 0,
    };
  }

  /**
   * Get multiple locations images by names
   */
  async getMultipleLocationImages(
    locationNames: string[]
  ): Promise<Map<string, LocationImagesResponse>> {
    const results = new Map<string, LocationImagesResponse>();

    for (const name of locationNames) {
      try {
        const images = await this.getLocationImages(name);
        results.set(name, images);
      } catch {
        // If location not found, add empty result
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
   * Get location with full details
   */
  async getLocationByName(locationName: string): Promise<LocationWithImages | null> {
    let location = await Location.findOne({ name: locationName });

    if (!location) {
      location = await Location.findOne({
        name: { $regex: new RegExp(`^${locationName}$`, 'i') },
      });
    }

    if (!location) {
      location = await Location.findOne({
        name: { $regex: new RegExp(locationName, 'i') },
      });
    }

    if (!location) {
      return null;
    }

    return {
      name: location.name,
      imageUrls: location.imageUrls || [],
      coordinates: {
        latitude: location.coordinates.latitude,
        longitude: location.coordinates.longitude,
      },
      preferenceScores: {
        history: location.preferenceScores.history,
        adventure: location.preferenceScores.adventure,
        nature: location.preferenceScores.nature,
        relaxation: location.preferenceScores.relaxation,
      },
      isOutdoor: location.isOutdoor,
    };
  }

  /**
   * Search locations by name
   */
  async searchLocations(query: string, limit: number = 10): Promise<LocationWithImages[]> {
    const locations = await Location.find({
      name: { $regex: new RegExp(query, 'i') },
    })
      .limit(limit)
      .lean();

    return locations.map((loc) => ({
      name: loc.name,
      imageUrls: loc.imageUrls || [],
      coordinates: {
        latitude: loc.coordinates.latitude,
        longitude: loc.coordinates.longitude,
      },
      preferenceScores: {
        history: loc.preferenceScores.history,
        adventure: loc.preferenceScores.adventure,
        nature: loc.preferenceScores.nature,
        relaxation: loc.preferenceScores.relaxation,
      },
      isOutdoor: loc.isOutdoor,
    }));
  }

  /**
   * Get all locations (with pagination)
   */
  async getAllLocations(
    page: number = 1,
    limit: number = 20
  ): Promise<{ locations: LocationWithImages[]; total: number; pages: number }> {
    const skip = (page - 1) * limit;

    const [locations, total] = await Promise.all([
      Location.find().skip(skip).limit(limit).lean(),
      Location.countDocuments(),
    ]);

    return {
      locations: locations.map((loc) => ({
        name: loc.name,
        imageUrls: loc.imageUrls || [],
        coordinates: {
          latitude: loc.coordinates.latitude,
          longitude: loc.coordinates.longitude,
        },
        preferenceScores: {
          history: loc.preferenceScores.history,
          adventure: loc.preferenceScores.adventure,
          nature: loc.preferenceScores.nature,
          relaxation: loc.preferenceScores.relaxation,
        },
        isOutdoor: loc.isOutdoor,
      })),
      total,
      pages: Math.ceil(total / limit),
    };
  }
}

export const LocationService = new LocationServiceClass();
export default LocationService;
