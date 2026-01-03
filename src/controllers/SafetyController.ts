import { Response, NextFunction } from 'express';
import { SafetyService } from '../services/SafetyService';
import { AuthRequest } from '../middleware/auth';
import { validationResult } from 'express-validator';

export class SafetyController {
  private safetyService: SafetyService;

  constructor() {
    this.safetyService = new SafetyService();
  }

  /**
   * Get safety predictions using Google Maps + ML Model
   * Request body: { latitude: number, longitude: number }
   * Flow: lat/lon → Google Maps (features) → ML Model → Frontend alerts
   * Public endpoint - userId is optional (will be null for unauthenticated requests)
   */
  getSafetyPredictions = async (
    req: AuthRequest,
    res: Response,
    _next: NextFunction
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

      // userId is optional for public endpoint - will be null if not authenticated
      const userId = req.user?.userId || null;

      const { latitude, longitude } = req.body;

      // Validate coordinates
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid coordinates',
            details: 'Latitude must be between -90 and 90, longitude between -180 and 180',
          },
        });
        return;
      }

      // Get predictions (Google Maps → ML Model)
      const result = await this.safetyService.getSafetyPredictions(userId, latitude, longitude);

      res.status(200).json(result);
    } catch (error) {
      console.error('[SafetyController] Error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: (error as Error).message || 'Failed to get safety predictions',
        },
      });
    }
  };

  /**
   * Get user's alert history
   */
  getAlertHistory = async (req: AuthRequest, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { message: 'Authentication required' },
        });
        return;
      }

      const limit = parseInt(req.query.limit as string) || 10;
      const skip = parseInt(req.query.skip as string) || 0;

      const history = await this.safetyService.getUserAlertHistory(userId, limit, skip);

      res.status(200).json({
        success: true,
        data: history,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { message: (error as Error).message || 'Failed to get alert history' },
      });
    }
  };

  /**
   * Get high risk alerts for user
   */
  getHighRiskAlerts = async (
    req: AuthRequest,
    res: Response,
    _next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { message: 'Authentication required' },
        });
        return;
      }

      const limit = parseInt(req.query.limit as string) || 5;
      const alerts = await this.safetyService.getHighRiskAlerts(userId, limit);

      res.status(200).json({
        success: true,
        data: alerts,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { message: (error as Error).message || 'Failed to get high risk alerts' },
      });
    }
  };

  /**
   * Get nearby alerts
   */
  getNearbyAlerts = async (req: AuthRequest, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const { latitude, longitude, radius, limit } = req.query;

      if (!latitude || !longitude) {
        res.status(400).json({
          success: false,
          error: { message: 'Latitude and longitude are required' },
        });
        return;
      }

      const alerts = await this.safetyService.getNearbyAlerts(
        parseFloat(latitude as string),
        parseFloat(longitude as string),
        radius ? parseFloat(radius as string) : 5,
        limit ? parseInt(limit as string) : 10
      );

      res.status(200).json({
        success: true,
        data: alerts,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { message: (error as Error).message || 'Failed to get nearby alerts' },
      });
    }
  };

  /**
   * Health check for safety ML service
   */
  healthCheck = async (_req: AuthRequest, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const health = await this.safetyService.checkHealth();

      res.status(health.status === 'healthy' ? 200 : 503).json({
        success: health.status === 'healthy',
        service: 'Safety ML Service',
        ...health,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { message: (error as Error).message || 'Health check failed' },
      });
    }
  };
}
