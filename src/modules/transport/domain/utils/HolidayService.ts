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
  error?: string;
  warning?: string;
}

interface NagerHoliday {
  date: string;
  localName: string;
  name: string;
}

interface StaticHolidayEntry {
  name: string;
  date: string;
}

export class HolidayService {
  private client: AxiosInstance;
  private apiKey: string;
  private holidayCache: Map<number, Holiday[]> = new Map(); // Cache by year
  private cacheTimestamp: Map<number, number> = new Map();
  private inFlightRequests: Map<number, Promise<Holiday[]>> = new Map();
  private readonly CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

  // Offline fallback for critical Sri Lanka holidays when external APIs are unavailable.
  // Keep this list updated yearly for best accuracy.
  private readonly staticSriLankaHolidays: Record<number, StaticHolidayEntry[]> = {
    2026: [
      { name: 'Independence Day', date: '2026-02-04' },
      { name: 'Bak Full Moon Poya Day', date: '2026-04-01' },
      { name: 'Sinhala and Tamil New Year Eve', date: '2026-04-13' },
      { name: 'Sinhala and Tamil New Year Day', date: '2026-04-14' },
      { name: 'May Day', date: '2026-05-01' },
      { name: 'Christmas Day', date: '2026-12-25' },
    ],
  };

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
      logger.warn('Holiday API key not set, using fallback holiday provider');
      return this.fetchFallbackHolidays(year);
    }

    try {
      const response = await this.client.get<HolidayResponse>('/holidays', {
        params: {
          country: 'LK', // Sri Lanka
          year: year,
          key: this.apiKey,
          public: true,
        },
      });

      if (response.data.warning) {
        logger.warn(`Holiday API warning: ${response.data.warning}`);
      }

      if (response.data.error) {
        logger.warn(`Holiday API error: ${response.data.error}`);
        return this.fetchFallbackHolidays(year);
      }

      if (!Array.isArray(response.data.holidays)) {
        logger.warn('Holiday API returned malformed holidays payload, using fallback provider');
        return this.fetchFallbackHolidays(year);
      }

      if (response.data.status === 200) {
        logger.info(
          `Fetched ${response.data.holidays.length} holidays for ${year} (${response.data.requests.available} requests remaining)`
        );
        return response.data.holidays;
      }

      logger.warn(`Holiday API returned status ${response.data.status}`);
      return this.fetchFallbackHolidays(year);
    } catch (error: unknown) {
      const axiosError = error as { response?: { status?: number }; message?: string };
      const statusCode = axiosError?.response?.status;
      const message = axiosError?.message || 'Unknown error';
      logger.error(`Error fetching holidays: ${message}`);

      // Quota/billing errors are common on HolidayAPI free tiers; use fallback provider.
      if (statusCode === 402 || statusCode === 401 || statusCode === 429) {
        logger.warn(
          `HolidayAPI unavailable (status ${statusCode}), using fallback holiday provider`
        );
      }

      return this.fetchFallbackHolidays(year);
    }
  }

  /**
   * Fallback provider using free Nager.Date API (no API key required)
   */
  private async fetchFallbackHolidays(year: number): Promise<Holiday[]> {
    try {
      const response = await axios.get<NagerHoliday[]>(
        `https://date.nager.at/api/v3/PublicHolidays/${year}/LK`,
        { timeout: 5000 }
      );

      const holidays = (response.data || []).map((h, index) => ({
        name: h.localName || h.name,
        date: h.date,
        observed: h.date,
        public: true,
        country: 'LK',
        uuid: `nager-${year}-${index}`,
        weekday: {
          date: {
            name: new Date(h.date).toLocaleDateString('en-US', { weekday: 'long' }),
            numeric: new Date(h.date).getDay(),
          },
          observed: {
            name: new Date(h.date).toLocaleDateString('en-US', { weekday: 'long' }),
            numeric: new Date(h.date).getDay(),
          },
        },
      }));

      if (holidays.length > 0) {
        logger.info(`Fetched ${holidays.length} fallback holidays for ${year} from Nager.Date`);
        return holidays;
      }

      logger.warn(`Nager fallback returned 0 holidays for ${year}, using static fallback list`);
      return this.getStaticFallbackHolidays(year);
    } catch (fallbackError: unknown) {
      const message = fallbackError instanceof Error ? fallbackError.message : 'Unknown error';
      logger.error(`Fallback holiday fetch failed: ${message}`);
      return this.getStaticFallbackHolidays(year);
    }
  }

  private getStaticFallbackHolidays(year: number): Holiday[] {
    const staticEntries = this.staticSriLankaHolidays[year] || [];

    if (staticEntries.length === 0) {
      logger.warn(`No static fallback holidays configured for year ${year}`);
      return [];
    }

    const holidays = staticEntries.map((entry, index) => {
      const date = new Date(entry.date);
      const weekdayName = date.toLocaleDateString('en-US', { weekday: 'long' });
      const weekdayNumber = date.getDay();

      return {
        name: entry.name,
        date: entry.date,
        observed: entry.date,
        public: true,
        country: 'LK',
        uuid: `static-${year}-${index}`,
        weekday: {
          date: {
            name: weekdayName,
            numeric: weekdayNumber,
          },
          observed: {
            name: weekdayName,
            numeric: weekdayNumber,
          },
        },
      };
    });

    logger.info(`Using ${holidays.length} static fallback holidays for ${year}`);
    return holidays;
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

    // Reuse in-flight request to avoid parallel duplicate API calls for same year.
    const inFlight = this.inFlightRequests.get(year);
    if (inFlight) {
      return inFlight;
    }

    const fetchPromise = this.fetchHolidays(year)
      .then((holidays) => {
        this.holidayCache.set(year, holidays);
        this.cacheTimestamp.set(year, Date.now());
        return holidays;
      })
      .finally(() => {
        this.inFlightRequests.delete(year);
      });

    this.inFlightRequests.set(year, fetchPromise);
    return fetchPromise;
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
    this.inFlightRequests.clear();
    logger.info('Holiday cache cleared');
  }
}

export const holidayService = new HolidayService();
