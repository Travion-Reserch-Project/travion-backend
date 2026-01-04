import { body, query } from 'express-validator';

export const chatQueryValidator = [
  body('query')
    .isString()
    .notEmpty()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Query must be a string between 1 and 2000 characters'),

  body('userLocation').optional().isObject().withMessage('User location must be an object'),

  body('userLocation.latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be a number between -90 and 90'),

  body('userLocation.longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be a number between -180 and 180'),

  body('userLocation.address')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Address must be a string with maximum 500 characters'),

  body('sessionId').optional().isUUID().withMessage('Session ID must be a valid UUID'),

  body('deviceInfo').optional().isObject().withMessage('Device info must be an object'),

  body('deviceInfo.platform')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('Platform must be a string with maximum 50 characters'),

  body('deviceInfo.version')
    .optional()
    .isString()
    .isLength({ max: 20 })
    .withMessage('Version must be a string with maximum 20 characters'),
];

export const chatFeedbackValidator = [
  body('queryId').isUUID().withMessage('Query ID must be a valid UUID'),

  body('rating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be an integer between 1 and 5'),

  body('feedback')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('Feedback must be a string with maximum 1000 characters'),

  body('wasHelpful').optional().isBoolean().withMessage('WasHelpful must be a boolean'),
];

export const sessionFeedbackValidator = [
  body('sessionId').isUUID().withMessage('Session ID must be a valid UUID'),

  body('satisfactionScore')
    .isInt({ min: 1, max: 5 })
    .withMessage('Satisfaction score must be an integer between 1 and 5'),
];

export const endSessionValidator = [
  body('sessionId').isUUID().withMessage('Session ID must be a valid UUID'),
];

export const chatHistoryValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be an integer between 1 and 100'),
];

export const analyticsValidator = [
  query('userId').optional().isMongoId().withMessage('User ID must be a valid MongoDB ObjectId'),

  query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO 8601 date'),

  query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO 8601 date'),
];

export const travelRecommendationValidator = [
  body('message')
    .isString()
    .notEmpty()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Message must be provided'),

  body('origin')
    .optional()
    .isString()
    .isLength({ max: 200 })
    .withMessage('Origin must be a string'),

  body('destination')
    .optional()
    .isString()
    .isLength({ max: 200 })
    .withMessage('Destination must be a string'),

  body('departureDate')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('Departure date must be a string'),

  body('departureTime')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('Departure time must be a string'),

  body('state').optional(),

  body('state.origin').optional().isString().isLength({ max: 200 }),
  body('state.destination').optional().isString().isLength({ max: 200 }),
  body('state.departureDate').optional().isString().isLength({ max: 50 }),
  body('state.departureTime').optional().isString().isLength({ max: 50 }),

  body('answeredField').optional(),

  body('pendingFields').optional(),

  body('pendingFields.*').optional(),

  body('currentField').optional(),

  body('sessionId').optional(),
  body('deviceInfo').optional(),
  body('deviceInfo.platform').optional(),
  body('deviceInfo.version').optional(),
];

export const updateChatPreferencesValidator = [
  body('language')
    .optional()
    .isString()
    .isLength({ min: 2, max: 5 })
    .withMessage('Language must be a string between 2 and 5 characters'),

  body('enableNotifications')
    .optional()
    .isBoolean()
    .withMessage('Enable notifications must be a boolean'),
];

export const timetableQueryValidator = [
  query('service_id').trim().notEmpty().withMessage('Service ID is required'),

  query('departure_date')
    .trim()
    .notEmpty()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Departure date must be in YYYY-MM-DD format'),

  query('departure_time')
    .trim()
    .notEmpty()
    .matches(/^([01]\d|2[0-3]):[0-5]\d$/)
    .withMessage('Departure time must be in HH:MM 24-hour format'),
];
