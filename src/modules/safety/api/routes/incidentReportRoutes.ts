import { Router } from 'express';
import { IncidentReportController } from '../controllers/IncidentReportController';
import { authenticate } from '../../../../shared/middleware/auth';
import { apiLimiter } from '../../../../shared/config/rateLimiter';
import { body, query, param } from 'express-validator';

const router = Router();
const incidentReportController = new IncidentReportController();

/**
 * POST /api/v1/incidents/report
 * Create a new incident report
 * Public endpoint - authentication optional (supports anonymous reports)
 */
router.post(
  '/report',
  apiLimiter,
  [
    body('incidentType')
      .isString()
      .isIn([
        'Pickpocketing',
        'Bag Snatching',
        'Scam',
        'Money Theft',
        'Harassment',
        'Extortion',
        'Theft',
        'Other',
      ])
      .withMessage('Invalid incident type'),
    body('location.address').isString().notEmpty().withMessage('Location address is required'),
    body('location.latitude')
      .optional()
      .isFloat({ min: -90, max: 90 })
      .withMessage('Invalid latitude'),
    body('location.longitude')
      .optional()
      .isFloat({ min: -180, max: 180 })
      .withMessage('Invalid longitude'),
    body('incidentTime').isISO8601().withMessage('Invalid incident time format'),
    body('description')
      .isString()
      .isLength({ min: 10, max: 2000 })
      .withMessage('Description must be between 10 and 2000 characters'),
    body('photoUrl').optional().isURL().withMessage('Invalid photo URL'),
    body('isAnonymous').optional().isBoolean().withMessage('isAnonymous must be a boolean'),
  ],
  incidentReportController.createReport
);

/**
 * GET /api/v1/incidents/:reportId
 * Get incident report by ID
 */
router.get(
  '/:reportId',
  apiLimiter,
  [param('reportId').isMongoId().withMessage('Invalid report ID')],
  incidentReportController.getReportById
);

/**
 * GET /api/v1/incidents/user/reports
 * Get user's incident reports (requires authentication)
 */
router.get(
  '/user/reports',
  authenticate as any,
  apiLimiter,
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
    query('skip').optional().isInt({ min: 0 }).withMessage('Skip must be >= 0'),
  ],
  incidentReportController.getUserReports
);

/**
 * GET /api/v1/incidents/nearby
 * Get nearby incident reports
 */
router.get(
  '/nearby',
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
  incidentReportController.getNearbyReports
);

/**
 * GET /api/v1/incidents/type/:incidentType
 * Get reports by incident type
 */
router.get(
  '/type/:incidentType',
  apiLimiter,
  [
    param('incidentType')
      .isIn([
        'Pickpocketing',
        'Bag Snatching',
        'Scam',
        'Money Theft',
        'Harassment',
        'Extortion',
        'Theft',
        'Other',
      ])
      .withMessage('Invalid incident type'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
    query('skip').optional().isInt({ min: 0 }).withMessage('Skip must be >= 0'),
  ],
  incidentReportController.getReportsByType
);

/**
 * GET /api/v1/incidents/statistics
 * Get statistics by incident type
 */
router.get('/statistics', apiLimiter, incidentReportController.getStatistics);

/**
 * GET /api/v1/incidents/all
 * Get all reports with pagination (for admin)
 */
router.get(
  '/all',
  authenticate as any,
  apiLimiter,
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
    query('skip').optional().isInt({ min: 0 }).withMessage('Skip must be >= 0'),
    query('status')
      .optional()
      .isIn(['pending', 'verified', 'rejected'])
      .withMessage('Invalid status'),
    query('incidentType')
      .optional()
      .isIn([
        'Pickpocketing',
        'Bag Snatching',
        'Scam',
        'Money Theft',
        'Harassment',
        'Extortion',
        'Theft',
        'Other',
      ])
      .withMessage('Invalid incident type'),
  ],
  incidentReportController.getAllReports
);

export { router as incidentReportRoutes };
