import { Router } from 'express';
import { IncidentController } from '../controllers/IncidentController';
import { authenticate } from '../../../../shared/middleware/auth';
import {
  reportIncidentValidator,
  getIncidentsNearLocationValidator,
  getIncidentsForRouteValidator,
  getIncidentsByRouteNameValidator,
  getIncidentsByDistrictValidator,
  incidentIdValidator,
  resolveIncidentValidator,
  incidentPaginationValidator,
} from '../validators/incidentValidator';

const router = Router();
const incidentController = new IncidentController();

// All incident routes require authentication
router.use(authenticate as any);

/**
 * @route   POST /api/v1/incidents/report
 * @desc    Report a new road incident (accident, roadblock, etc.)
 * @access  Private
 */
router.post('/report', reportIncidentValidator, incidentController.reportIncident);

/**
 * @route   GET /api/v1/incidents/near-location
 * @desc    Get all active incidents near user's location
 * @access  Private
 */
router.get(
  '/near-location',
  getIncidentsNearLocationValidator,
  incidentController.getIncidentsNearLocation
);

/**
 * @route   GET /api/v1/incidents/route
 * @desc    Get incidents affecting a route by coordinates
 * @access  Private
 * @query   origin_lat, origin_lng, dest_lat, dest_lng, radius_km (optional)
 */
router.get('/route', getIncidentsForRouteValidator, incidentController.getIncidentsForRoute);

/**
 * @route   GET /api/v1/incidents/route-name/:routeName
 * @desc    Get incidents by route name (e.g., "A1 Highway", "Colombo-Kandy")
 * @access  Private
 */
router.get(
  '/route-name/:routeName',
  getIncidentsByRouteNameValidator,
  incidentController.getIncidentsByRouteName
);

/**
 * @route   GET /api/v1/incidents/district/:district
 * @desc    Get incidents in a specific district
 * @access  Private
 */
router.get(
  '/district/:district',
  getIncidentsByDistrictValidator,
  incidentController.getIncidentsByDistrict
);

/**
 * @route   POST /api/v1/incidents/:incidentId/confirm
 * @desc    Confirm/verify an incident reported by another user
 * @access  Private
 */
router.post('/:incidentId/confirm', incidentIdValidator, incidentController.confirmIncident);

/**
 * @route   POST /api/v1/incidents/:incidentId/resolve
 * @desc    Mark an incident as resolved (admin/authorized users)
 * @access  Private
 */
router.post('/:incidentId/resolve', resolveIncidentValidator, incidentController.resolveIncident);

/**
 * @route   GET /api/v1/incidents/priority/high
 * @desc    Get critical and high-severity incidents
 * @access  Private
 */
router.get(
  '/priority/high',
  incidentPaginationValidator,
  incidentController.getHighPriorityIncidents
);

/**
 * @route   GET /api/v1/incidents/statistics
 * @desc    Get incident statistics (total, by severity, by type)
 * @access  Private
 */
router.get('/statistics', incidentController.getIncidentStatistics);

/**
 * @route   GET /api/v1/incidents/my-reports
 * @desc    Get incidents reported by the current user
 * @access  Private
 */
router.get('/my-reports', incidentPaginationValidator, incidentController.getUserReportedIncidents);

export { router as incidentRoutes };
