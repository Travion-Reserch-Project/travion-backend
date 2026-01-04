import axios from 'axios';
import { logger } from '../config/logger';

export interface TimetableRequest {
  service_id: string;
  departure_date: string; // YYYY-MM-DD
  departure_time: string; // HH:MM (24h)
}

export interface Timetable {
  success: boolean;
  service_id: string;
  operator?: string;
  mode?: string;
  departure_date: string;
  departure_time: string;
  schedule?: Array<{
    scheduled_time: string;
    estimated_time?: string;
    stops?: Array<{
      stop_name: string;
      arrival_time: string;
      departure_time?: string;
    }>;
  }>;
  message?: string;
  error?: string;
}

export class TimetableService {
  private timetableApiUrl: string;
  private timeout: number = 15000;

  constructor(timetableApiUrl?: string) {
    this.timetableApiUrl =
      timetableApiUrl || process.env.TIMETABLE_API_URL || 'http://localhost:8001/api/timetable';
  }

  async getTimetable(request: TimetableRequest): Promise<Timetable> {
    try {
      logger.info('TimetableService: Fetching timetable', {
        service_id: request.service_id,
        departure_date: request.departure_date,
        departure_time: request.departure_time,
      });

      const response = await axios.get<Timetable>(this.timetableApiUrl, {
        params: {
          service_id: request.service_id,
          departure_date: request.departure_date,
          departure_time: request.departure_time,
        },
        timeout: this.timeout,
      });

      logger.info('TimetableService: Timetable fetched successfully', {
        service_id: request.service_id,
        hasSchedule: Boolean(response.data?.schedule),
      });

      return response.data;
    } catch (error: any) {
      const message = error?.message || 'Failed to fetch timetable';
      logger.error('TimetableService: Error fetching timetable', {
        service_id: request.service_id,
        message,
        code: error?.code,
      });

      // Return error response
      return {
        success: false,
        service_id: request.service_id,
        departure_date: request.departure_date,
        departure_time: request.departure_time,
        error: message,
      };
    }
  }
}
