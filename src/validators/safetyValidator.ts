import { body, query } from 'express-validator';

export const safetyAlertsValidator = [
  body('lat').isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
  body('lon')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  body('user_location').optional().isString().withMessage('User location must be a string'),
  body('is_beach').optional().isInt({ min: 0, max: 1 }).withMessage('is_beach must be 0 or 1'),
  body('is_crowded').optional().isInt({ min: 0, max: 1 }).withMessage('is_crowded must be 0 or 1'),
  body('is_tourist_place')
    .optional()
    .isInt({ min: 0, max: 1 })
    .withMessage('is_tourist_place must be 0 or 1'),
  body('is_transit').optional().isInt({ min: 0, max: 1 }).withMessage('is_transit must be 0 or 1'),
  body('police_nearby')
    .optional()
    .isInt({ min: 0, max: 1 })
    .withMessage('police_nearby must be 0 or 1'),
  body('area_cluster').optional().isInt().withMessage('area_cluster must be an integer'),
];

export const quickSafetyAlertsValidator = [
  query('lat').isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
  query('lon')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
];
