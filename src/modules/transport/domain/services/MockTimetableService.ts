import { logger } from '../../../../shared/config/logger';

/**
 * Departure time with metadata
 */
export interface DepartureTime {
  departure_time: string; // HH:MM format
  departure_datetime: Date;
  minutes_until_departure: number;
  is_next_available: boolean;
}

/**
 * Timetable configuration based on distance
 */
interface TimetableConfig {
  distance_km: number;
  frequency_minutes: number;
  operating_hours: {
    start: string; // HH:MM
    end: string; // HH:MM
  };
}

/**
 * Mock Timetable Service
 *
 * Generates mock departure times based on distance:
 * - Long distance (>100km): 4 hour frequency
 * - Medium distance (50-100km): 45 min frequency
 * - Short distance (<50km): 20 min frequency
 */
export class MockTimetableService {
  /**
   * Get timetable configuration based on distance
   */
  private getTimetableConfig(distanceKm: number): TimetableConfig {
    if (distanceKm > 100) {
      return {
        distance_km: distanceKm,
        frequency_minutes: 240, // 4 hours
        operating_hours: { start: '05:00', end: '21:00' },
      };
    } else if (distanceKm >= 50) {
      return {
        distance_km: distanceKm,
        frequency_minutes: 45, // 45 minutes
        operating_hours: { start: '05:00', end: '22:00' },
      };
    } else {
      return {
        distance_km: distanceKm,
        frequency_minutes: 20, // 20 minutes
        operating_hours: { start: '05:30', end: '23:00' },
      };
    }
  }

  /**
   * Parse time string (HH:MM) into minutes from midnight
   */
  private parseTimeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Format minutes from midnight to HH:MM
   */
  private formatMinutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  /**
   * Generate all departure times for a given day based on frequency
   */
  private generateDailyDepartures(config: TimetableConfig): string[] {
    const departures: string[] = [];
    const startMinutes = this.parseTimeToMinutes(config.operating_hours.start);
    const endMinutes = this.parseTimeToMinutes(config.operating_hours.end);
    const frequency = config.frequency_minutes;

    let currentMinutes = startMinutes;
    while (currentMinutes <= endMinutes) {
      departures.push(this.formatMinutesToTime(currentMinutes));
      currentMinutes += frequency;
    }

    return departures;
  }

  /**
   * Get the next available departure time from current time
   */
  public getNextDeparture(
    distanceKm: number,
    transportMode: 'bus' | 'train' | 'car',
    currentTime?: Date
  ): DepartureTime | null {
    try {
      // Car/taxi doesn't have timetable - available on demand
      if (transportMode === 'car') {
        const now = currentTime || new Date();
        return {
          departure_time: 'On Demand',
          departure_datetime: now,
          minutes_until_departure: 0,
          is_next_available: true,
        };
      }

      const now = currentTime || new Date();
      const config = this.getTimetableConfig(distanceKm);
      const dailyDepartures = this.generateDailyDepartures(config);

      // Get current time in minutes from midnight
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      // Find next departure
      for (const departureTime of dailyDepartures) {
        const departureMinutes = this.parseTimeToMinutes(departureTime);

        if (departureMinutes >= currentMinutes) {
          // Calculate actual datetime for this departure
          const departureDate = new Date(now);
          departureDate.setHours(Math.floor(departureMinutes / 60));
          departureDate.setMinutes(departureMinutes % 60);
          departureDate.setSeconds(0);
          departureDate.setMilliseconds(0);

          const minutesUntil = Math.floor((departureDate.getTime() - now.getTime()) / (1000 * 60));

          return {
            departure_time: departureTime,
            departure_datetime: departureDate,
            minutes_until_departure: minutesUntil,
            is_next_available: true,
          };
        }
      }

      // If no departure found today, return first departure tomorrow
      const firstDeparture = dailyDepartures[0];
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const firstDepartureMinutes = this.parseTimeToMinutes(firstDeparture);
      tomorrow.setHours(Math.floor(firstDepartureMinutes / 60));
      tomorrow.setMinutes(firstDepartureMinutes % 60);
      tomorrow.setSeconds(0);
      tomorrow.setMilliseconds(0);

      const minutesUntil = Math.floor((tomorrow.getTime() - now.getTime()) / (1000 * 60));

      return {
        departure_time: `${firstDeparture} (Tomorrow)`,
        departure_datetime: tomorrow,
        minutes_until_departure: minutesUntil,
        is_next_available: true,
      };
    } catch (error) {
      logger.error('Error getting next departure:', error);
      return null;
    }
  }

  /**
   * Get multiple upcoming departures
   */
  public getUpcomingDepartures(
    distanceKm: number,
    transportMode: 'bus' | 'train' | 'car',
    count: number = 3,
    currentTime?: Date
  ): DepartureTime[] {
    try {
      // Car/taxi doesn't have timetable
      if (transportMode === 'car') {
        const now = currentTime || new Date();
        return [
          {
            departure_time: 'On Demand',
            departure_datetime: now,
            minutes_until_departure: 0,
            is_next_available: true,
          },
        ];
      }

      const now = currentTime || new Date();
      const config = this.getTimetableConfig(distanceKm);
      const dailyDepartures = this.generateDailyDepartures(config);
      const results: DepartureTime[] = [];

      // Get current time in minutes from midnight
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      // Find upcoming departures today
      for (const departureTime of dailyDepartures) {
        if (results.length >= count) break;

        const departureMinutes = this.parseTimeToMinutes(departureTime);

        if (departureMinutes >= currentMinutes) {
          const departureDate = new Date(now);
          departureDate.setHours(Math.floor(departureMinutes / 60));
          departureDate.setMinutes(departureMinutes % 60);
          departureDate.setSeconds(0);
          departureDate.setMilliseconds(0);

          const minutesUntil = Math.floor((departureDate.getTime() - now.getTime()) / (1000 * 60));

          results.push({
            departure_time: departureTime,
            departure_datetime: departureDate,
            minutes_until_departure: minutesUntil,
            is_next_available: results.length === 0,
          });
        }
      }

      // If we need more departures, add from tomorrow
      if (results.length < count) {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);

        for (let i = 0; i < dailyDepartures.length && results.length < count; i++) {
          const departureTime = dailyDepartures[i];
          const departureMinutes = this.parseTimeToMinutes(departureTime);

          const departureDate = new Date(tomorrow);
          departureDate.setHours(Math.floor(departureMinutes / 60));
          departureDate.setMinutes(departureMinutes % 60);
          departureDate.setSeconds(0);
          departureDate.setMilliseconds(0);

          const minutesUntil = Math.floor((departureDate.getTime() - now.getTime()) / (1000 * 60));

          results.push({
            departure_time: `${departureTime} (Tomorrow)`,
            departure_datetime: departureDate,
            minutes_until_departure: minutesUntil,
            is_next_available: false,
          });
        }
      }

      return results;
    } catch (error) {
      logger.error('Error getting upcoming departures:', error);
      return [];
    }
  }

  /**
   * Get all departures for the day
   */
  public getAllDeparturesToday(
    distanceKm: number,
    transportMode: 'bus' | 'train' | 'car',
    _currentTime?: Date
  ): string[] {
    try {
      if (transportMode === 'car') {
        return ['Available 24/7 on demand'];
      }

      const config = this.getTimetableConfig(distanceKm);
      return this.generateDailyDepartures(config);
    } catch (error) {
      logger.error('Error getting all departures:', error);
      return [];
    }
  }

  /**
   * Get frequency information as human-readable text
   */
  public getFrequencyInfo(distanceKm: number): string {
    const config = this.getTimetableConfig(distanceKm);
    const frequency = config.frequency_minutes;

    if (frequency >= 60) {
      const hours = frequency / 60;
      return `Every ${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
      return `Every ${frequency} minutes`;
    }
  }

  /**
   * Format departure time for display
   */
  public formatDepartureForDisplay(departure: DepartureTime): string {
    if (departure.departure_time === 'On Demand') {
      return 'Available on demand - book anytime';
    }

    const hours = Math.floor(departure.minutes_until_departure / 60);
    const minutes = departure.minutes_until_departure % 60;

    let timeUntilText = '';
    if (hours > 0) {
      timeUntilText = `in ${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      timeUntilText = `in ${minutes} minutes`;
    } else {
      timeUntilText = 'departing now';
    }

    return `${departure.departure_time} (${timeUntilText})`;
  }
}
