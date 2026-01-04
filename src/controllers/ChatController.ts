import { Response, NextFunction } from 'express';
import { ChatService } from '../services/ChatService';
import { DataExportService } from '../services/DataExportService';
import { AuthRequest } from '../middleware/auth';
import { validationResult } from 'express-validator';
import { MLService } from '../services/MLService';
import { logger } from '../config/logger';

export class ChatController {
  private chatService: ChatService;
  private dataExportService: DataExportService;

  constructor() {
    this.chatService = new ChatService();
    this.dataExportService = new DataExportService();
  }

  // Process a chat query
  processQuery = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn('chat/recommend validation failed', {
          path: req.path,
          method: req.method,
          errors: errors.array(),
          bodyKeys: Object.keys(req.body || {}),
        });
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid request data',
            details: errors.array(),
          },
        });
        return;
      }

      const userId = req.user?.userId;
      if (!userId) {
        logger.warn('chat/recommend auth missing', { path: req.path, method: req.method });
        res.status(401).json({
          success: false,
          error: {
            message: 'Authentication required',
            code: 'AUTH_REQUIRED',
          },
        });
        return;
      }

      const { query, userLocation, sessionId, deviceInfo } = req.body;

      const result = await this.chatService.processQuery(userId, {
        query,
        userLocation,
        sessionId,
        deviceInfo,
      });

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  // Get structured travel recommendation via LLM extraction
  getTravelRecommendation = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid request data',
            details: errors.array(),
          },
        });
        return;
      }

      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            message: 'Authentication required',
            code: 'AUTH_REQUIRED',
          },
        });
        return;
      }

      const {
        message,
        origin,
        destination,
        departureDate,
        departureTime,
        state,
        answeredField,
        pendingFields,
        currentField,
      } = req.body as {
        message: string;
        origin?: string;
        destination?: string;
        departureDate?: string;
        departureTime?: string;
        state?: any;
        answeredField?: 'origin' | 'destination' | 'departureDate' | 'departureTime';
        pendingFields?: Array<'origin' | 'destination' | 'departureDate' | 'departureTime'>;
        currentField?: 'origin' | 'destination' | 'departureDate' | 'departureTime';
      };

      logger.info('chat/recommend request', {
        path: req.path,
        userId,
        hasSessionId: Boolean(req.body.sessionId),
        answeredField,
        currentField,
        pendingFieldsLength: pendingFields?.length,
        bodyKeys: Object.keys(req.body || {}),
      });

      const result = await this.chatService.getTravelRecommendation(userId, {
        message,
        origin,
        destination,
        departureDate,
        departureTime,
        state,
        answeredField,
        pendingFields,
        currentField,
        sessionId: req.body.sessionId,
        deviceInfo: req.body.deviceInfo,
      });

      logger.info('chat/recommend response', {
        status: result?.data?.status,
        missing: result?.data?.missingFields,
        nextField: result?.data?.nextField,
        hasRecommendation: Boolean(result?.data?.recommendation),
        sessionId: result?.data?.sessionId,
      });

      // Always return 200; let client handle success/error via result.success flag
      res.status(200).json(result);
    } catch (error) {
      logger.error('chat/recommend error', { error });
      next(error);
    }
  };

  /**
   * Submit feedback for a query
   */
  submitFeedback = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid request data',
            details: errors.array(),
          },
        });
        return;
      }

      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            message: 'Authentication required',
            code: 'AUTH_REQUIRED',
          },
        });
        return;
      }

      const { queryId, rating, feedback, wasHelpful } = req.body;

      await this.chatService.submitQueryFeedback(userId, {
        queryId,
        rating,
        feedback,
        wasHelpful,
      });

      res.status(200).json({
        success: true,
        message: 'Feedback submitted successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Submit session feedback
   */
  submitSessionFeedback = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid request data',
            details: errors.array(),
          },
        });
        return;
      }

      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            message: 'Authentication required',
            code: 'AUTH_REQUIRED',
          },
        });
        return;
      }

      const { sessionId, satisfactionScore } = req.body;

      await this.chatService.submitSessionFeedback(userId, {
        sessionId,
        satisfactionScore,
      });

      res.status(200).json({
        success: true,
        message: 'Session feedback submitted successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get chat history
   */
  getChatHistory = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            message: 'Authentication required',
            code: 'AUTH_REQUIRED',
          },
        });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await this.chatService.getChatHistory(userId, page, limit);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * End a chat session
   */
  endSession = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid request data',
            details: errors.array(),
          },
        });
        return;
      }

      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            message: 'Authentication required',
            code: 'AUTH_REQUIRED',
          },
        });
        return;
      }

      const { sessionId } = req.body;

      await this.chatService.endSession(userId, sessionId);

      res.status(200).json({
        success: true,
        message: 'Session ended successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get chat analytics (admin only)
   */
  getAnalytics = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            message: 'Authentication required',
            code: 'AUTH_REQUIRED',
          },
        });
        return;
      }

      // For now, allow users to see their own analytics
      // In the future, you might want to add role-based access control
      const targetUserId = (req.query.userId as string) || userId;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      // Only allow users to see their own analytics unless they're admin
      const analyticsUserId = targetUserId === userId ? userId : undefined;

      const result = await this.chatService.getAnalytics(analyticsUserId, startDate, endDate);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Health check for ML service
   */
  healthCheck = async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const mlService = new MLService();
      const health = await mlService.checkHealth();

      res.status(200).json({
        success: true,
        data: {
          mlService: health,
          backend: {
            status: 'healthy',
            timestamp: new Date(),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Export training data (admin only - you might want to add role-based access control)
   */
  exportTrainingData = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            message: 'Authentication required',
            code: 'AUTH_REQUIRED',
          },
        });
        return;
      }

      const {
        startDate,
        endDate,
        queryTypes,
        includeRatedOnly,
        minRating,
        format = 'json',
        includePersonalData = false,
      } = req.query;

      const options = {
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        queryTypes: queryTypes ? (queryTypes as string).split(',') : undefined,
        includeRatedOnly: includeRatedOnly === 'true',
        minRating: minRating ? parseInt(minRating as string) : undefined,
        format: format as 'json' | 'csv' | 'jsonl',
        includePersonalData: includePersonalData === 'true',
      };

      const exportPath = await this.dataExportService.exportTrainingData(options);

      res.status(200).json({
        success: true,
        data: {
          exportPath,
          message: 'Training data exported successfully',
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get training data statistics
   */
  getTrainingDataStats = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            message: 'Authentication required',
            code: 'AUTH_REQUIRED',
          },
        });
        return;
      }

      const { startDate, endDate, queryTypes, includeRatedOnly, minRating } = req.query;

      const options = {
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        queryTypes: queryTypes ? (queryTypes as string).split(',') : undefined,
        includeRatedOnly: includeRatedOnly === 'true',
        minRating: minRating ? parseInt(minRating as string) : undefined,
      };

      const stats = await this.dataExportService.getTrainingDataStats(options);

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  };
}
