import axios, { AxiosInstance } from 'axios';
import { logger } from '../config/logger';

export interface GoogleMapsRoute {
  summary: string;
  duration: number; // in seconds
  distance: number; // in meters
  steps: Array<{
    instruction: string;
    duration: number;
    distance: number;
    travel_mode: string;
  }>;
  polyline: string;
}

export interface GoogleMapsDirectionsResponse {
  routes: GoogleMapsRoute[];
  status: string;
}

export interface PlaceSearchResult {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  types: string[];
}

export class GoogleMapsService {
  private client: AxiosInstance;
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('Google Maps API key not configured');
    }

    this.client = axios.create({
      baseURL: 'https://maps.googleapis.com/maps/api',
      timeout: 10000,
    });
  }

  /**
   * Check if GoogleMapsService is configured
   */
  private ensureConfigured(): void {
    if (!this.apiKey) {
      throw new Error(
        'Google Maps API key not configured. Please set GOOGLE_MAPS_API_KEY environment variable.'
      );
    }
  }

  /**
   * Get directions between two locations
   */
  async getDirections(
    origin: { lat: number; lng: number } | string,
    destination: { lat: number; lng: number } | string,
    mode: 'driving' | 'transit' | 'walking' = 'transit',
    alternatives: boolean = true
  ): Promise<GoogleMapsRoute[]> {
    this.ensureConfigured();
    try {
      const originParam = typeof origin === 'string' ? origin : `${origin.lat},${origin.lng}`;
      const destParam =
        typeof destination === 'string' ? destination : `${destination.lat},${destination.lng}`;

      const response = await this.client.get('/directions/json', {
        params: {
          origin: originParam,
          destination: destParam,
          mode,
          alternatives,
          key: this.apiKey,
        },
      });

      if (response.data.status !== 'OK') {
        logger.warn('Google Maps API error:', response.data.status);
        return [];
      }

      return response.data.routes.map(
        (route: {
          summary: string;
          legs: Array<{
            duration: { value: number };
            distance: { value: number };
            steps: Array<{
              html_instructions: string;
              duration: { value: number };
              distance: { value: number };
              travel_mode: string;
            }>;
          }>;
          overview_polyline: { points: string };
        }) => ({
          summary: route.summary,
          duration: route.legs[0].duration.value,
          distance: route.legs[0].distance.value,
          steps: route.legs[0].steps.map((step) => ({
            instruction: step.html_instructions,
            duration: step.duration.value,
            distance: step.distance.value,
            travel_mode: step.travel_mode,
          })),
          polyline: route.overview_polyline.points,
        })
      );
    } catch (error) {
      logger.error('Error fetching Google Maps directions:', error);
      throw error;
    }
  }

  /**
   * Search for a place by query
   */
  async searchPlace(
    query: string,
    location?: { lat: number; lng: number }
  ): Promise<PlaceSearchResult[]> {
    this.ensureConfigured();
    try {
      const params: Record<string, string | number> = {
        query,
        key: this.apiKey,
      };

      if (location) {
        params.location = `${location.lat},${location.lng}`;
        params.radius = 50000; // 50km radius
      }

      const response = await this.client.get('/place/textsearch/json', {
        params,
      });

      if (response.data.status !== 'OK') {
        logger.warn('Google Places API error:', response.data.status);
        return [];
      }

      return response.data.results;
    } catch (error) {
      logger.error('Error searching place:', error);
      throw error;
    }
  }

  /**
   * Get distance matrix between multiple origins and destinations
   */
  async getDistanceMatrix(
    origins: Array<{ lat: number; lng: number }>,
    destinations: Array<{ lat: number; lng: number }>,
    mode: 'driving' | 'transit' | 'walking' = 'transit'
  ): Promise<{
    rows: Array<{
      elements: Array<{
        distance: { value: number; text: string };
        duration: { value: number; text: string };
        status: string;
      }>;
    }>;
  }> {
    this.ensureConfigured();
    try {
      const originsParam = origins.map((o) => `${o.lat},${o.lng}`).join('|');
      const destinationsParam = destinations.map((d) => `${d.lat},${d.lng}`).join('|');

      const response = await this.client.get('/distancematrix/json', {
        params: {
          origins: originsParam,
          destinations: destinationsParam,
          mode,
          key: this.apiKey,
        },
      });

      if (response.data.status !== 'OK') {
        logger.warn('Google Distance Matrix API error:', response.data.status);
        throw new Error('Failed to get distance matrix');
      }

      return response.data;
    } catch (error) {
      logger.error('Error fetching distance matrix:', error);
      throw error;
    }
  }

  /**
   * Geocode an address to coordinates
   */
  async geocode(address: string): Promise<{ lat: number; lng: number } | null> {
    this.ensureConfigured();
    try {
      const response = await this.client.get('/geocode/json', {
        params: {
          address,
          key: this.apiKey,
        },
      });

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        return response.data.results[0].geometry.location;
      }

      return null;
    } catch (error) {
      logger.error('Error geocoding address:', error);
      return null;
    }
  }

  /**
   * Reverse geocode coordinates to address
   */
  async reverseGeocode(lat: number, lng: number): Promise<string | null> {
    this.ensureConfigured();
    try {
      const response = await this.client.get('/geocode/json', {
        params: {
          latlng: `${lat},${lng}`,
          key: this.apiKey,
        },
      });

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        return response.data.results[0].formatted_address;
      }

      return null;
    } catch (error) {
      logger.error('Error reverse geocoding:', error);
      return null;
    }
  }
}
