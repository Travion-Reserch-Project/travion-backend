import { body, param, query } from 'express-validator';

/**
 * Validator for reporting a new incident
 */
export const reportIncidentValidator = [
  body('incident_type')
    .notEmpty()
    .withMessage('Incident type is required')
    .isIn([
      'accident',
      'road_block',
      'traffic_jam',
      'pothole',
      'flooding',
      'landslide',
      'construction',
      'other',
    ])
    .withMessage('Invalid incident type'),
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be between 5 and 200 characters'),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ min: 10, max: 2000 })
    .withMessage('Description must be between 10 and 2000 characters'),
  body('location.latitude')
    .notEmpty()
    .withMessage('Latitude is required')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('location.longitude')
    .notEmpty()
    .withMessage('Longitude is required')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  body('location.address').optional().isString().withMessage('Address must be a string'),
  body('location.city').optional().isString().withMessage('City must be a string'),
  body('location.district').optional().isString().withMessage('District must be a string'),
  body('severity')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Invalid severity level'),
  body('affected_routes').optional().isArray().withMessage('Affected routes must be an array'),
  body('attachments').optional().isObject().withMessage('Attachments must be an object'),
  body('attachments.image_urls').optional().isArray().withMessage('Image URLs must be an array'),
  body('attachments.video_urls').optional().isArray().withMessage('Video URLs must be an array'),
];

/**
 * Validator for get incidents near location
 */
export const getIncidentsNearLocationValidator = [
  query('latitude')
    .notEmpty()
    .withMessage('Latitude is required')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  query('longitude')
    .notEmpty()
    .withMessage('Longitude is required')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  query('radius_km')
    .optional()
    .isFloat({ min: 0.1, max: 50 })
    .withMessage('Radius must be between 0.1 and 50 km'),
];

/**
 * Validator for get incidents for a route (by coordinates)
 */
export const getIncidentsForRouteValidator = [
  query('origin_lat')
    .notEmpty()
    .withMessage('Origin latitude is required')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Origin latitude must be between -90 and 90'),
  query('origin_lng')
    .notEmpty()
    .withMessage('Origin longitude is required')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Origin longitude must be between -180 and 180'),
  query('dest_lat')
    .notEmpty()
    .withMessage('Destination latitude is required')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Destination latitude must be between -90 and 90'),
  query('dest_lng')
    .notEmpty()
    .withMessage('Destination longitude is required')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Destination longitude must be between -180 and 180'),
  query('radius_km')
    .optional()
    .isFloat({ min: 0.1, max: 50 })
    .withMessage('Radius must be between 0.1 and 50 km'),
];

/**
 * Validator for get incidents by route name
 */
export const getIncidentsByRouteNameValidator = [
  param('routeName')
    .notEmpty()
    .withMessage('Route name is required')
    .isString()
    .withMessage('Route name must be a string')
    .isLength({ min: 2 })
    .withMessage('Route name must be at least 2 characters'),
];

/**
 * Validator for get incidents by district
 */
export const getIncidentsByDistrictValidator = [
  param('district')
    .notEmpty()
    .withMessage('District name is required')
    .isString()
    .withMessage('District must be a string')
    .isLength({ min: 2 })
    .withMessage('District name must be at least 2 characters'),
];

/**
 * Validator for incident ID in params
 */
export const incidentIdValidator = [
  param('incidentId')
    .notEmpty()
    .withMessage('Incident ID is required')
    .isString()
    .withMessage('Incident ID must be a string'),
];

/**
 * Validator for resolve incident
 */
export const resolveIncidentValidator = [
  param('incidentId')
    .notEmpty()
    .withMessage('Incident ID is required')
    .isString()
    .withMessage('Incident ID must be a string'),
  body('resolution_notes')
    .optional()
    .isString()
    .withMessage('Resolution notes must be a string')
    .isLength({ max: 1000 })
    .withMessage('Resolution notes must not exceed 1000 characters'),
];

/**
 * Validator for pagination (used in getHighPriorityIncidents, getUserReportedIncidents)
 */
export const incidentPaginationValidator = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];
