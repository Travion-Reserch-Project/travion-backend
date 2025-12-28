/**
 * ChatSession Validators
 * Joi validation schemas for chat session endpoints
 */

import Joi from 'joi';

// ============================================================================
// COMMON SCHEMAS
// ============================================================================

const objectIdSchema = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

const contextSchema = Joi.object({
  currentLocation: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
  }),
  targetDate: Joi.date().iso(),
  preferences: Joi.object({
    history: Joi.number().min(0).max(1),
    adventure: Joi.number().min(0).max(1),
    nature: Joi.number().min(0).max(1),
    relaxation: Joi.number().min(0).max(1),
  }),
  lastRecommendations: Joi.array().items(Joi.string()),
});

// ============================================================================
// CREATE SESSION SCHEMA
// ============================================================================

export const createSessionSchema = Joi.object({
  title: Joi.string().max(200),
  context: contextSchema,
});

// ============================================================================
// SEND MESSAGE SCHEMA
// ============================================================================

export const sendMessageSchema = Joi.object({
  message: Joi.string().min(1).max(2000).required()
    .messages({ 'any.required': 'Message is required' }),
  context: contextSchema,
});

// ============================================================================
// QUICK CHAT SCHEMA
// ============================================================================

export const quickChatSchema = Joi.object({
  message: Joi.string().min(1).max(2000).required()
    .messages({ 'any.required': 'Message is required' }),
  sessionId: Joi.string().max(100),
  context: contextSchema,
});

// ============================================================================
// UPDATE CONTEXT SCHEMA
// ============================================================================

export const updateContextSchema = Joi.object({
  currentLocation: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
  }),
  targetDate: Joi.date().iso(),
  preferences: Joi.object({
    history: Joi.number().min(0).max(1),
    adventure: Joi.number().min(0).max(1),
    nature: Joi.number().min(0).max(1),
    relaxation: Joi.number().min(0).max(1),
  }),
  lastRecommendations: Joi.array().items(Joi.string()),
}).min(1).messages({ 'object.min': 'At least one context field is required' });

// ============================================================================
// SET LOCATION SCHEMA
// ============================================================================

export const setLocationSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required()
    .messages({ 'any.required': 'Latitude is required' }),
  longitude: Joi.number().min(-180).max(180).required()
    .messages({ 'any.required': 'Longitude is required' }),
});

// ============================================================================
// UPDATE TITLE SCHEMA
// ============================================================================

export const updateTitleSchema = Joi.object({
  title: Joi.string().min(1).max(200).required()
    .messages({ 'any.required': 'Title is required' }),
});

// ============================================================================
// LINK TRIP SCHEMA
// ============================================================================

export const linkTripSchema = Joi.object({
  tripId: objectIdSchema.required()
    .messages({ 'any.required': 'Trip ID is required' }),
});

// ============================================================================
// PARAM SCHEMAS
// ============================================================================

export const sessionIdParamSchema = Joi.object({
  sessionId: Joi.string().min(1).max(100).required()
    .messages({ 'any.required': 'Session ID is required' }),
});

// ============================================================================
// QUERY SCHEMAS
// ============================================================================

export const getSessionsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('active', 'closed', 'archived'),
});

export const getMessagesQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(50),
  offset: Joi.number().integer().min(0).default(0),
});

export const searchSessionsQuerySchema = Joi.object({
  q: Joi.string().min(1).max(200).required()
    .messages({ 'any.required': 'Search query is required' }),
  limit: Joi.number().integer().min(1).max(50).default(10),
});

export const recentSessionsQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(20).default(5),
});
