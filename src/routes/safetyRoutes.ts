import { Router } from 'express';
import { SafetyController } from '../controllers/SafetyController';
import { authenticate } from '../middleware/auth';
import { apiLimiter } from '../config/rateLimiter';
import { body, query } from 'express-validator';

const router = Router();
const safetyController = new SafetyController();

/**
 * POST /api/v1/safety/predictions
 * Get safety predictions for a location using Google Maps + ML Model
 * Public endpoint - no authentication required for safety information
 * Request body: { latitude: number, longitude: number }
 * Response: predictions, alerts, location info, extracted features
 */
router.post(
  '/predictions',
  apiLimiter,
  [
    body('latitude')
      .isFloat({ min: -90, max: 90 })
      .withMessage('Latitude must be between -90 and 90'),
    body('longitude')
      .isFloat({ min: -180, max: 180 })
      .withMessage('Longitude must be between -180 and 180'),
  ],
  safetyController.getSafetyPredictions
);

/**
 * GET /api/v1/safety/history
 * Get user's safety alert history (requires authentication)
 */
router.get(
  '/history',
  authenticate as any,
  apiLimiter,
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
    query('skip').optional().isInt({ min: 0 }).withMessage('Skip must be >= 0'),
  ],
  safetyController.getAlertHistory
);

/**
 * GET /api/v1/safety/high-risk
 * Get high risk alerts for user (requires authentication)
 */
router.get(
  '/high-risk',
  authenticate as any,
  apiLimiter,
  [query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be 1-50')],
  safetyController.getHighRiskAlerts
);

/**
 * GET /api/v1/safety/nearby
 * Get alerts near a location (requires authentication)
 */
router.get(
  '/nearby',
  authenticate as any,
  apiLimiter,
  [
    query('latitude').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
    query('longitude').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
    query('radius')
      .optional()
      .isFloat({ min: 0.1, max: 100 })
      .withMessage('Radius must be 0.1-100 km'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
  ],
  safetyController.getNearbyAlerts
);

/**
 * GET /api/v1/safety/health
 * Check health of Safety ML service
 */
router.get('/health', safetyController.healthCheck);

export { router as safetyRoutes };
