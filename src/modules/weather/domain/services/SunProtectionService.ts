// SunProtectionService.ts

import axios from 'axios';
import UserHealthProfile from '../models/HealthProfile';
import { logger } from '../../../../shared/config/logger';

interface WeatherCache {
  data: any;
  timestamp: number;
}

const weatherCache = new Map<string, WeatherCache>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

export class SunProtectionService {
  private static getCacheKey(lat: number, lon: number): string {
    // Round to 3 decimal places to group nearby locations
    return `${lat.toFixed(3)},${lon.toFixed(3)}`;
  }

  private static async getGoogleWeather(lat: number, lon: number): Promise<any> {
    const cacheKey = this.getCacheKey(lat, lon);
    const cached = weatherCache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.timestamp < CACHE_TTL) {
      logger.info(`Using cached weather data for ${cacheKey}`);
      return cached.data;
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    const url = `https://weather.googleapis.com/v1/currentConditions:lookup?key=${apiKey}&location.latitude=${lat}&location.longitude=${lon}`;

    logger.info(`Fetching fresh weather data from Google for lat=${lat}, lon=${lon}`);
    const response = await axios.get(url);
    const data = response.data;

    weatherCache.set(cacheKey, {
      data,
      timestamp: now,
    });

    return data;
  }

  private static mapCloudCover(cloudCoverPercentage: number): string {
    if (cloudCoverPercentage < 20) return 'clear';
    if (cloudCoverPercentage < 70) return 'partly cloudy';
    return 'overcast';
  }

  public static async predictRisk(userId: string, lat: number, lon: number): Promise<any> {
    try {
      // 1. Get User Health Profile
      const healthProfile: any = await UserHealthProfile.findOne({ userId });
      if (!healthProfile) {
        throw new Error('Health profile not found for this user');
      }

      // 2. Get Weather Info (with caching)
      const googleWeather = await this.getGoogleWeather(lat, lon);

      // Based on typical Google Weather API response structure
      // We need to be careful here with null checks as Google API might return different fields
      const current = googleWeather; // Root usually has the data if using currentConditions:lookup

      // Extract values with sensible defaults
      const uvIndex = current.uvIndex ?? 0;
      const temperatureC = current.temperature?.value ?? 25;
      const humidityPct = current.humidity ?? 50;
      const cloudCoverPct = current.cloudCover ?? 0;

      const currentTimeAtLocation = new Date(); // Ideally should use location-specific time, but server time is a fallback
      const timeOfDay = currentTimeAtLocation.getHours();

      // 3. Prepare payload for ML Service
      // Ensure strings match PROTECTION_MAPPING in ml-services: "never", "rarely", "sometimes", "often", "always"
      const features = {
        'Skin Type': healthProfile.skinType,
        'UV Index': uvIndex,
        'Time of Day': timeOfDay,
        'Historical Sunburn': healthProfile.historicalSunburnTimes || 0,
        'Historical Tanning': healthProfile.historicalTanningTimes || 0,
        'Skin Product Interaction': healthProfile.skinProductInteraction || 'never',
        'Use of Sunglasses/Hat/Shade': healthProfile.useOfSunglasses || 'never',
        'Cloud Cover': this.mapCloudCover(cloudCoverPct),
        Age: healthProfile.age,
        Temperature_C: temperatureC,
        'Humidity_%': humidityPct,
      };

      const mlServiceUrl =
        process.env.WEATHER_ML_SERVICE_URL || 'http://localhost:8002/api/weather/predict';

      logger.info(`Calling ML service at ${mlServiceUrl}`);
      const mlResponse = await axios.post(mlServiceUrl, {
        features,
        user_location: `${lat},${lon}`,
      });

      return {
        prediction: mlResponse.data,
        weather: {
          uvIndex,
          temperatureC,
          humidityPct,
          cloudCover: this.mapCloudCover(cloudCoverPct),
          cloudCoverPct,
        },
        healthProfileSummary: {
          skinType: healthProfile.skinType,
          age: healthProfile.age,
        },
      };
    } catch (error: any) {
      logger.error('Error in SunProtectionService.predictRisk:', error.message);
      throw error;
    }
  }
}
