import { body, param, query } from 'express-validator';

export const chatMessageValidator = [
  body('message')
    .trim()
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ min: 1, max: 2000 })
    .withMessage('Message must be between 1 and 2000 characters'),
  body('conversation_id').optional().isString().withMessage('Conversation ID must be a string'),
  body('language')
    .optional()
    .isIn(['en', 'si', 'ta'])
    .withMessage('Language must be en, si, or ta'),
  body('current_location').optional().isObject().withMessage('Current location must be an object'),
  body('current_location.lat')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('current_location.lng')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
];

export const conversationIdValidator = [
  param('conversationId')
    .notEmpty()
    .withMessage('Conversation ID is required')
    .isString()
    .withMessage('Conversation ID must be a string'),
];

export const paginationValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be at least 1'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];
