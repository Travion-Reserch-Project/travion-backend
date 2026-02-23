import axios, { AxiosInstance } from 'axios';
import { logger } from '../config/logger';

export interface WeatherData {
  temperature: number; // Celsius
  feels_like: number;
  humidity: number; // percentage
  description: string;
  icon: string;
  wind_speed: number; // m/s
  rain?: {
    '1h'?: number;
    '3h'?: number;
  };
  visibility?: number; // meters
  timestamp: Date;
}

export interface WeatherForecast {
  date: Date;
  temperature: {
    min: number;
    max: number;
  };
  description: string;
  icon: string;
  rain_probability?: number;
}

export class WeatherService {
  private client: AxiosInstance;
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.OPENWEATHER_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('OpenWeather API key not configured');
    }

    this.client = axios.create({
      baseURL: 'https://api.openweathermap.org/data/2.5',
      timeout: 10000,
    });
  }

  /**
   * Check if WeatherService is configured
   */
  private ensureConfigured(): void {
    if (!this.apiKey) {
      throw new Error(
        'OpenWeather API key not configured. Please set OPENWEATHER_API_KEY environment variable.'
      );
    }
  }

  /**
   * Get current weather for a location
   */
  async getCurrentWeather(lat: number, lon: number): Promise<WeatherData | null> {
    this.ensureConfigured();
    try {
      const response = await this.client.get('/weather', {
        params: {
          lat,
          lon,
          appid: this.apiKey,
          units: 'metric', // Celsius
        },
      });

      const data = response.data;

      return {
        temperature: data.main.temp,
        feels_like: data.main.feels_like,
        humidity: data.main.humidity,
        description: data.weather[0].description,
        icon: data.weather[0].icon,
        wind_speed: data.wind.speed,
        rain: data.rain,
        visibility: data.visibility,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Error fetching current weather:', error);
      return null;
    }
  }

  /**
   * Get weather forecast for next 5 days
   */
  async getForecast(lat: number, lon: number): Promise<WeatherForecast[]> {
    this.ensureConfigured();
    try {
      const response = await this.client.get('/forecast', {
        params: {
          lat,
          lon,
          appid: this.apiKey,
          units: 'metric',
        },
      });

      // Group forecasts by day
      const dailyForecasts: Map<string, WeatherForecast> = new Map();

      response.data.list.forEach(
        (item: {
          dt: number;
          main: {
            temp_min: number;
            temp_max: number;
          };
          weather: Array<{
            description: string;
            icon: string;
          }>;
          pop?: number;
        }) => {
          const date = new Date(item.dt * 1000);
          const dateKey = date.toISOString().split('T')[0];

          if (!dailyForecasts.has(dateKey)) {
            dailyForecasts.set(dateKey, {
              date,
              temperature: {
                min: item.main.temp_min,
                max: item.main.temp_max,
              },
              description: item.weather[0].description,
              icon: item.weather[0].icon,
              rain_probability: item.pop ? item.pop * 100 : undefined,
            });
          } else {
            const existing = dailyForecasts.get(dateKey)!;
            existing.temperature.min = Math.min(existing.temperature.min, item.main.temp_min);
            existing.temperature.max = Math.max(existing.temperature.max, item.main.temp_max);
          }
        }
      );

      return Array.from(dailyForecasts.values()).slice(0, 5);
    } catch (error) {
      logger.error('Error fetching weather forecast:', error);
      return [];
    }
  }

  /**
   * Get weather condition summary for travel planning
   */
  async getWeatherSummary(lat: number, lon: number): Promise<string> {
    const weather = await this.getCurrentWeather(lat, lon);
    if (!weather) {
      return 'Weather information unavailable';
    }

    let summary = `Current weather: ${weather.description}, ${Math.round(weather.temperature)}°C`;

    if (weather.rain && (weather.rain['1h'] || weather.rain['3h'])) {
      summary += '. Rain expected - bring an umbrella!';
    }

    if (weather.temperature > 30) {
      summary += ". It's quite hot - stay hydrated!";
    } else if (weather.temperature < 20) {
      summary += ". It's cooler - consider a light jacket.";
    }

    return summary;
  }

  /**
   * Check if weather is suitable for travel
   */
  async isTravelFriendly(
    lat: number,
    lon: number
  ): Promise<{
    suitable: boolean;
    reason?: string;
    warnings: string[];
  }> {
    const weather = await this.getCurrentWeather(lat, lon);
    if (!weather) {
      return { suitable: true, warnings: [] };
    }

    const warnings: string[] = [];
    let suitable = true;

    // Check for heavy rain
    if (weather.rain && (weather.rain['1h'] || 0) > 10) {
      warnings.push('Heavy rain expected');
      suitable = false;
    }

    // Check visibility
    if (weather.visibility && weather.visibility < 1000) {
      warnings.push('Low visibility conditions');
      suitable = false;
    }

    // Check extreme temperatures
    if (weather.temperature > 35) {
      warnings.push('Extreme heat - take precautions');
    } else if (weather.temperature < 15) {
      warnings.push('Cool weather - dress warmly');
    }

    return {
      suitable,
      reason: suitable ? undefined : warnings.join(', '),
      warnings,
    };
  }
}
