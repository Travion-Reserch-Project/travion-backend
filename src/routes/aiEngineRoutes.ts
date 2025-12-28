/**
 * AI Engine Routes
 * Routes for AI Engine API endpoints (proxy to Python ML service)
 */

import { Router } from 'express';
import { AIEngineController } from '../controllers/AIEngineController';
import { authenticate } from '../middleware/auth';
import { validate, validateQuery, validateParams } from '../middleware/validator';
import {
  chatSchema,
  recommendSchema,
  nearbyLocationsSchema,
  locationNameSchema,
  crowdSchema,
  eventImpactSchema,
  goldenHourSchema,
  goldenHourByLocationSchema,
  sunPositionSchema,
} from '../validators/aiEngineValidator';

const router = Router();
const aiEngineController = new AIEngineController();

// ============================================================================
// HEALTH CHECK ROUTES (Public)
// ============================================================================

/**
 * @route   GET /api/v1/ai/health
 * @desc    Check AI Engine health status
 * @access  Public
 */
router.get('/health', aiEngineController.checkHealth);

/**
 * @route   GET /api/v1/ai/status
 * @desc    Check if AI Engine is available
 * @access  Public
 */
router.get('/status', aiEngineController.checkAvailability);

/**
 * @route   GET /api/v1/ai/graph
 * @desc    Get AI Engine graph visualization
 * @access  Public
 */
router.get('/graph', aiEngineController.getGraph);

// ============================================================================
// CHAT ROUTES (Protected)
// ============================================================================

/**
 * @route   POST /api/v1/ai/chat
 * @desc    Send a message to the agentic chat system
 * @access  Private
 */
router.post(
  '/chat',
  authenticate as any,
  validate(chatSchema),
  aiEngineController.chat as any
);

// ============================================================================
// RECOMMENDATION ROUTES (Protected)
// ============================================================================

/**
 * @route   POST /api/v1/ai/recommend
 * @desc    Get personalized location recommendations
 * @access  Private
 */
router.post(
  '/recommend',
  authenticate as any,
  validate(recommendSchema),
  aiEngineController.getRecommendations as any
);

/**
 * @route   GET /api/v1/ai/explain/:location
 * @desc    Get explanation for a location recommendation
 * @access  Private
 */
router.get(
  '/explain/:location',
  authenticate as any,
  validateParams(locationNameSchema),
  aiEngineController.getExplanation as any
);

/**
 * @route   GET /api/v1/ai/locations/nearby
 * @desc    Get nearby locations
 * @access  Private
 */
router.get(
  '/locations/nearby',
  authenticate as any,
  validateQuery(nearbyLocationsSchema),
  aiEngineController.getNearbyLocations as any
);

// ============================================================================
// CROWDCAST ROUTES (Protected)
// ============================================================================

/**
 * @route   POST /api/v1/ai/crowd
 * @desc    Get crowd prediction for a location
 * @access  Private
 */
router.post(
  '/crowd',
  authenticate as any,
  validate(crowdSchema),
  aiEngineController.getCrowdPrediction as any
);

// ============================================================================
// EVENT SENTINEL ROUTES (Protected)
// ============================================================================

/**
 * @route   POST /api/v1/ai/events/impact
 * @desc    Get event/holiday impact analysis
 * @access  Private
 */
router.post(
  '/events/impact',
  authenticate as any,
  validate(eventImpactSchema),
  aiEngineController.getEventImpact as any
);

/**
 * @route   GET /api/v1/ai/events/check-holiday
 * @desc    Check holiday status for a date
 * @access  Private
 */
router.get(
  '/events/check-holiday',
  authenticate as any,
  aiEngineController.checkHoliday as any
);

// ============================================================================
// GOLDEN HOUR / PHYSICS ROUTES (Protected)
// ============================================================================

/**
 * @route   POST /api/v1/ai/physics/golden-hour
 * @desc    Get golden hour calculation by coordinates
 * @access  Private
 */
router.post(
  '/physics/golden-hour',
  authenticate as any,
  validate(goldenHourSchema),
  aiEngineController.getGoldenHour as any
);

/**
 * @route   GET /api/v1/ai/physics/golden-hour/:location
 * @desc    Get golden hour by location name
 * @access  Private
 */
router.get(
  '/physics/golden-hour/:location',
  authenticate as any,
  validateQuery(goldenHourByLocationSchema),
  aiEngineController.getGoldenHourByLocation as any
);

/**
 * @route   GET /api/v1/ai/physics/sun-position
 * @desc    Get current sun position
 * @access  Private
 */
router.get(
  '/physics/sun-position',
  authenticate as any,
  validateQuery(sunPositionSchema),
  aiEngineController.getSunPosition as any
);

/**
 * @route   GET /api/v1/ai/physics/light-quality
 * @desc    Get current light quality
 * @access  Private
 */
router.get(
  '/physics/light-quality',
  authenticate as any,
  aiEngineController.getCurrentLightQuality as any
);

// ============================================================================
// CONVENIENCE ROUTES (Protected)
// ============================================================================

/**
 * @route   GET /api/v1/ai/location-info/:location
 * @desc    Get comprehensive location info (explanation + event impact + golden hour)
 * @access  Private
 */
router.get(
  '/location-info/:location',
  authenticate as any,
  aiEngineController.getLocationInfo as any
);

/**
 * @route   GET /api/v1/ai/optimal-visit-time/:location
 * @desc    Get optimal visit time for a location
 * @access  Private
 */
router.get(
  '/optimal-visit-time/:location',
  authenticate as any,
  aiEngineController.getOptimalVisitTime as any
);

export default router;
