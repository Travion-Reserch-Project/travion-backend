import axios from 'axios';
import config from '../config/config';

export interface LocationFeatures {
  area_cluster: number;
  is_beach: number;
  is_crowded: number;
  is_tourist_place: number;
  is_transit: number;
  hour: number;
  day_of_week: number;
  is_weekend: number;
  police_nearby: number;
}

export interface LocationInfo {
  address: string;
  locationName: string;
  features: LocationFeatures;
}

export class GoogleMapsService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://maps.googleapis.com/maps/api';

  constructor() {
    this.apiKey = config.googleMaps.apiKey;
    if (!this.apiKey) {
      throw new Error('Google Maps API key is not configured');
    }
  }

  /**
   * Extract location features from lat/lon using Google Maps APIs
   */
  async extractLocationFeatures(latitude: number, longitude: number): Promise<LocationInfo> {
    try {
      // 1. Reverse Geocode to get address and location name
      const geocodeData = await this.reverseGeocode(latitude, longitude);

      // 2. Check nearby places for each feature
      const [
        isBeach,
        isTouristPlace,
        policeNearby,
        isBusStand,
        isTrainStation,
        isMarket,
        isShoppingMall,
      ] = await Promise.all([
        this.checkNearbyPlace(latitude, longitude, 'beach', 200),
        this.checkNearbyPlace(latitude, longitude, 'tourist_attraction', 200),
        this.checkNearbyPlace(latitude, longitude, 'police', 200),
        this.checkNearbyPlace(latitude, longitude, 'bus_station', 500),
        this.checkNearbyPlace(latitude, longitude, 'train_station', 200),
        this.checkNearbyPlace(latitude, longitude, 'market', 200),
        this.checkNearbyPlace(latitude, longitude, 'shopping_mall', 200),
      ]);

      // 3. Calculate is_transit: 1 if bus stand OR train station nearby
      const isTransit = isBusStand || isTrainStation ? 1 : 0;

      // 4. Calculate is_crowded: 1 if market OR shopping mall OR tourist place nearby
      const isCrowded = isMarket || isShoppingMall || isTouristPlace ? 1 : 0;

      // 5. Get current time features (Sri Lanka timezone UTC+5:30)
      const now = new Date();
      const sriLankaTime = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
      const hour = sriLankaTime.getUTCHours();
      const dayOfWeek = sriLankaTime.getUTCDay(); // 0 = Sunday, 6 = Saturday
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0;

      // 6. area_cluster: default to 0 (can be enhanced later with clustering algorithm)
      const areaCluster = 0;

      return {
        address: geocodeData.address,
        locationName: geocodeData.locationName,
        features: {
          area_cluster: areaCluster,
          is_beach: isBeach,
          is_crowded: isCrowded,
          is_tourist_place: isTouristPlace,
          is_transit: isTransit,
          hour: hour,
          day_of_week: dayOfWeek,
          is_weekend: isWeekend,
          police_nearby: policeNearby,
        },
      };
    } catch (error) {
      throw new Error(`Failed to extract location features: ${(error as Error).message}`);
    }
  }

  /**
   * Reverse geocode to get address and location name
   */
  private async reverseGeocode(
    latitude: number,
    longitude: number
  ): Promise<{ address: string; locationName: string }> {
    try {
      const response = await axios.get(`${this.baseUrl}/geocode/json`, {
        params: {
          latlng: `${latitude},${longitude}`,
          key: this.apiKey,
        },
      });

      if (response.data.status !== 'OK' || !response.data.results.length) {
        throw new Error('Failed to reverse geocode location');
      }

      const result = response.data.results[0];
      const address = result.formatted_address;

      // Extract location name (usually first address component)
      const locationName =
        result.address_components.find(
          (comp: any) => comp.types.includes('locality') || comp.types.includes('sublocality')
        )?.long_name || address.split(',')[0];

      return { address, locationName };
    } catch (error) {
      throw new Error(`Reverse geocode failed: ${(error as Error).message}`);
    }
  }

  /**
   * Check if a specific place type exists nearby
   * Returns 1 if found, 0 if not found
   */
  private async checkNearbyPlace(
    latitude: number,
    longitude: number,
    placeType: string,
    radius: number
  ): Promise<number> {
    try {
      const response = await axios.get(`${this.baseUrl}/place/nearbysearch/json`, {
        params: {
          location: `${latitude},${longitude}`,
          radius: radius,
          type: placeType,
          key: this.apiKey,
        },
      });

      // Return 1 if any results found, 0 otherwise
      return response.data.results && response.data.results.length > 0 ? 1 : 0;
    } catch (error) {
      console.error(`Failed to check nearby place (${placeType}):`, error);
      return 0; // Default to 0 if API call fails
    }
  }

  /**
   * Get detailed place information by place ID
   */
  async getPlaceDetails(placeId: string): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/place/details/json`, {
        params: {
          place_id: placeId,
          key: this.apiKey,
        },
      });

      if (response.data.status !== 'OK') {
        throw new Error('Failed to get place details');
      }

      return response.data.result;
    } catch (error) {
      throw new Error(`Get place details failed: ${(error as Error).message}`);
    }
  }
}
