import axios, { AxiosInstance } from 'axios';
import { logger } from '../../../../shared/config/logger';
import { cacheService } from '../../../../shared/libraries/cache/CacheService';

export interface GoogleMapsRoute {
  summary: string;
  duration: number; // in seconds
  distance: number; // in meters
  steps: Array<{
    instruction: string;
    maneuver?: string; // e.g., "turn-left", "turn-right", "straight"
    duration: number;
    distance: number;
    travel_mode: string;
    start_location?: { lat: number; lng: number };
    end_location?: { lat: number; lng: number };
  }>;
  polyline: string; // Encoded polyline for entire route
  bounds?: {
    northeast: { lat: number; lng: number };
    southwest: { lat: number; lng: number };
  };
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

export interface RouteDistance {
  distance_km: number;
  distance_m: number;
  duration_min: number;
  duration_sec: number;
  traffic_delay_min: number;
}

export class GoogleMapsService {
  private client: AxiosInstance;
  private routesClient: AxiosInstance;
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('Google Maps API key not configured');
    }

    // Legacy APIs client (Places, Distance Matrix, etc.)
    this.client = axios.create({
      baseURL: 'https://maps.googleapis.com/maps/api',
      timeout: 10000,
    });

    // New Routes API client
    this.routesClient = axios.create({
      baseURL: 'https://routes.googleapis.com',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask':
          'routes.duration,routes.staticDuration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.description,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration,routes.legs.steps.navigationInstruction,routes.legs.steps.travelMode',
      },
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
   * Get directions between two locations using new Routes API
   */
  async getDirections(
    origin: { lat: number; lng: number } | string,
    destination: { lat: number; lng: number } | string,
    mode: 'driving' | 'transit' | 'walking' = 'transit',
    alternatives: boolean = true
  ): Promise<GoogleMapsRoute[]> {
    this.ensureConfigured();
    try {
      const originLocation =
        typeof origin === 'string' ? origin : { latitude: origin.lat, longitude: origin.lng };
      const destLocation =
        typeof destination === 'string'
          ? destination
          : { latitude: destination.lat, longitude: destination.lng };

      // Map mode to travelMode for new API
      const travelModeMap = {
        driving: 'DRIVE',
        transit: 'TRANSIT',
        walking: 'WALK',
      };

      const requestBody = {
        origin: {
          location: typeof origin === 'string' ? { address: origin } : { latLng: originLocation },
        },
        destination: {
          location:
            typeof destination === 'string' ? { address: destination } : { latLng: destLocation },
        },
        travelMode: travelModeMap[mode],
        computeAlternativeRoutes: alternatives,
        languageCode: 'en', // Force English instructions
        units: 'METRIC', // Use kilometers/meters
      };

      logger.info('Routes API Request:', {
        origin: typeof origin === 'string' ? origin : `${origin.lat},${origin.lng}`,
        destination:
          typeof destination === 'string' ? destination : `${destination.lat},${destination.lng}`,
        mode: travelModeMap[mode],
      });

      const response = await this.routesClient.post('/directions/v2:computeRoutes', requestBody);

      logger.info('Routes API Response:', {
        routes_count: response.data.routes?.length || 0,
      });

      if (!response.data.routes || response.data.routes.length === 0) {
        logger.warn('No routes returned from Routes API');
        return [];
      }

      return response.data.routes.map((route: any) => ({
        summary: route.description || 'Route',
        duration: route.duration ? parseInt(route.duration.replace('s', '')) : 0,
        distance: route.distanceMeters || 0,
        steps:
          route.legs?.[0]?.steps?.map((step: any) => ({
            instruction: step.navigationInstruction?.instructions || '',
            maneuver: step.navigationInstruction?.maneuver || '',
            duration: step.staticDuration ? parseInt(step.staticDuration.replace('s', '')) : 0,
            distance: step.distanceMeters || 0,
            travel_mode: step.travelMode || mode.toUpperCase(),
            start_location: step.startLocation
              ? {
                  lat: step.startLocation.latLng?.latitude,
                  lng: step.startLocation.latLng?.longitude,
                }
              : undefined,
            end_location: step.endLocation
              ? {
                  lat: step.endLocation.latLng?.latitude,
                  lng: step.endLocation.latLng?.longitude,
                }
              : undefined,
          })) || [],
        polyline: route.polyline?.encodedPolyline || '',
        bounds: route.viewport
          ? {
              northeast: {
                lat: route.viewport.high?.latitude,
                lng: route.viewport.high?.longitude,
              },
              southwest: {
                lat: route.viewport.low?.latitude,
                lng: route.viewport.low?.longitude,
              },
            }
          : undefined,
      }));
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error('Routes API request failed:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message,
        });
      } else {
        logger.error('Error fetching Routes API directions:', error);
      }
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
        language: 'en',
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
          language: 'en',
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
   * Get real-time route distance with traffic
   */
  async getRouteDistance(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
    mode: 'driving' | 'transit' | 'walking' = 'transit'
  ): Promise<RouteDistance | null> {
    try {
      // Check cache first
      const cacheKey = `distance:${originLat},${originLng}:${destLat},${destLng}`;
      const cached = cacheService.get<RouteDistance>(cacheKey);
      if (cached) {
        logger.debug(`Using cached distance for ${originLat},${originLng} → ${destLat},${destLng}`);
        return cached;
      }

      this.ensureConfigured();

      const travelModeMap = {
        driving: 'DRIVE',
        transit: 'TRANSIT',
        walking: 'WALK',
      };

      const requestBody = {
        origin: {
          location: {
            latLng: {
              latitude: originLat,
              longitude: originLng,
            },
          },
        },
        destination: {
          location: {
            latLng: {
              latitude: destLat,
              longitude: destLng,
            },
          },
        },
        travelMode: travelModeMap[mode],
        routingPreference: 'TRAFFIC_AWARE', // Enable traffic data
        departureTime: new Date(Date.now() + 60000).toISOString(), // 1 minute in the future
      };

      const response = await this.routesClient.post('/directions/v2:computeRoutes', requestBody);

      logger.info('Routes API Distance Response:', {
        routes_count: response.data.routes?.length || 0,
        origin: `${originLat},${originLng}`,
        destination: `${destLat},${destLng}`,
        mode: travelModeMap[mode],
      });

      if (!response.data.routes || !response.data.routes.length) {
        logger.warn(`No route found for ${originLat},${originLng} → ${destLat},${destLng}`);
        return null;
      }

      const route = response.data.routes[0];

      // Parse duration (format: "1234s")
      // duration = with traffic, staticDuration = without traffic
      const durationWithTrafficSec = route.duration ? parseInt(route.duration.replace('s', '')) : 0;
      const durationWithoutTrafficSec = route.staticDuration
        ? parseInt(route.staticDuration.replace('s', ''))
        : durationWithTrafficSec;
      const distanceM = route.distanceMeters || 0;

      // Calculate traffic delay
      const trafficDelayMin = Math.round((durationWithTrafficSec - durationWithoutTrafficSec) / 60);

      const result: RouteDistance = {
        distance_km: distanceM / 1000,
        distance_m: distanceM,
        duration_min: Math.round(durationWithTrafficSec / 60),
        duration_sec: durationWithTrafficSec,
        traffic_delay_min: Math.max(0, trafficDelayMin),
      };

      // Cache for 10 minutes
      cacheService.set(cacheKey, result, 10 * 60 * 1000);

      return result;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error('Routes API distance request failed:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message,
          requestBody: {
            origin: `${originLat},${originLng}`,
            destination: `${destLat},${destLng}`,
            mode,
          },
        });
      } else {
        logger.warn(`Error fetching route distance: ${error}`);
      }
      return null;
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
          language: 'en',
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
          language: 'en',
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
