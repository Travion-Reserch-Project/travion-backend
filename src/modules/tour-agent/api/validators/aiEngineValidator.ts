/**
 * AI Engine API Validation Schemas
 * Joi validation schemas for AI Engine API requests
 */

import Joi from 'joi';

// ============================================================================
// COMMON SCHEMAS
// ============================================================================

/**
 * Coordinates validation (Sri Lanka bounds)
 */
const coordinatesSchema = Joi.object({
  lat: Joi.number().min(5.0).max(10.0).required().messages({
    'number.min': 'Latitude must be at least 5.0 (Sri Lanka bounds)',
    'number.max': 'Latitude must be at most 10.0 (Sri Lanka bounds)',
    'any.required': 'Latitude is required',
  }),
  lng: Joi.number().min(79.0).max(82.0).required().messages({
    'number.min': 'Longitude must be at least 79.0 (Sri Lanka bounds)',
    'number.max': 'Longitude must be at most 82.0 (Sri Lanka bounds)',
    'any.required': 'Longitude is required',
  }),
});

/**
 * General coordinates validation (worldwide)
 * Exported for use in other validators
 */
export const generalCoordinatesSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required().messages({
    'number.min': 'Latitude must be between -90 and 90',
    'number.max': 'Latitude must be between -90 and 90',
    'any.required': 'Latitude is required',
  }),
  longitude: Joi.number().min(-180).max(180).required().messages({
    'number.min': 'Longitude must be between -180 and 180',
    'number.max': 'Longitude must be between -180 and 180',
    'any.required': 'Longitude is required',
  }),
});

/**
 * Preference scores validation (0-1 range)
 */
const preferenceScoresSchema = Joi.object({
  history: Joi.number().min(0).max(1).messages({
    'number.min': 'History score must be between 0 and 1',
    'number.max': 'History score must be between 0 and 1',
  }),
  adventure: Joi.number().min(0).max(1).messages({
    'number.min': 'Adventure score must be between 0 and 1',
    'number.max': 'Adventure score must be between 0 and 1',
  }),
  nature: Joi.number().min(0).max(1).messages({
    'number.min': 'Nature score must be between 0 and 1',
    'number.max': 'Nature score must be between 0 and 1',
  }),
  relaxation: Joi.number().min(0).max(1).messages({
    'number.min': 'Relaxation score must be between 0 and 1',
    'number.max': 'Relaxation score must be between 0 and 1',
  }),
});

/**
 * Date string validation (YYYY-MM-DD format)
 */
const dateStringSchema = Joi.string()
  .pattern(/^\d{4}-\d{2}-\d{2}$/)
  .messages({
    'string.pattern.base': 'Date must be in YYYY-MM-DD format',
  });

// ============================================================================
// CHAT API SCHEMAS
// ============================================================================

/**
 * Chat request validation
 * POST /api/v1/ai/chat
 */
export const chatSchema = Joi.object({
  message: Joi.string().min(1).max(2000).required().messages({
    'string.min': 'Message cannot be empty',
    'string.max': 'Message cannot exceed 2000 characters',
    'any.required': 'Message is required',
  }),
  threadId: Joi.string().max(100).optional().messages({
    'string.max': 'Thread ID cannot exceed 100 characters',
  }),
  context: Joi.object({
    currentLocation: coordinatesSchema.optional(),
    preferences: preferenceScoresSchema.optional(),
  }).optional(),
});

// ============================================================================
// RECOMMENDATION API SCHEMAS
// ============================================================================

/**
 * Recommendation request validation
 * POST /api/v1/ai/recommend
 */
export const recommendSchema = Joi.object({
  current_lat: Joi.number().min(5.0).max(10.0).required().messages({
    'number.min': 'Latitude must be at least 5.0 (Sri Lanka bounds)',
    'number.max': 'Latitude must be at most 10.0 (Sri Lanka bounds)',
    'any.required': 'Current latitude is required',
  }),
  current_lng: Joi.number().min(79.0).max(82.0).required().messages({
    'number.min': 'Longitude must be at least 79.0 (Sri Lanka bounds)',
    'number.max': 'Longitude must be at most 82.0 (Sri Lanka bounds)',
    'any.required': 'Current longitude is required',
  }),
  preferences: preferenceScoresSchema.optional(),
  top_k: Joi.number().integer().min(1).max(20).default(5).messages({
    'number.min': 'Top K must be at least 1',
    'number.max': 'Top K cannot exceed 20',
  }),
  max_distance_km: Joi.number().min(1).max(500).default(20).messages({
    'number.min': 'Max distance must be at least 1 km',
    'number.max': 'Max distance cannot exceed 500 km',
  }),
  target_datetime: Joi.string().isoDate().optional().messages({
    'string.isoDate': 'Target datetime must be in ISO format',
  }),
  outdoor_only: Joi.boolean().optional(),
  exclude_locations: Joi.array().items(Joi.string().max(200)).max(50).optional().messages({
    'array.max': 'Cannot exclude more than 50 locations',
  }),
});

/**
 * Nearby locations query validation
 * GET /api/v1/ai/locations/nearby
 */
export const nearbyLocationsSchema = Joi.object({
  lat: Joi.number().min(5.0).max(10.0).required().messages({
    'any.required': 'Latitude is required',
  }),
  lng: Joi.number().min(79.0).max(82.0).required().messages({
    'any.required': 'Longitude is required',
  }),
  top_k: Joi.number().integer().min(1).max(100).default(10),
  max_distance_km: Joi.number().min(1).max(500).default(50),
});

/**
 * Location name parameter validation
 * GET /api/v1/ai/explain/:location
 */
export const locationNameSchema = Joi.object({
  location: Joi.string().min(1).max(200).required().messages({
    'string.min': 'Location name cannot be empty',
    'string.max': 'Location name cannot exceed 200 characters',
    'any.required': 'Location name is required',
  }),
});

// ============================================================================
// CROWDCAST API SCHEMAS
// ============================================================================

/**
 * Crowd prediction request validation
 * POST /api/v1/ai/crowd
 */
export const crowdSchema = Joi.object({
  location_type: Joi.string().required().messages({
    'any.required': 'Location type is required',
  }),
  target_datetime: Joi.string().isoDate().required().messages({
    'string.isoDate': 'Target datetime must be in ISO format',
    'any.required': 'Target datetime is required',
  }),
  is_poya: Joi.boolean().optional(),
  is_school_holiday: Joi.boolean().optional(),
});

// ============================================================================
// EVENT SENTINEL API SCHEMAS
// ============================================================================

/**
 * Event impact request validation
 * POST /api/v1/ai/events/impact
 */
export const eventImpactSchema = Joi.object({
  location_name: Joi.string().min(1).max(200).required().messages({
    'string.min': 'Location name cannot be empty',
    'string.max': 'Location name cannot exceed 200 characters',
    'any.required': 'Location name is required',
  }),
  target_date: dateStringSchema.required().messages({
    'any.required': 'Target date is required',
  }),
  activity_type: Joi.string().max(100).optional(),
});

// ============================================================================
// GOLDEN HOUR / PHYSICS API SCHEMAS
// ============================================================================

/**
 * Golden hour request validation (by coordinates)
 * POST /api/v1/ai/physics/golden-hour
 */
export const goldenHourSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required().messages({
    'any.required': 'Latitude is required',
  }),
  longitude: Joi.number().min(-180).max(180).required().messages({
    'any.required': 'Longitude is required',
  }),
  date: dateStringSchema.required().messages({
    'any.required': 'Date is required',
  }),
  elevation_m: Joi.number().min(0).max(3000).default(0).messages({
    'number.max': 'Elevation cannot exceed 3000 meters',
  }),
  location_name: Joi.string().max(200).optional(),
  include_current_position: Joi.boolean().default(false),
});

/**
 * Golden hour by location query validation
 * GET /api/v1/ai/physics/golden-hour/:location
 */
export const goldenHourByLocationSchema = Joi.object({
  date: dateStringSchema.optional(),
  include_current_position: Joi.boolean().optional(),
});

/**
 * Sun position query validation
 * GET /api/v1/ai/physics/sun-position
 */
export const sunPositionSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required().messages({
    'any.required': 'Latitude is required',
  }),
  longitude: Joi.number().min(-180).max(180).required().messages({
    'any.required': 'Longitude is required',
  }),
  elevation_m: Joi.number().min(0).max(3000).optional(),
});

// ============================================================================
// CONVENIENCE SCHEMAS
// ============================================================================

/**
 * Location info request validation
 */
export const locationInfoSchema = Joi.object({
  location_name: Joi.string().min(1).max(200).required(),
  target_date: dateStringSchema.optional(),
  user_lat: Joi.number().min(5.0).max(10.0).optional(),
  user_lng: Joi.number().min(79.0).max(82.0).optional(),
});

/**
 * Optimal visit time request validation
 */
export const optimalVisitTimeSchema = Joi.object({
  location_name: Joi.string().min(1).max(200).required(),
  location_type: Joi.string().required(),
  target_date: dateStringSchema.required(),
});

// ============================================================================
// SIMPLE API SCHEMAS
// ============================================================================

/**
 * Simple Crowd prediction request validation
 * POST /api/v1/ai/simple/crowd
 */
export const simpleCrowdSchema = Joi.object({
  location_name: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Location name must be at least 2 characters',
    'string.max': 'Location name cannot exceed 100 characters',
    'any.required': 'Location name is required',
  }),
});

/**
 * Simple Golden Hour request validation
 * POST /api/v1/ai/simple/golden-hour
 */
export const simpleGoldenHourSchema = Joi.object({
  location_name: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Location name must be at least 2 characters',
    'string.max': 'Location name cannot exceed 100 characters',
    'any.required': 'Location name is required',
  }),
});

/**
 * Simple Description request validation
 * POST /api/v1/ai/simple/description
 */
export const simpleDescriptionSchema = Joi.object({
  location_name: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Location name must be at least 2 characters',
    'string.max': 'Location name cannot exceed 100 characters',
    'any.required': 'Location name is required',
  }),
  preference: Joi.object({
    history: Joi.number().min(0).max(1).default(0.5).messages({
      'number.min': 'History score must be between 0 and 1',
      'number.max': 'History score must be between 0 and 1',
    }),
    adventure: Joi.number().min(0).max(1).default(0.5).messages({
      'number.min': 'Adventure score must be between 0 and 1',
      'number.max': 'Adventure score must be between 0 and 1',
    }),
    nature: Joi.number().min(0).max(1).default(0.5).messages({
      'number.min': 'Nature score must be between 0 and 1',
      'number.max': 'Nature score must be between 0 and 1',
    }),
    relaxation: Joi.number().min(0).max(1).default(0.5).messages({
      'number.min': 'Relaxation score must be between 0 and 1',
      'number.max': 'Relaxation score must be between 0 and 1',
    }),
  }).required().messages({
    'any.required': 'Preference scores are required',
  }),
});

/**
 * Simple Recommendation request validation
 * POST /api/v1/ai/simple/recommend
 */
export const simpleRecommendSchema = Joi.object({
  latitude: Joi.number().min(5.0).max(10.0).required().messages({
    'number.min': 'Latitude must be at least 5.0 (Sri Lanka bounds)',
    'number.max': 'Latitude must be at most 10.0 (Sri Lanka bounds)',
    'any.required': 'Latitude is required',
  }),
  longitude: Joi.number().min(79.0).max(82.0).required().messages({
    'number.min': 'Longitude must be at least 79.0 (Sri Lanka bounds)',
    'number.max': 'Longitude must be at most 82.0 (Sri Lanka bounds)',
    'any.required': 'Longitude is required',
  }),
  preferences: Joi.object({
    history: Joi.number().min(0).max(1).default(0.5).messages({
      'number.min': 'History score must be between 0 and 1',
      'number.max': 'History score must be between 0 and 1',
    }),
    adventure: Joi.number().min(0).max(1).default(0.5).messages({
      'number.min': 'Adventure score must be between 0 and 1',
      'number.max': 'Adventure score must be between 0 and 1',
    }),
    nature: Joi.number().min(0).max(1).default(0.5).messages({
      'number.min': 'Nature score must be between 0 and 1',
      'number.max': 'Nature score must be between 0 and 1',
    }),
    relaxation: Joi.number().min(0).max(1).default(0.5).messages({
      'number.min': 'Relaxation score must be between 0 and 1',
      'number.max': 'Relaxation score must be between 0 and 1',
    }),
  }).default({
    history: 0.5,
    adventure: 0.5,
    nature: 0.5,
    relaxation: 0.5,
  }),
  max_distance_km: Joi.number().min(1).max(500).default(50).messages({
    'number.min': 'Max distance must be at least 1 km',
    'number.max': 'Max distance cannot exceed 500 km',
  }),
  top_k: Joi.number().integer().min(1).max(20).default(5).messages({
    'number.min': 'Top K must be at least 1',
    'number.max': 'Top K cannot exceed 20',
  }),
});
