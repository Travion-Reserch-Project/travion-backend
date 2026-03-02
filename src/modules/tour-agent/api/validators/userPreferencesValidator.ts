/**
 * User Preferences Validation Schemas
 * Joi validation schemas for User Preferences API requests
 */

import Joi from 'joi';

// ============================================================================
// COMMON SCHEMAS
// ============================================================================

/**
 * MongoDB ObjectId validation
 * Exported for use in other validators
 */
export const objectIdSchema = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .messages({
    'string.pattern.base': 'Invalid ID format',
  });

/**
 * Preference score validation (0-1 range)
 */
const preferenceScoreSchema = Joi.number().min(0).max(1).messages({
  'number.min': 'Score must be between 0 and 1',
  'number.max': 'Score must be between 0 and 1',
});

/**
 * Coordinates validation (worldwide)
 */
const latitudeSchema = Joi.number().min(-90).max(90).messages({
  'number.min': 'Latitude must be between -90 and 90',
  'number.max': 'Latitude must be between -90 and 90',
});

const longitudeSchema = Joi.number().min(-180).max(180).messages({
  'number.min': 'Longitude must be between -180 and 180',
  'number.max': 'Longitude must be between -180 and 180',
});

// ============================================================================
// PREFERENCE SCORES SCHEMAS
// ============================================================================

/**
 * Update preference scores validation
 * PATCH /api/v1/preferences/scores
 */
export const updatePreferenceScoresSchema = Joi.object({
  history: preferenceScoreSchema.optional(),
  adventure: preferenceScoreSchema.optional(),
  nature: preferenceScoreSchema.optional(),
  relaxation: preferenceScoreSchema.optional(),
})
  .min(1)
  .messages({
    'object.min': 'At least one preference score must be provided',
  });

// ============================================================================
// TRAVEL STYLE SCHEMAS
// ============================================================================

/**
 * Update travel style validation
 * PATCH /api/v1/preferences/travel-style
 */
export const updateTravelStyleSchema = Joi.object({
  pacePreference: Joi.string().valid('slow', 'moderate', 'fast').optional().messages({
    'any.only': 'Pace preference must be slow, moderate, or fast',
  }),
  budgetRange: Joi.string().valid('budget', 'mid-range', 'luxury').optional().messages({
    'any.only': 'Budget range must be budget, mid-range, or luxury',
  }),
  groupSize: Joi.string()
    .valid('solo', 'couple', 'small-group', 'large-group')
    .optional()
    .messages({
      'any.only': 'Group size must be solo, couple, small-group, or large-group',
    }),
  accessibility: Joi.boolean().optional(),
  dietaryRestrictions: Joi.array().items(Joi.string().max(100)).max(20).optional().messages({
    'array.max': 'Cannot have more than 20 dietary restrictions',
  }),
  transportationPreferences: Joi.array()
    .items(Joi.string().max(100))
    .max(10)
    .optional()
    .messages({
      'array.max': 'Cannot have more than 10 transportation preferences',
    }),
  accommodationType: Joi.string()
    .valid('hotel', 'hostel', 'resort', 'homestay', 'any')
    .optional()
    .messages({
      'any.only': 'Accommodation type must be hotel, hostel, resort, homestay, or any',
    }),
}).min(1).messages({
  'object.min': 'At least one travel style preference must be provided',
});

// ============================================================================
// SAVED LOCATIONS SCHEMAS
// ============================================================================

/**
 * Save location validation
 * POST /api/v1/preferences/saved-locations
 */
export const saveLocationSchema = Joi.object({
  locationId: Joi.string().min(1).max(200).required().messages({
    'string.min': 'Location ID cannot be empty',
    'string.max': 'Location ID cannot exceed 200 characters',
    'any.required': 'Location ID is required',
  }),
  name: Joi.string().min(1).max(200).required().messages({
    'string.min': 'Location name cannot be empty',
    'string.max': 'Location name cannot exceed 200 characters',
    'any.required': 'Location name is required',
  }),
  latitude: latitudeSchema.optional(),
  longitude: longitudeSchema.optional(),
  category: Joi.string().max(100).optional().messages({
    'string.max': 'Category cannot exceed 100 characters',
  }),
  notes: Joi.string().max(1000).optional().messages({
    'string.max': 'Notes cannot exceed 1000 characters',
  }),
});

/**
 * Location ID parameter validation
 */
export const locationIdParamSchema = Joi.object({
  locationId: Joi.string().min(1).max(200).required().messages({
    'string.min': 'Location ID cannot be empty',
    'string.max': 'Location ID cannot exceed 200 characters',
    'any.required': 'Location ID is required',
  }),
});

/**
 * Update saved location notes validation
 * PATCH /api/v1/preferences/saved-locations/:locationId/notes
 */
export const updateLocationNotesSchema = Joi.object({
  notes: Joi.string().max(1000).required().messages({
    'string.max': 'Notes cannot exceed 1000 characters',
    'any.required': 'Notes are required',
  }),
});

// ============================================================================
// SEARCH HISTORY SCHEMAS
// ============================================================================

/**
 * Add search history validation
 * POST /api/v1/preferences/search-history
 */
export const addSearchHistorySchema = Joi.object({
  query: Joi.string().min(1).max(500).required().messages({
    'string.min': 'Search query cannot be empty',
    'string.max': 'Search query cannot exceed 500 characters',
    'any.required': 'Search query is required',
  }),
  resultCount: Joi.number().integer().min(0).optional().messages({
    'number.min': 'Result count cannot be negative',
  }),
  selectedLocationId: Joi.string().max(200).optional().messages({
    'string.max': 'Selected location ID cannot exceed 200 characters',
  }),
  selectedLocationName: Joi.string().max(200).optional().messages({
    'string.max': 'Selected location name cannot exceed 200 characters',
  }),
});

/**
 * Get search history query validation
 * GET /api/v1/preferences/search-history
 */
export const getSearchHistorySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(50).messages({
    'number.min': 'Limit must be at least 1',
    'number.max': 'Limit cannot exceed 100',
  }),
});

// ============================================================================
// CATEGORIES SCHEMAS
// ============================================================================

/**
 * Update categories validation
 * PATCH /api/v1/preferences/categories
 */
export const updateCategoriesSchema = Joi.object({
  favoriteCategories: Joi.array()
    .items(Joi.string().min(1).max(100))
    .max(50)
    .optional()
    .messages({
      'array.max': 'Cannot have more than 50 favorite categories',
    }),
  avoidCategories: Joi.array()
    .items(Joi.string().min(1).max(100))
    .max(50)
    .optional()
    .messages({
      'array.max': 'Cannot have more than 50 avoid categories',
    }),
}).min(1).messages({
  'object.min': 'At least one category list must be provided',
});

/**
 * Category parameter validation
 */
export const categoryParamSchema = Joi.object({
  category: Joi.string().min(1).max(100).required().messages({
    'string.min': 'Category cannot be empty',
    'string.max': 'Category cannot exceed 100 characters',
    'any.required': 'Category is required',
  }),
});

// ============================================================================
// VISITED LOCATIONS SCHEMAS
// ============================================================================

/**
 * Mark location visited validation
 * POST /api/v1/preferences/visited-locations
 */
export const markVisitedSchema = Joi.object({
  locationId: Joi.string().min(1).max(200).required().messages({
    'string.min': 'Location ID cannot be empty',
    'string.max': 'Location ID cannot exceed 200 characters',
    'any.required': 'Location ID is required',
  }),
});

// ============================================================================
// HOME LOCATION SCHEMAS
// ============================================================================

/**
 * Update home location validation
 * PUT /api/v1/preferences/home-location
 */
export const updateHomeLocationSchema = Joi.object({
  latitude: latitudeSchema.required().messages({
    'any.required': 'Latitude is required',
  }),
  longitude: longitudeSchema.required().messages({
    'any.required': 'Longitude is required',
  }),
  city: Joi.string().max(200).optional().messages({
    'string.max': 'City cannot exceed 200 characters',
  }),
  country: Joi.string().max(100).optional().messages({
    'string.max': 'Country cannot exceed 100 characters',
  }),
});

// ============================================================================
// NOTIFICATION PREFERENCES SCHEMAS
// ============================================================================

/**
 * Update notification preferences validation
 * PATCH /api/v1/preferences/notifications
 */
export const updateNotificationPreferencesSchema = Joi.object({
  goldenHourAlerts: Joi.boolean().optional(),
  crowdAlerts: Joi.boolean().optional(),
  eventAlerts: Joi.boolean().optional(),
  poyaDayReminders: Joi.boolean().optional(),
}).min(1).messages({
  'object.min': 'At least one notification preference must be provided',
});
