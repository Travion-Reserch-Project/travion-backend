/**
 * SavedTrip Routes
 * API routes for trip management
 */

import { Router } from 'express';
import { SavedTripController } from '../controllers/SavedTripController';
import { authenticate } from '../middleware/auth';
import { validate, validateParams, validateQuery } from '../middleware/validator';
import {
  createTripSchema,
  updateTripSchema,
  updateStatusSchema,
  addItineraryItemSchema,
  updateItineraryItemSchema,
  reorderItinerarySchema,
  addRatingSchema,
  tripIdParamSchema,
  itemIndexParamSchema,
  getTripsQuerySchema,
  searchTripsQuerySchema,
} from '../validators/savedTripValidator';

const router = Router();
const tripController = new SavedTripController();

// ============================================================================
// PUBLIC ROUTES (No authentication required)
// ============================================================================

/**
 * @route   GET /trips/public
 * @desc    Get public trips
 * @access  Public
 */
router.get(
  '/public',
  validateQuery(getTripsQuerySchema),
  tripController.getPublicTrips
);

// ============================================================================
// PROTECTED ROUTES (Authentication required)
// ============================================================================

// Apply authentication to all routes below
router.use(authenticate);

/**
 * @route   GET /trips
 * @desc    Get all trips for authenticated user
 * @access  Private
 */
router.get(
  '/',
  validateQuery(getTripsQuerySchema),
  tripController.getTrips
);

/**
 * @route   POST /trips
 * @desc    Create a new trip
 * @access  Private
 */
router.post(
  '/',
  validate(createTripSchema),
  tripController.createTrip
);

/**
 * @route   GET /trips/upcoming
 * @desc    Get upcoming trips (next 30 days)
 * @access  Private
 */
router.get('/upcoming', tripController.getUpcomingTrips);

/**
 * @route   GET /trips/search
 * @desc    Search trips
 * @access  Private
 */
router.get(
  '/search',
  validateQuery(searchTripsQuerySchema),
  tripController.searchTrips
);

/**
 * @route   GET /trips/:tripId
 * @desc    Get trip by ID
 * @access  Private
 */
router.get(
  '/:tripId',
  validateParams(tripIdParamSchema),
  tripController.getTripById
);

/**
 * @route   PUT /trips/:tripId
 * @desc    Update trip
 * @access  Private
 */
router.put(
  '/:tripId',
  validateParams(tripIdParamSchema),
  validate(updateTripSchema),
  tripController.updateTrip
);

/**
 * @route   DELETE /trips/:tripId
 * @desc    Delete trip
 * @access  Private
 */
router.delete(
  '/:tripId',
  validateParams(tripIdParamSchema),
  tripController.deleteTrip
);

/**
 * @route   PATCH /trips/:tripId/status
 * @desc    Update trip status
 * @access  Private
 */
router.patch(
  '/:tripId/status',
  validateParams(tripIdParamSchema),
  validate(updateStatusSchema),
  tripController.updateStatus
);

/**
 * @route   PATCH /trips/:tripId/visibility
 * @desc    Toggle trip visibility (public/private)
 * @access  Private
 */
router.patch(
  '/:tripId/visibility',
  validateParams(tripIdParamSchema),
  tripController.toggleVisibility
);

/**
 * @route   POST /trips/:tripId/duplicate
 * @desc    Duplicate a trip
 * @access  Private
 */
router.post(
  '/:tripId/duplicate',
  validateParams(tripIdParamSchema),
  tripController.duplicateTrip
);

/**
 * @route   POST /trips/:tripId/rating
 * @desc    Add rating and review
 * @access  Private
 */
router.post(
  '/:tripId/rating',
  validateParams(tripIdParamSchema),
  validate(addRatingSchema),
  tripController.addRating
);

// ============================================================================
// ITINERARY ROUTES
// ============================================================================

/**
 * @route   POST /trips/:tripId/itinerary
 * @desc    Add itinerary item
 * @access  Private
 */
router.post(
  '/:tripId/itinerary',
  validateParams(tripIdParamSchema),
  validate(addItineraryItemSchema),
  tripController.addItineraryItem
);

/**
 * @route   PUT /trips/:tripId/itinerary/:itemIndex
 * @desc    Update itinerary item
 * @access  Private
 */
router.put(
  '/:tripId/itinerary/:itemIndex',
  validateParams(itemIndexParamSchema),
  validate(updateItineraryItemSchema),
  tripController.updateItineraryItem
);

/**
 * @route   DELETE /trips/:tripId/itinerary/:itemIndex
 * @desc    Remove itinerary item
 * @access  Private
 */
router.delete(
  '/:tripId/itinerary/:itemIndex',
  validateParams(itemIndexParamSchema),
  tripController.removeItineraryItem
);

/**
 * @route   PATCH /trips/:tripId/itinerary/reorder
 * @desc    Reorder itinerary items
 * @access  Private
 */
router.patch(
  '/:tripId/itinerary/reorder',
  validateParams(tripIdParamSchema),
  validate(reorderItinerarySchema),
  tripController.reorderItinerary
);

export default router;
