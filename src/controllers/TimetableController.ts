import { Response, NextFunction } from 'express';
import { TimetableService } from '../services/TimetableService';
import { AuthRequest } from '../middleware/auth';
import { validationResult } from 'express-validator';
import { logger } from '../config/logger';

export class TimetableController {
  private timetableService: TimetableService;

  constructor() {
    this.timetableService = new TimetableService();
  }

  getTimetable = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      logger.info('timetable controller: received request', {
        path: req.path,
        method: req.method,
        query: req.query,
        queryKeys: Object.keys(req.query),
      });

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn('timetable controller: validation failed', {
          path: req.path,
          method: req.method,
          errorArray: errors.array(),
          errorCount: errors.array().length,
          query: req.query,
        });
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid query parameters',
            details: errors.array(),
          },
        });
        return;
      }

      logger.info('timetable controller: validation passed');

      const { service_id, departure_date, departure_time } = req.query as {
        service_id: string;
        departure_date: string;
        departure_time: string;
      };

      logger.info('timetable request', {
        path: req.path,
        userId: req.user?.userId,
        service_id,
        departure_date,
        departure_time,
      });

      const timetable = await this.timetableService.getTimetable({
        service_id,
        departure_date,
        departure_time,
      });

      logger.info('timetable response', {
        service_id,
        success: timetable.success,
        hasSchedule: Boolean(timetable.schedule),
      });

      res.status(timetable.success ? 200 : 400).json({
        success: timetable.success,
        data: timetable,
      });
    } catch (error) {
      logger.error('timetable error', { error });
      next(error);
    }
  };
}
