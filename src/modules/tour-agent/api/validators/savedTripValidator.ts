/**
 * SavedTrip Validators
 * Joi validation schemas for trip-related endpoints
 */

import Joi from 'joi';

// ============================================================================
// COMMON SCHEMAS
// ============================================================================

const objectIdSchema = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

const itineraryItemSchema = Joi.object({
  order: Joi.number().integer().min(0),
  time: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required()
    .messages({ 'string.pattern.base': 'Time must be in HH:MM format' }),
  locationName: Joi.string().min(1).max(200).required(),
  locationId: Joi.string().max(200),
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180),
  activity: Joi.string().min(1).max(500).required(),
  durationMinutes: Joi.number().integer().min(1).max(1440).required(),
  notes: Joi.string().max(1000),
  crowdPrediction: Joi.number().min(0).max(100),
  lightingQuality: Joi.string().valid('golden', 'blue', 'good', 'harsh', 'dark'),
  constraints: Joi.array().items(Joi.string()),
});

const constraintSchema = Joi.object({
  constraintType: Joi.string().required(),
  description: Joi.string().required(),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical').required(),
  suggestion: Joi.string(),
});

const aiMetadataSchema = Joi.object({
  sessionId: Joi.string(),
  model: Joi.string(),
  reasoningLoops: Joi.number().integer().min(0),
  documentsRetrieved: Joi.number().integer().min(0),
  webSearchUsed: Joi.boolean(),
  generatedAt: Joi.date(),
});

const estimatedBudgetSchema = Joi.object({
  currency: Joi.string().length(3).default('USD'),
  amount: Joi.number().min(0).required(),
});

// ============================================================================
// CREATE TRIP SCHEMA
// ============================================================================

export const createTripSchema = Joi.object({
  title: Joi.string().min(1).max(200).required()
    .messages({ 'any.required': 'Trip title is required' }),
  description: Joi.string().max(2000),
  startDate: Joi.date().iso().required()
    .messages({ 'any.required': 'Start date is required' }),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).required()
    .messages({
      'any.required': 'End date is required',
      'date.min': 'End date must be after start date',
    }),
  destinations: Joi.array().items(Joi.string().max(200)).max(50),
  itinerary: Joi.array().items(itineraryItemSchema).max(200),
  isPublic: Joi.boolean().default(false),
  status: Joi.string().valid('draft', 'planned', 'ongoing', 'completed', 'cancelled').default('draft'),
  coverImage: Joi.string().uri(),
  tags: Joi.array().items(Joi.string().max(50)).max(20),
  estimatedBudget: estimatedBudgetSchema,
  travelersCount: Joi.number().integer().min(1).max(100).default(1),
  generatedBy: Joi.string().valid('user', 'ai').default('user'),
  aiMetadata: aiMetadataSchema,
  constraints: Joi.array().items(constraintSchema),
});

// ============================================================================
// UPDATE TRIP SCHEMA
// ============================================================================

export const updateTripSchema = Joi.object({
  title: Joi.string().min(1).max(200),
  description: Joi.string().max(2000).allow(''),
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso(),
  destinations: Joi.array().items(Joi.string().max(200)).max(50),
  itinerary: Joi.array().items(itineraryItemSchema).max(200),
  isPublic: Joi.boolean(),
  status: Joi.string().valid('draft', 'planned', 'ongoing', 'completed', 'cancelled'),
  coverImage: Joi.string().uri().allow(''),
  tags: Joi.array().items(Joi.string().max(50)).max(20),
  estimatedBudget: estimatedBudgetSchema,
  travelersCount: Joi.number().integer().min(1).max(100),
}).min(1).messages({ 'object.min': 'At least one field is required for update' });

// ============================================================================
// STATUS UPDATE SCHEMA
// ============================================================================

export const updateStatusSchema = Joi.object({
  status: Joi.string()
    .valid('draft', 'planned', 'ongoing', 'completed', 'cancelled')
    .required()
    .messages({ 'any.required': 'Status is required' }),
});

// ============================================================================
// ITINERARY SCHEMAS
// ============================================================================

export const addItineraryItemSchema = itineraryItemSchema;

export const updateItineraryItemSchema = Joi.object({
  order: Joi.number().integer().min(0),
  time: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
  locationName: Joi.string().min(1).max(200),
  locationId: Joi.string().max(200),
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180),
  activity: Joi.string().min(1).max(500),
  durationMinutes: Joi.number().integer().min(1).max(1440),
  notes: Joi.string().max(1000).allow(''),
  crowdPrediction: Joi.number().min(0).max(100),
  lightingQuality: Joi.string().valid('golden', 'blue', 'good', 'harsh', 'dark'),
  constraints: Joi.array().items(Joi.string()),
}).min(1);

export const reorderItinerarySchema = Joi.object({
  newOrder: Joi.array().items(Joi.number().integer().min(0)).required()
    .messages({ 'any.required': 'New order array is required' }),
});

// ============================================================================
// RATING SCHEMA
// ============================================================================

export const addRatingSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).required()
    .messages({ 'any.required': 'Rating is required (1-5)' }),
  review: Joi.string().max(2000),
});

// ============================================================================
// PARAM SCHEMAS
// ============================================================================

export const tripIdParamSchema = Joi.object({
  tripId: objectIdSchema.required()
    .messages({ 'any.required': 'Trip ID is required' }),
});

export const itemIndexParamSchema = Joi.object({
  tripId: objectIdSchema.required(),
  itemIndex: Joi.number().integer().min(0).required(),
});

// ============================================================================
// QUERY SCHEMAS
// ============================================================================

export const getTripsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('draft', 'planned', 'ongoing', 'completed', 'cancelled'),
  isPublic: Joi.boolean(),
  generatedBy: Joi.string().valid('user', 'ai'),
  tags: Joi.string(), // Comma-separated
});

export const searchTripsQuerySchema = Joi.object({
  q: Joi.string().min(1).max(200).required()
    .messages({ 'any.required': 'Search query is required' }),
  limit: Joi.number().integer().min(1).max(50).default(10),
});
