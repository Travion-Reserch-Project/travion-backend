import axios, { AxiosInstance } from 'axios';
import { logger } from '../../../../shared/config/logger';

export interface Holiday {
  name: string;
  date: string; // YYYY-MM-DD
  observed: string;
  public: boolean;
  country: string;
  uuid: string;
  weekday: {
    date: {
      name: string;
      numeric: number;
    };
    observed: {
      name: string;
      numeric: number;
    };
  };
}

export interface HolidayResponse {
  status: number;
  requests: {
    used: number;
    available: number;
    resets: string;
  };
  holidays: Holiday[];
}

export class HolidayService {
  private client: AxiosInstance;
  private apiKey: string;
  private holidayCache: Map<number, Holiday[]> = new Map(); // Cache by year
  private cacheTimestamp: Map<number, number> = new Map();
  private readonly CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

  constructor() {
    this.apiKey = process.env.HOLIDAY_API_KEY || '';

    if (!this.apiKey) {
      logger.warn('Holiday API key not configured - holiday detection will be unavailable');
    }

    this.client = axios.create({
      baseURL: 'https://holidayapi.com/v1',
      timeout: 5000,
    });
  }

  /**
   * Fetch holidays for a specific year from Holiday API
   */
  private async fetchHolidays(year: number): Promise<Holiday[]> {
    if (!this.apiKey) {
      logger.warn('Holiday API key not set, returning empty holidays');
      return [];
    }

    try {
      const response = await this.client.get<HolidayResponse>('/holidays', {
        params: {
          country: 'LK', // Sri Lanka
          year: year,
          key: this.apiKey,
        },
      });

      if (response.data.status === 200) {
        logger.info(
          `Fetched ${response.data.holidays.length} holidays for ${year} (${response.data.requests.available} requests remaining)`
        );
        return response.data.holidays;
      }

      logger.warn(`Holiday API returned status ${response.data.status}`);
      return [];
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error fetching holidays: ${message}`);
      return [];
    }
  }

  /**
   * Get holidays for a year (with caching)
   */
  private async getHolidays(year: number): Promise<Holiday[]> {
    const now = Date.now();
    const cached = this.holidayCache.get(year);
    const cacheTime = this.cacheTimestamp.get(year);

    // Return cached data if still valid
    if (cached && cacheTime && now - cacheTime < this.CACHE_TTL) {
      return cached;
    }

    // Fetch fresh data
    const holidays = await this.fetchHolidays(year);
    this.holidayCache.set(year, holidays);
    this.cacheTimestamp.set(year, now);

    return holidays;
  }

  /**
   * Check if a date is a public holiday (including Poya days in Sri Lanka)
   */
  async isPublicHoliday(date: Date): Promise<boolean> {
    const year = date.getFullYear();
    const dateStr = this.formatDate(date);

    const holidays = await this.getHolidays(year);

    return holidays.some(
      (holiday) => holiday.public && (holiday.date === dateStr || holiday.observed === dateStr)
    );
  }

  /**
   * Check if a date is a Poya day (full moon holiday in Sri Lanka)
   */
  async isPoyaDay(date: Date): Promise<boolean> {
    const year = date.getFullYear();
    const dateStr = this.formatDate(date);

    const holidays = await this.getHolidays(year);

    // Poya days typically have "Poya" in the name
    return holidays.some(
      (holiday) =>
        holiday.public &&
        holiday.name.toLowerCase().includes('poya') &&
        (holiday.date === dateStr || holiday.observed === dateStr)
    );
  }

  /**
   * Check if a date is part of a long weekend
   * A long weekend is when there's a public holiday on Friday or Monday,
   * creating a 3+ day weekend
   */
  async isLongWeekend(date: Date): Promise<boolean> {
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday

    // Weekend days are always part of a weekend (but not necessarily "long")
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      // Check if there's a holiday on Friday or Monday
      const friday = new Date(date);
      const monday = new Date(date);

      if (dayOfWeek === 0) {
        // Sunday - check if Monday is a holiday
        monday.setDate(date.getDate() + 1);
        return await this.isPublicHoliday(monday);
      } else {
        // Saturday - check if Friday is a holiday
        friday.setDate(date.getDate() - 1);
        return await this.isPublicHoliday(friday);
      }
    }

    // Weekdays - check if they're holidays adjacent to weekends
    if (dayOfWeek === 5) {
      // Friday - check if it's a holiday (makes it a long weekend)
      return await this.isPublicHoliday(date);
    } else if (dayOfWeek === 1) {
      // Monday - check if it's a holiday (makes it a long weekend)
      return await this.isPublicHoliday(date);
    }

    // Check if there are consecutive holidays creating a long weekend
    const previousDay = new Date(date);
    previousDay.setDate(date.getDate() - 1);
    const nextDay = new Date(date);
    nextDay.setDate(date.getDate() + 1);

    const isCurrentHoliday = await this.isPublicHoliday(date);
    const isPrevHoliday = await this.isPublicHoliday(previousDay);
    const isNextHoliday = await this.isPublicHoliday(nextDay);

    // Long weekend if current day + adjacent days are holidays
    return isCurrentHoliday && (isPrevHoliday || isNextHoliday);
  }

  /**
   * Get holiday name if the date is a holiday
   */
  async getHolidayName(date: Date): Promise<string | null> {
    const year = date.getFullYear();
    const dateStr = this.formatDate(date);

    const holidays = await this.getHolidays(year);

    const holiday = holidays.find(
      (h) => h.public && (h.date === dateStr || h.observed === dateStr)
    );

    return holiday ? holiday.name : null;
  }

  /**
   * Get all public holidays for a year
   */
  async getYearHolidays(year: number): Promise<Holiday[]> {
    const holidays = await this.getHolidays(year);
    return holidays.filter((h) => h.public);
  }

  /**
   * Format date to YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Clear cache (useful for testing or manual refresh)
   */
  clearCache(): void {
    this.holidayCache.clear();
    this.cacheTimestamp.clear();
    logger.info('Holiday cache cleared');
  }
}

export const holidayService = new HolidayService();
