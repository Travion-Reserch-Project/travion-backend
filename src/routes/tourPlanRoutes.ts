/**
 * Tour Plan Routes
 * API routes for AI-powered tour plan generation and management
 */

import { Router } from 'express';
import { TourPlanController } from '../controllers/TourPlanController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validator';
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
  selectedLocations: Joi.array()
    .items(selectedLocationSchema)
    .required()
    .min(1)
    .max(20)
    .messages({
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
});

const refinePlanSchema = Joi.object({
  threadId: Joi.string().required().messages({
    'any.required': 'Thread ID is required for plan refinement',
  }),
  message: Joi.string().required().min(1).max(1000).messages({
    'any.required': 'Message is required for plan refinement',
  }),
  selectedLocations: Joi.array()
    .items(selectedLocationSchema)
    .required()
    .min(1),
  startDate: Joi.string()
    .required()
    .pattern(/^\d{4}-\d{2}-\d{2}$/),
  endDate: Joi.string()
    .required()
    .pattern(/^\d{4}-\d{2}-\d{2}$/),
  preferences: Joi.array().items(Joi.string()).optional(),
});

const acceptPlanSchema = Joi.object({
  threadId: Joi.string().required(),
  title: Joi.string().required().min(3).max(200),
  description: Joi.string().optional().max(1000),
  itinerary: Joi.array().items(Joi.object()).required().min(1),
  metadata: Joi.object().optional(),
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
router.post(
  '/generate',
  validate(generatePlanSchema),
  tourPlanController.generatePlan
);

/**
 * @route   POST /tour-plan/refine
 * @desc    Refine an existing tour plan based on user feedback
 * @access  Private
 */
router.post(
  '/refine',
  validate(refinePlanSchema),
  tourPlanController.refinePlan
);

/**
 * @route   POST /tour-plan/accept
 * @desc    Accept and save a generated tour plan
 * @access  Private
 */
router.post(
  '/accept',
  validate(acceptPlanSchema),
  tourPlanController.acceptPlan
);

/**
 * @route   GET /tour-plan/session/:threadId
 * @desc    Get tour plan session details
 * @access  Private
 */
router.get(
  '/session/:threadId',
  tourPlanController.getSession
);

export default router;
