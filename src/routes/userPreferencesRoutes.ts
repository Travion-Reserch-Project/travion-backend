/**
 * User Preferences Routes
 * Routes for User Preferences API endpoints
 */

import { Router } from 'express';
import { UserPreferencesController } from '../controllers/UserPreferencesController';
import { authenticate } from '../middleware/auth';
import { validate, validateQuery, validateParams } from '../middleware/validator';
import {
  updatePreferenceScoresSchema,
  updateTravelStyleSchema,
  saveLocationSchema,
  locationIdParamSchema,
  updateLocationNotesSchema,
  addSearchHistorySchema,
  getSearchHistorySchema,
  updateCategoriesSchema,
  categoryParamSchema,
  markVisitedSchema,
  updateHomeLocationSchema,
  updateNotificationPreferencesSchema,
} from '../validators/userPreferencesValidator';

const router = Router();
const preferencesController = new UserPreferencesController();

// All routes require authentication
router.use(authenticate as any);

// ============================================================================
// CORE PREFERENCES ROUTES
// ============================================================================

/**
 * @route   GET /api/v1/preferences
 * @desc    Get user preferences
 * @access  Private
 */
router.get('/', preferencesController.getPreferences as any);

/**
 * @route   DELETE /api/v1/preferences
 * @desc    Delete user preferences
 * @access  Private
 */
router.delete('/', preferencesController.deletePreferences as any);

// ============================================================================
// PREFERENCE SCORES ROUTES
// ============================================================================

/**
 * @route   GET /api/v1/preferences/scores
 * @desc    Get preference scores for AI Engine
 * @access  Private
 */
router.get('/scores', preferencesController.getPreferenceScores as any);

/**
 * @route   PATCH /api/v1/preferences/scores
 * @desc    Update preference scores
 * @access  Private
 */
router.patch(
  '/scores',
  validate(updatePreferenceScoresSchema),
  preferencesController.updatePreferenceScores as any
);

// ============================================================================
// TRAVEL STYLE ROUTES
// ============================================================================

/**
 * @route   PATCH /api/v1/preferences/travel-style
 * @desc    Update travel style preferences
 * @access  Private
 */
router.patch(
  '/travel-style',
  validate(updateTravelStyleSchema),
  preferencesController.updateTravelStyle as any
);

// ============================================================================
// SAVED LOCATIONS ROUTES
// ============================================================================

/**
 * @route   GET /api/v1/preferences/saved-locations
 * @desc    Get all saved locations
 * @access  Private
 */
router.get('/saved-locations', preferencesController.getSavedLocations as any);

/**
 * @route   POST /api/v1/preferences/saved-locations
 * @desc    Save a location
 * @access  Private
 */
router.post(
  '/saved-locations',
  validate(saveLocationSchema),
  preferencesController.saveLocation as any
);

/**
 * @route   DELETE /api/v1/preferences/saved-locations/:locationId
 * @desc    Remove a saved location
 * @access  Private
 */
router.delete(
  '/saved-locations/:locationId',
  validateParams(locationIdParamSchema),
  preferencesController.removeSavedLocation as any
);

/**
 * @route   GET /api/v1/preferences/saved-locations/:locationId/check
 * @desc    Check if a location is saved
 * @access  Private
 */
router.get(
  '/saved-locations/:locationId/check',
  validateParams(locationIdParamSchema),
  preferencesController.isLocationSaved as any
);

/**
 * @route   PATCH /api/v1/preferences/saved-locations/:locationId/notes
 * @desc    Update saved location notes
 * @access  Private
 */
router.patch(
  '/saved-locations/:locationId/notes',
  validateParams(locationIdParamSchema),
  validate(updateLocationNotesSchema),
  preferencesController.updateSavedLocationNotes as any
);

// ============================================================================
// SEARCH HISTORY ROUTES
// ============================================================================

/**
 * @route   GET /api/v1/preferences/search-history
 * @desc    Get search history
 * @access  Private
 */
router.get(
  '/search-history',
  validateQuery(getSearchHistorySchema),
  preferencesController.getSearchHistory as any
);

/**
 * @route   POST /api/v1/preferences/search-history
 * @desc    Add search history entry
 * @access  Private
 */
router.post(
  '/search-history',
  validate(addSearchHistorySchema),
  preferencesController.addSearchHistory as any
);

/**
 * @route   DELETE /api/v1/preferences/search-history
 * @desc    Clear search history
 * @access  Private
 */
router.delete('/search-history', preferencesController.clearSearchHistory as any);

// ============================================================================
// CATEGORIES ROUTES
// ============================================================================

/**
 * @route   PATCH /api/v1/preferences/categories
 * @desc    Update favorite and avoid categories
 * @access  Private
 */
router.patch(
  '/categories',
  validate(updateCategoriesSchema),
  preferencesController.updateCategories as any
);

/**
 * @route   POST /api/v1/preferences/categories/favorite/:category
 * @desc    Add a category to favorites
 * @access  Private
 */
router.post(
  '/categories/favorite/:category',
  validateParams(categoryParamSchema),
  preferencesController.addFavoriteCategory as any
);

/**
 * @route   DELETE /api/v1/preferences/categories/favorite/:category
 * @desc    Remove a category from favorites
 * @access  Private
 */
router.delete(
  '/categories/favorite/:category',
  validateParams(categoryParamSchema),
  preferencesController.removeFavoriteCategory as any
);

// ============================================================================
// VISITED LOCATIONS ROUTES
// ============================================================================

/**
 * @route   GET /api/v1/preferences/visited-locations
 * @desc    Get visited locations
 * @access  Private
 */
router.get('/visited-locations', preferencesController.getVisitedLocations as any);

/**
 * @route   POST /api/v1/preferences/visited-locations
 * @desc    Mark location as visited
 * @access  Private
 */
router.post(
  '/visited-locations',
  validate(markVisitedSchema),
  preferencesController.markLocationVisited as any
);

/**
 * @route   DELETE /api/v1/preferences/visited-locations/:locationId
 * @desc    Unmark location as visited
 * @access  Private
 */
router.delete(
  '/visited-locations/:locationId',
  validateParams(locationIdParamSchema),
  preferencesController.unmarkLocationVisited as any
);

// ============================================================================
// HOME LOCATION ROUTES
// ============================================================================

/**
 * @route   PUT /api/v1/preferences/home-location
 * @desc    Update home location
 * @access  Private
 */
router.put(
  '/home-location',
  validate(updateHomeLocationSchema),
  preferencesController.updateHomeLocation as any
);

// ============================================================================
// NOTIFICATION PREFERENCES ROUTES
// ============================================================================

/**
 * @route   PATCH /api/v1/preferences/notifications
 * @desc    Update notification preferences
 * @access  Private
 */
router.patch(
  '/notifications',
  validate(updateNotificationPreferencesSchema),
  preferencesController.updateNotificationPreferences as any
);

export default router;
