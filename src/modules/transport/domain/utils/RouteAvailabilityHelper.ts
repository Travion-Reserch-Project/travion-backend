import { ITransportRoute } from '../models/TransportRoute';
import { logger } from '../../../../shared/config/logger';

/**
 * Helper to check route availability and operational status
 */
export class RouteAvailabilityHelper {
  /**
   * Check if a route is currently available based on schedule and time
   */
  static isRouteAvailable(route: ITransportRoute, currentTime: Date = new Date()): boolean {
    // If no schedule details, assume available for database routes
    if (!route.route_details?.schedule) {
      return true;
    }

    const schedule = route.route_details.schedule;

    // Parse schedule format: "05:00-22:00" or "24/7" or specific times
    if (schedule.includes('24/7') || schedule.includes('24 hours')) {
      return true;
    }

    // Check if it's a specific time schedule (e.g., "06:00", "08:30")
    if (schedule.match(/^\d{2}:\d{2}$/)) {
      // Single departure time - check if within 2 hours window
      const [hours, minutes] = schedule.split(':').map(Number);
      const currentHours = currentTime.getHours();
      const currentMinutes = currentTime.getMinutes();
      const scheduledTotalMinutes = hours * 60 + minutes;
      const currentTotalMinutes = currentHours * 60 + currentMinutes;

      // Route is available if departure is within next 2 hours
      const diff = scheduledTotalMinutes - currentTotalMinutes;
      return diff >= 0 && diff <= 120;
    }

    // Check time range format: "05:00-22:00"
    const rangeMatch = schedule.match(/(\d{2}):(\d{2})-(\d{2}):(\d{2})/);
    if (rangeMatch) {
      const [, startHour, startMin, endHour, endMin] = rangeMatch.map(Number);
      const currentHours = currentTime.getHours();
      const currentMinutes = currentTime.getMinutes();

      const startTime = startHour * 60 + startMin;
      const endTime = endHour * 60 + endMin;
      const currentTimeMinutes = currentHours * 60 + currentMinutes;

      // Handle overnight schedules (e.g., 22:00-06:00)
      if (endTime < startTime) {
        return currentTimeMinutes >= startTime || currentTimeMinutes <= endTime;
      }

      return currentTimeMinutes >= startTime && currentTimeMinutes <= endTime;
    }

    // If we can't parse the schedule, assume available
    logger.warn(`Could not parse schedule format: ${schedule} for route ${route.route_id}`);
    return true;
  }

  /**
   * Filter routes that are currently available
   */
  static filterAvailableRoutes(
    routes: ITransportRoute[],
    currentTime: Date = new Date()
  ): ITransportRoute[] {
    return routes.filter((route) => this.isRouteAvailable(route, currentTime));
  }

  /**
   * Check if route has good frequency (multiple departures per day)
   */
  static hasGoodFrequency(route: ITransportRoute): boolean {
    const frequency = route.route_details?.frequency?.toLowerCase() || '';

    // Check for high-frequency indicators
    if (
      frequency.includes('every') ||
      frequency.includes('frequent') ||
      frequency.includes('regular') ||
      frequency.includes('minutes')
    ) {
      return true;
    }

    // Check for multiple buses/trains per day
    if (frequency.includes('daily') && !frequency.includes('1 ')) {
      return true;
    }

    // Low frequency indicators
    if (frequency.includes('1 bus') || frequency.includes('1 train')) {
      return false;
    }

    // Default to true if no frequency info
    return true;
  }

  /**
   * Get route availability message for user
   */
  static getAvailabilityMessage(route: ITransportRoute): string {
    const schedule = route.route_details?.schedule;
    const frequency = route.route_details?.frequency;

    if (!schedule && !frequency) {
      return 'Schedule information not available';
    }

    let message = '';

    if (frequency) {
      message += `${frequency}`;
    }

    if (schedule) {
      if (message) message += ', ';
      message += `operates ${schedule}`;
    }

    return message;
  }

  /**
   * Sort routes by preference: available > high frequency > low frequency
   */
  static sortByAvailability(
    routes: ITransportRoute[],
    currentTime: Date = new Date()
  ): ITransportRoute[] {
    return routes.sort((a, b) => {
      // First priority: currently available routes
      const aAvailable = this.isRouteAvailable(a, currentTime);
      const bAvailable = this.isRouteAvailable(b, currentTime);
      if (aAvailable && !bAvailable) return -1;
      if (!aAvailable && bAvailable) return 1;

      // Second priority: high frequency routes
      const aFreq = this.hasGoodFrequency(a);
      const bFreq = this.hasGoodFrequency(b);
      if (aFreq && !bFreq) return -1;
      if (!aFreq && bFreq) return 1;

      // Third priority: shorter travel time
      return a.estimated_time_min - b.estimated_time_min;
    });
  }

  /**
   * Filter out routes that are not operational today (e.g., weekend-only routes on weekdays)
   */
  static filterOperationalRoutes(
    routes: ITransportRoute[],
    currentTime: Date = new Date()
  ): ITransportRoute[] {
    const dayOfWeek = currentTime.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    return routes.filter((route) => {
      const frequency = route.route_details?.frequency?.toLowerCase() || '';

      // Filter out weekend-only routes on weekdays
      if (!isWeekend && frequency.includes('weekend only')) {
        return false;
      }

      // Filter out weekday-only routes on weekends
      if (isWeekend && frequency.includes('weekday only')) {
        return false;
      }

      return true;
    });
  }
}
