/**
 * Tour Plan Routes
 * API routes for AI-powered tour plan generation and management
 */

import { Router } from 'express';
import { TourPlanController } from '../controllers/TourPlanController';
import { authenticate } from '../../../../shared/middleware/auth';
import { validate } from '../../../../shared/middleware/validator';
import Joi from 'joi';

const router = Router();
const tourPlanController = new TourPlanController();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const selectedLocationSchema = Joi.object({
  name: Joi.string().required().min(2).max(200),
  latitude: Joi.number().required().min(-90).max(90),
  longitude: Joi.number().required().min(-180).max(180),
  imageUrl: Joi.string().uri().optional().allow(null, ''),
  distance_km: Joi.number().optional().min(0),
});

const generatePlanSchema = Joi.object({
  selectedLocations: Joi.array().items(selectedLocationSchema).required().min(1).max(20).messages({
    'array.min': 'At least one location is required',
    'array.max': 'Maximum 20 locations allowed',
  }),
  startDate: Joi.string()
    .required()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .messages({
      'string.pattern.base': 'Start date must be in YYYY-MM-DD format',
    }),
  endDate: Joi.string()
    .required()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .messages({
      'string.pattern.base': 'End date must be in YYYY-MM-DD format',
    }),
  preferences: Joi.array().items(Joi.string()).optional(),
  message: Joi.string().optional().max(1000),
  selectedRestaurantIds: Joi.array().items(Joi.string()).optional(),
  selectedAccommodationIds: Joi.array().items(Joi.string()).optional(),
  skipRestaurants: Joi.boolean().optional(),
  skipAccommodations: Joi.boolean().optional(),
});

const refinePlanSchema = Joi.object({
  threadId: Joi.string().required().messages({
    'any.required': 'Thread ID is required for plan refinement',
  }),
  message: Joi.string().required().min(1).max(1000).messages({
    'any.required': 'Message is required for plan refinement',
  }),
  selectedLocations: Joi.array().items(selectedLocationSchema).required().min(1),
  startDate: Joi.string()
    .required()
    .pattern(/^\d{4}-\d{2}-\d{2}$/),
  endDate: Joi.string()
    .required()
    .pattern(/^\d{4}-\d{2}-\d{2}$/),
  preferences: Joi.array().items(Joi.string()).optional(),
  selectedRestaurantIds: Joi.array().items(Joi.string()).optional(),
  selectedAccommodationIds: Joi.array().items(Joi.string()).optional(),
  skipRestaurants: Joi.boolean().optional(),
  skipAccommodations: Joi.boolean().optional(),
});

const hotelSearchSchema = Joi.object({
  query: Joi.string().required().min(2).max(500).messages({
    'any.required': 'Search query is required',
  }),
  location: Joi.string().optional().max(200),
});

const acceptPlanSchema = Joi.object({
  threadId: Joi.string().required(),
  title: Joi.string().required().min(3).max(200),
  description: Joi.string().optional().max(1000),
  itinerary: Joi.array().items(Joi.object()).required().min(1),
  metadata: Joi.object().optional(),
});

const resumeSelectionSchema = Joi.object({
  threadId: Joi.string().required().messages({
    'any.required': 'Thread ID is required to resume the paused graph',
  }),
  selectedCandidateId: Joi.string().required().messages({
    'any.required': 'Selected candidate ID is required',
  }),
});

const resumeWeatherSchema = Joi.object({
  threadId: Joi.string().required().messages({
    'any.required': 'Thread ID is required to resume the paused graph',
  }),
  userWeatherChoice: Joi.string().required().valid('switch_indoor', 'reschedule', 'keep').messages({
    'any.required': 'Weather choice is required',
    'any.only': 'Weather choice must be one of: switch_indoor, reschedule, keep',
  }),
});

// ============================================================================
// PUBLIC ROUTES (No authentication required for testing)
// ============================================================================

// None - all tour plan routes require authentication

// ============================================================================
// PROTECTED ROUTES (Authentication required)
// ============================================================================

// Apply authentication to all routes below
router.use(authenticate);

/**
 * @route   POST /tour-plan/generate
 * @desc    Generate an AI-powered tour plan
 * @access  Private
 */
router.post('/generate', validate(generatePlanSchema), tourPlanController.generatePlan);

/**
 * @route   POST /tour-plan/refine
 * @desc    Refine an existing tour plan based on user feedback
 * @access  Private
 */
router.post('/refine', validate(refinePlanSchema), tourPlanController.refinePlan);

/**
 * @route   POST /tour-plan/accept
 * @desc    Accept and save a generated tour plan
 * @access  Private
 */
router.post('/accept', validate(acceptPlanSchema), tourPlanController.acceptPlan);

/**
 * @route   POST /tour-plan/hotel-search
 * @desc    Search for hotels, restaurants, or activities near a location
 * @access  Private
 */
router.post('/hotel-search', validate(hotelSearchSchema), tourPlanController.searchHotels);

/**
 * @route   GET /tour-plan/session/:threadId
 * @desc    Get tour plan session details
 * @access  Private
 */
router.get('/session/:threadId', tourPlanController.getSession);

/**
 * @route   POST /tour-plan/resume-selection
 * @desc    Resume the paused graph after user selects a search candidate (HITL)
 * @access  Private
 */
router.post(
  '/resume-selection',
  validate(resumeSelectionSchema),
  tourPlanController.resumeSelection
);

/**
 * @route   POST /tour-plan/resume-weather
 * @desc    Resume the paused graph after user decides on weather action (HITL)
 * @access  Private
 */
router.post('/resume-weather', validate(resumeWeatherSchema), tourPlanController.resumeWeather);

export default router;
