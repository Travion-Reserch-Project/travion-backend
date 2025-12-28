/**
 * UserPreferences Service
 * Business logic layer for user preferences management
 */

import { UserPreferencesRepository } from '../repositories/UserPreferencesRepository';
import {
  IUserPreferences,
  ISavedLocation,
  ISearchHistoryEntry,
  IPreferenceScores,
} from '../models/UserPreferences';
import { AppError } from '../middleware/errorHandler';

// ============================================================================
// DTOs
// ============================================================================

export interface UpdatePreferenceScoresDTO {
  history?: number;
  adventure?: number;
  nature?: number;
  relaxation?: number;
}

export interface UpdateTravelStyleDTO {
  pacePreference?: 'slow' | 'moderate' | 'fast';
  budgetRange?: 'budget' | 'mid-range' | 'luxury';
  groupSize?: 'solo' | 'couple' | 'small-group' | 'large-group';
  accessibility?: boolean;
  dietaryRestrictions?: string[];
  transportationPreferences?: string[];
  accommodationType?: 'hotel' | 'hostel' | 'resort' | 'homestay' | 'any';
}

export interface SaveLocationDTO {
  locationId: string;
  name: string;
  latitude?: number;
  longitude?: number;
  category?: string;
  notes?: string;
}

export interface AddSearchHistoryDTO {
  query: string;
  resultCount?: number;
  selectedLocationId?: string;
  selectedLocationName?: string;
}

export interface UpdateHomeLocationDTO {
  latitude: number;
  longitude: number;
  city?: string;
  country?: string;
}

export interface UpdateNotificationPreferencesDTO {
  goldenHourAlerts?: boolean;
  crowdAlerts?: boolean;
  eventAlerts?: boolean;
  poyaDayReminders?: boolean;
}

export interface UpdateCategoriesDTO {
  favoriteCategories?: string[];
  avoidCategories?: string[];
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class UserPreferencesService {
  private repository: UserPreferencesRepository;

  constructor() {
    this.repository = new UserPreferencesRepository();
  }

  // ============================================================================
  // CORE OPERATIONS
  // ============================================================================

  /**
   * Get user preferences (creates default if not exists)
   */
  async getPreferences(userId: string): Promise<IUserPreferences> {
    const preferences = await this.repository.findOrCreate(userId);
    return preferences;
  }

  /**
   * Get preference scores for AI Engine integration
   */
  async getPreferenceScores(userId: string): Promise<IPreferenceScores> {
    const preferences = await this.repository.findOrCreate(userId);
    return preferences.preferenceScores;
  }

  /**
   * Delete user preferences
   */
  async deletePreferences(userId: string): Promise<void> {
    const deleted = await this.repository.delete(userId);
    if (!deleted) {
      throw new AppError('User preferences not found', 404);
    }
  }

  // ============================================================================
  // PREFERENCE SCORES OPERATIONS
  // ============================================================================

  /**
   * Update preference scores (history, adventure, nature, relaxation)
   * Validates that scores are between 0 and 1
   */
  async updatePreferenceScores(
    userId: string,
    scores: UpdatePreferenceScoresDTO
  ): Promise<IUserPreferences> {
    // Validate scores are between 0 and 1
    for (const [key, value] of Object.entries(scores)) {
      if (value !== undefined) {
        if (value < 0 || value > 1) {
          throw new AppError(`${key} score must be between 0 and 1`, 400);
        }
      }
    }

    // Ensure preferences exist
    await this.repository.findOrCreate(userId);

    const updated = await this.repository.updatePreferenceScores(userId, scores);
    if (!updated) {
      throw new AppError('Failed to update preference scores', 500);
    }

    return updated;
  }

  // ============================================================================
  // TRAVEL STYLE OPERATIONS
  // ============================================================================

  /**
   * Update travel style preferences
   */
  async updateTravelStyle(
    userId: string,
    travelStyle: UpdateTravelStyleDTO
  ): Promise<IUserPreferences> {
    await this.repository.findOrCreate(userId);

    const updated = await this.repository.updateTravelStyle(userId, travelStyle);
    if (!updated) {
      throw new AppError('Failed to update travel style', 500);
    }

    return updated;
  }

  // ============================================================================
  // SAVED LOCATIONS OPERATIONS
  // ============================================================================

  /**
   * Save a location to favorites
   */
  async saveLocation(
    userId: string,
    location: SaveLocationDTO
  ): Promise<IUserPreferences> {
    await this.repository.findOrCreate(userId);

    // Check if already saved
    const alreadySaved = await this.repository.isLocationSaved(userId, location.locationId);
    if (alreadySaved) {
      throw new AppError('Location is already saved', 409);
    }

    const savedLocation: ISavedLocation = {
      locationId: location.locationId,
      name: location.name,
      latitude: location.latitude,
      longitude: location.longitude,
      category: location.category,
      savedAt: new Date(),
      notes: location.notes,
    };

    const updated = await this.repository.addSavedLocation(userId, savedLocation);
    if (!updated) {
      throw new AppError('Failed to save location', 500);
    }

    return updated;
  }

  /**
   * Remove a saved location
   */
  async removeSavedLocation(
    userId: string,
    locationId: string
  ): Promise<IUserPreferences> {
    const updated = await this.repository.removeSavedLocation(userId, locationId);
    if (!updated) {
      throw new AppError('User preferences not found', 404);
    }
    return updated;
  }

  /**
   * Get all saved locations
   */
  async getSavedLocations(userId: string): Promise<ISavedLocation[]> {
    return await this.repository.getSavedLocations(userId);
  }

  /**
   * Check if a location is saved
   */
  async isLocationSaved(userId: string, locationId: string): Promise<boolean> {
    return await this.repository.isLocationSaved(userId, locationId);
  }

  /**
   * Update notes for a saved location
   */
  async updateSavedLocationNotes(
    userId: string,
    locationId: string,
    notes: string
  ): Promise<IUserPreferences> {
    const updated = await this.repository.updateSavedLocationNotes(
      userId,
      locationId,
      notes
    );
    if (!updated) {
      throw new AppError('Saved location not found', 404);
    }
    return updated;
  }

  // ============================================================================
  // SEARCH HISTORY OPERATIONS
  // ============================================================================

  /**
   * Add a search history entry
   */
  async addSearchHistory(
    userId: string,
    data: AddSearchHistoryDTO
  ): Promise<IUserPreferences> {
    await this.repository.findOrCreate(userId);

    const entry: ISearchHistoryEntry = {
      query: data.query,
      timestamp: new Date(),
      resultCount: data.resultCount,
      selectedLocationId: data.selectedLocationId,
      selectedLocationName: data.selectedLocationName,
    };

    const updated = await this.repository.addSearchHistory(userId, entry);
    if (!updated) {
      throw new AppError('Failed to add search history', 500);
    }

    return updated;
  }

  /**
   * Get search history
   */
  async getSearchHistory(
    userId: string,
    limit: number = 50
  ): Promise<ISearchHistoryEntry[]> {
    return await this.repository.getSearchHistory(userId, limit);
  }

  /**
   * Clear all search history
   */
  async clearSearchHistory(userId: string): Promise<IUserPreferences> {
    const updated = await this.repository.clearSearchHistory(userId);
    if (!updated) {
      throw new AppError('User preferences not found', 404);
    }
    return updated;
  }

  // ============================================================================
  // CATEGORIES OPERATIONS
  // ============================================================================

  /**
   * Update favorite and avoid categories
   */
  async updateCategories(
    userId: string,
    data: UpdateCategoriesDTO
  ): Promise<IUserPreferences> {
    await this.repository.findOrCreate(userId);

    const updated = await this.repository.updateCategories(
      userId,
      data.favoriteCategories,
      data.avoidCategories
    );
    if (!updated) {
      throw new AppError('Failed to update categories', 500);
    }

    return updated;
  }

  /**
   * Add a category to favorites
   */
  async addFavoriteCategory(
    userId: string,
    category: string
  ): Promise<IUserPreferences> {
    await this.repository.findOrCreate(userId);

    const updated = await this.repository.addFavoriteCategory(userId, category);
    if (!updated) {
      throw new AppError('Failed to add favorite category', 500);
    }

    return updated;
  }

  /**
   * Remove a category from favorites
   */
  async removeFavoriteCategory(
    userId: string,
    category: string
  ): Promise<IUserPreferences> {
    const updated = await this.repository.removeFavoriteCategory(userId, category);
    if (!updated) {
      throw new AppError('User preferences not found', 404);
    }
    return updated;
  }

  // ============================================================================
  // VISITED LOCATIONS OPERATIONS
  // ============================================================================

  /**
   * Mark a location as visited
   */
  async markLocationVisited(
    userId: string,
    locationId: string
  ): Promise<IUserPreferences> {
    await this.repository.findOrCreate(userId);

    const updated = await this.repository.addVisitedLocation(userId, locationId);
    if (!updated) {
      throw new AppError('Failed to mark location as visited', 500);
    }

    return updated;
  }

  /**
   * Remove a location from visited
   */
  async unmarkLocationVisited(
    userId: string,
    locationId: string
  ): Promise<IUserPreferences> {
    const updated = await this.repository.removeVisitedLocation(userId, locationId);
    if (!updated) {
      throw new AppError('User preferences not found', 404);
    }
    return updated;
  }

  /**
   * Get all visited locations
   */
  async getVisitedLocations(userId: string): Promise<string[]> {
    return await this.repository.getVisitedLocations(userId);
  }

  // ============================================================================
  // HOME LOCATION OPERATIONS
  // ============================================================================

  /**
   * Update home location
   */
  async updateHomeLocation(
    userId: string,
    homeLocation: UpdateHomeLocationDTO
  ): Promise<IUserPreferences> {
    // Validate coordinates
    if (homeLocation.latitude < -90 || homeLocation.latitude > 90) {
      throw new AppError('Latitude must be between -90 and 90', 400);
    }
    if (homeLocation.longitude < -180 || homeLocation.longitude > 180) {
      throw new AppError('Longitude must be between -180 and 180', 400);
    }

    await this.repository.findOrCreate(userId);

    const updated = await this.repository.updateHomeLocation(userId, homeLocation);
    if (!updated) {
      throw new AppError('Failed to update home location', 500);
    }

    return updated;
  }

  // ============================================================================
  // NOTIFICATION PREFERENCES OPERATIONS
  // ============================================================================

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(
    userId: string,
    preferences: UpdateNotificationPreferencesDTO
  ): Promise<IUserPreferences> {
    await this.repository.findOrCreate(userId);

    const updated = await this.repository.updateNotificationPreferences(
      userId,
      preferences
    );
    if (!updated) {
      throw new AppError('Failed to update notification preferences', 500);
    }

    return updated;
  }
}
