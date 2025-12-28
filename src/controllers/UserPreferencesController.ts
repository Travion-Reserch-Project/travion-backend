/**
 * User Preferences Controller
 * Handles HTTP requests for User Preferences API endpoints
 */

import { Response, NextFunction } from 'express';
import { UserPreferencesService } from '../services/UserPreferencesService';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

export class UserPreferencesController {
  private preferencesService: UserPreferencesService;

  constructor() {
    this.preferencesService = new UserPreferencesService();
  }

  /**
   * Get user ID from authenticated request
   */
  private getUserId(req: AuthRequest): string {
    if (!req.user?.userId) {
      throw new AppError('User not authenticated', 401);
    }
    return req.user.userId;
  }

  // ============================================================================
  // CORE OPERATIONS
  // ============================================================================

  /**
   * Get user preferences
   * GET /api/v1/preferences
   */
  getPreferences = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const preferences = await this.preferencesService.getPreferences(userId);

      res.status(200).json({
        success: true,
        message: 'Preferences retrieved',
        data: preferences,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get preference scores for AI Engine
   * GET /api/v1/preferences/scores
   */
  getPreferenceScores = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const scores = await this.preferencesService.getPreferenceScores(userId);

      res.status(200).json({
        success: true,
        message: 'Preference scores retrieved',
        data: scores,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete user preferences
   * DELETE /api/v1/preferences
   */
  deletePreferences = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      await this.preferencesService.deletePreferences(userId);

      res.status(200).json({
        success: true,
        message: 'Preferences deleted',
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // PREFERENCE SCORES OPERATIONS
  // ============================================================================

  /**
   * Update preference scores
   * PATCH /api/v1/preferences/scores
   */
  updatePreferenceScores = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const preferences = await this.preferencesService.updatePreferenceScores(
        userId,
        req.body
      );

      res.status(200).json({
        success: true,
        message: 'Preference scores updated',
        data: preferences,
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // TRAVEL STYLE OPERATIONS
  // ============================================================================

  /**
   * Update travel style preferences
   * PATCH /api/v1/preferences/travel-style
   */
  updateTravelStyle = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const preferences = await this.preferencesService.updateTravelStyle(
        userId,
        req.body
      );

      res.status(200).json({
        success: true,
        message: 'Travel style updated',
        data: preferences,
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // SAVED LOCATIONS OPERATIONS
  // ============================================================================

  /**
   * Get saved locations
   * GET /api/v1/preferences/saved-locations
   */
  getSavedLocations = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const locations = await this.preferencesService.getSavedLocations(userId);

      res.status(200).json({
        success: true,
        message: 'Saved locations retrieved',
        data: locations,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Save a location
   * POST /api/v1/preferences/saved-locations
   */
  saveLocation = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const preferences = await this.preferencesService.saveLocation(userId, req.body);

      res.status(201).json({
        success: true,
        message: 'Location saved',
        data: preferences,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Remove a saved location
   * DELETE /api/v1/preferences/saved-locations/:locationId
   */
  removeSavedLocation = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const { locationId } = req.params;
      const preferences = await this.preferencesService.removeSavedLocation(
        userId,
        locationId
      );

      res.status(200).json({
        success: true,
        message: 'Location removed from saved',
        data: preferences,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Check if a location is saved
   * GET /api/v1/preferences/saved-locations/:locationId/check
   */
  isLocationSaved = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const { locationId } = req.params;
      const isSaved = await this.preferencesService.isLocationSaved(userId, locationId);

      res.status(200).json({
        success: true,
        message: 'Location save status checked',
        data: { isSaved },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update saved location notes
   * PATCH /api/v1/preferences/saved-locations/:locationId/notes
   */
  updateSavedLocationNotes = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const { locationId } = req.params;
      const { notes } = req.body;
      const preferences = await this.preferencesService.updateSavedLocationNotes(
        userId,
        locationId,
        notes
      );

      res.status(200).json({
        success: true,
        message: 'Location notes updated',
        data: preferences,
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // SEARCH HISTORY OPERATIONS
  // ============================================================================

  /**
   * Get search history
   * GET /api/v1/preferences/search-history
   */
  getSearchHistory = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const history = await this.preferencesService.getSearchHistory(userId, limit);

      res.status(200).json({
        success: true,
        message: 'Search history retrieved',
        data: history,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Add search history entry
   * POST /api/v1/preferences/search-history
   */
  addSearchHistory = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const preferences = await this.preferencesService.addSearchHistory(
        userId,
        req.body
      );

      res.status(201).json({
        success: true,
        message: 'Search history entry added',
        data: preferences,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Clear search history
   * DELETE /api/v1/preferences/search-history
   */
  clearSearchHistory = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const preferences = await this.preferencesService.clearSearchHistory(userId);

      res.status(200).json({
        success: true,
        message: 'Search history cleared',
        data: preferences,
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // CATEGORIES OPERATIONS
  // ============================================================================

  /**
   * Update categories
   * PATCH /api/v1/preferences/categories
   */
  updateCategories = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const preferences = await this.preferencesService.updateCategories(
        userId,
        req.body
      );

      res.status(200).json({
        success: true,
        message: 'Categories updated',
        data: preferences,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Add favorite category
   * POST /api/v1/preferences/categories/favorite/:category
   */
  addFavoriteCategory = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const { category } = req.params;
      const preferences = await this.preferencesService.addFavoriteCategory(
        userId,
        category
      );

      res.status(200).json({
        success: true,
        message: 'Favorite category added',
        data: preferences,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Remove favorite category
   * DELETE /api/v1/preferences/categories/favorite/:category
   */
  removeFavoriteCategory = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const { category } = req.params;
      const preferences = await this.preferencesService.removeFavoriteCategory(
        userId,
        category
      );

      res.status(200).json({
        success: true,
        message: 'Favorite category removed',
        data: preferences,
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // VISITED LOCATIONS OPERATIONS
  // ============================================================================

  /**
   * Get visited locations
   * GET /api/v1/preferences/visited-locations
   */
  getVisitedLocations = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const locations = await this.preferencesService.getVisitedLocations(userId);

      res.status(200).json({
        success: true,
        message: 'Visited locations retrieved',
        data: locations,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Mark location as visited
   * POST /api/v1/preferences/visited-locations
   */
  markLocationVisited = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const { locationId } = req.body;
      const preferences = await this.preferencesService.markLocationVisited(
        userId,
        locationId
      );

      res.status(200).json({
        success: true,
        message: 'Location marked as visited',
        data: preferences,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Unmark location as visited
   * DELETE /api/v1/preferences/visited-locations/:locationId
   */
  unmarkLocationVisited = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const { locationId } = req.params;
      const preferences = await this.preferencesService.unmarkLocationVisited(
        userId,
        locationId
      );

      res.status(200).json({
        success: true,
        message: 'Location unmarked as visited',
        data: preferences,
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // HOME LOCATION OPERATIONS
  // ============================================================================

  /**
   * Update home location
   * PUT /api/v1/preferences/home-location
   */
  updateHomeLocation = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const preferences = await this.preferencesService.updateHomeLocation(
        userId,
        req.body
      );

      res.status(200).json({
        success: true,
        message: 'Home location updated',
        data: preferences,
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // NOTIFICATION PREFERENCES OPERATIONS
  // ============================================================================

  /**
   * Update notification preferences
   * PATCH /api/v1/preferences/notifications
   */
  updateNotificationPreferences = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const preferences = await this.preferencesService.updateNotificationPreferences(
        userId,
        req.body
      );

      res.status(200).json({
        success: true,
        message: 'Notification preferences updated',
        data: preferences,
      });
    } catch (error) {
      next(error);
    }
  };
}
