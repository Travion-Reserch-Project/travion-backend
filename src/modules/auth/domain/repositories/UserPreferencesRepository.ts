/**
 * UserPreferences Repository
 * Data access layer for user preferences, saved locations, and search history
 */

import mongoose from 'mongoose';
import {
  UserPreferences,
  IUserPreferences,
  ISavedLocation,
  ISearchHistoryEntry,
  IPreferenceScores,
  ITravelStylePreferences,
} from '../models/UserPreferences';

export class UserPreferencesRepository {
  // ============================================================================
  // CORE CRUD OPERATIONS
  // ============================================================================

  /**
   * Create new preferences document for a user
   */
  async create(userId: string): Promise<IUserPreferences> {
    const preferences = new UserPreferences({
      userId: new mongoose.Types.ObjectId(userId),
    });
    return await preferences.save();
  }

  /**
   * Find preferences by user ID
   */
  async findByUserId(userId: string): Promise<IUserPreferences | null> {
    return await UserPreferences.findOne({
      userId: new mongoose.Types.ObjectId(userId),
    });
  }

  /**
   * Find preferences or create if not exists
   */
  async findOrCreate(userId: string): Promise<IUserPreferences> {
    let preferences = await this.findByUserId(userId);
    if (!preferences) {
      preferences = await this.create(userId);
    }
    return preferences;
  }

  /**
   * Update preferences document
   */
  async update(
    userId: string,
    data: Partial<IUserPreferences>
  ): Promise<IUserPreferences | null> {
    return await UserPreferences.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId) },
      { $set: data },
      { new: true, runValidators: true }
    );
  }

  /**
   * Delete preferences document
   */
  async delete(userId: string): Promise<IUserPreferences | null> {
    return await UserPreferences.findOneAndDelete({
      userId: new mongoose.Types.ObjectId(userId),
    });
  }

  // ============================================================================
  // PREFERENCE SCORES OPERATIONS
  // ============================================================================

  /**
   * Update preference scores (history, adventure, nature, relaxation)
   */
  async updatePreferenceScores(
    userId: string,
    scores: Partial<IPreferenceScores>
  ): Promise<IUserPreferences | null> {
    const updateObj: Record<string, number> = {};

    if (scores.history !== undefined) {
      updateObj['preferenceScores.history'] = scores.history;
    }
    if (scores.adventure !== undefined) {
      updateObj['preferenceScores.adventure'] = scores.adventure;
    }
    if (scores.nature !== undefined) {
      updateObj['preferenceScores.nature'] = scores.nature;
    }
    if (scores.relaxation !== undefined) {
      updateObj['preferenceScores.relaxation'] = scores.relaxation;
    }

    return await UserPreferences.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId) },
      { $set: updateObj },
      { new: true, runValidators: true }
    );
  }

  /**
   * Get preference scores only
   */
  async getPreferenceScores(userId: string): Promise<IPreferenceScores | null> {
    const preferences = await UserPreferences.findOne(
      { userId: new mongoose.Types.ObjectId(userId) },
      { preferenceScores: 1 }
    );
    return preferences?.preferenceScores || null;
  }

  // ============================================================================
  // TRAVEL STYLE OPERATIONS
  // ============================================================================

  /**
   * Update travel style preferences
   */
  async updateTravelStyle(
    userId: string,
    travelStyle: Partial<ITravelStylePreferences>
  ): Promise<IUserPreferences | null> {
    const updateObj: Record<string, unknown> = {};

    Object.entries(travelStyle).forEach(([key, value]) => {
      if (value !== undefined) {
        updateObj[`travelStyle.${key}`] = value;
      }
    });

    return await UserPreferences.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId) },
      { $set: updateObj },
      { new: true, runValidators: true }
    );
  }

  // ============================================================================
  // SAVED LOCATIONS OPERATIONS
  // ============================================================================

  /**
   * Add a saved location
   */
  async addSavedLocation(
    userId: string,
    location: ISavedLocation
  ): Promise<IUserPreferences | null> {
    return await UserPreferences.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId) },
      {
        $push: {
          savedLocations: {
            ...location,
            savedAt: new Date(),
          },
        },
      },
      { new: true }
    );
  }

  /**
   * Remove a saved location by location ID
   */
  async removeSavedLocation(
    userId: string,
    locationId: string
  ): Promise<IUserPreferences | null> {
    return await UserPreferences.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId) },
      { $pull: { savedLocations: { locationId } } },
      { new: true }
    );
  }

  /**
   * Check if a location is saved
   */
  async isLocationSaved(userId: string, locationId: string): Promise<boolean> {
    const preferences = await UserPreferences.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      'savedLocations.locationId': locationId,
    });
    return !!preferences;
  }

  /**
   * Get all saved locations
   */
  async getSavedLocations(userId: string): Promise<ISavedLocation[]> {
    const preferences = await UserPreferences.findOne(
      { userId: new mongoose.Types.ObjectId(userId) },
      { savedLocations: 1 }
    );
    return preferences?.savedLocations || [];
  }

  /**
   * Update notes for a saved location
   */
  async updateSavedLocationNotes(
    userId: string,
    locationId: string,
    notes: string
  ): Promise<IUserPreferences | null> {
    return await UserPreferences.findOneAndUpdate(
      {
        userId: new mongoose.Types.ObjectId(userId),
        'savedLocations.locationId': locationId,
      },
      { $set: { 'savedLocations.$.notes': notes } },
      { new: true }
    );
  }

  // ============================================================================
  // SEARCH HISTORY OPERATIONS
  // ============================================================================

  /**
   * Add a search history entry (keeps only last 100)
   */
  async addSearchHistory(
    userId: string,
    entry: ISearchHistoryEntry
  ): Promise<IUserPreferences | null> {
    return await UserPreferences.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId) },
      {
        $push: {
          searchHistory: {
            $each: [{ ...entry, timestamp: new Date() }],
            $slice: -100, // Keep only last 100 entries
            $sort: { timestamp: 1 },
          },
        },
      },
      { new: true }
    );
  }

  /**
   * Get search history (most recent first)
   */
  async getSearchHistory(
    userId: string,
    limit: number = 50
  ): Promise<ISearchHistoryEntry[]> {
    const preferences = await UserPreferences.findOne(
      { userId: new mongoose.Types.ObjectId(userId) },
      { searchHistory: { $slice: -limit } }
    );

    return (preferences?.searchHistory || [])
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Clear all search history
   */
  async clearSearchHistory(userId: string): Promise<IUserPreferences | null> {
    return await UserPreferences.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId) },
      { $set: { searchHistory: [] } },
      { new: true }
    );
  }

  // ============================================================================
  // CATEGORIES OPERATIONS
  // ============================================================================

  /**
   * Update favorite and avoid categories
   */
  async updateCategories(
    userId: string,
    favoriteCategories?: string[],
    avoidCategories?: string[]
  ): Promise<IUserPreferences | null> {
    const updateObj: Record<string, string[]> = {};

    if (favoriteCategories !== undefined) {
      updateObj.favoriteCategories = favoriteCategories;
    }
    if (avoidCategories !== undefined) {
      updateObj.avoidCategories = avoidCategories;
    }

    return await UserPreferences.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId) },
      { $set: updateObj },
      { new: true, runValidators: true }
    );
  }

  /**
   * Add a category to favorites
   */
  async addFavoriteCategory(
    userId: string,
    category: string
  ): Promise<IUserPreferences | null> {
    return await UserPreferences.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId) },
      { $addToSet: { favoriteCategories: category } },
      { new: true }
    );
  }

  /**
   * Remove a category from favorites
   */
  async removeFavoriteCategory(
    userId: string,
    category: string
  ): Promise<IUserPreferences | null> {
    return await UserPreferences.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId) },
      { $pull: { favoriteCategories: category } },
      { new: true }
    );
  }

  // ============================================================================
  // VISITED LOCATIONS OPERATIONS
  // ============================================================================

  /**
   * Mark a location as visited
   */
  async addVisitedLocation(
    userId: string,
    locationId: string
  ): Promise<IUserPreferences | null> {
    return await UserPreferences.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId) },
      { $addToSet: { visitedLocations: locationId } },
      { new: true }
    );
  }

  /**
   * Remove a location from visited
   */
  async removeVisitedLocation(
    userId: string,
    locationId: string
  ): Promise<IUserPreferences | null> {
    return await UserPreferences.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId) },
      { $pull: { visitedLocations: locationId } },
      { new: true }
    );
  }

  /**
   * Get all visited locations
   */
  async getVisitedLocations(userId: string): Promise<string[]> {
    const preferences = await UserPreferences.findOne(
      { userId: new mongoose.Types.ObjectId(userId) },
      { visitedLocations: 1 }
    );
    return preferences?.visitedLocations || [];
  }

  // ============================================================================
  // HOME LOCATION OPERATIONS
  // ============================================================================

  /**
   * Update home location
   */
  async updateHomeLocation(
    userId: string,
    homeLocation: {
      latitude: number;
      longitude: number;
      city?: string;
      country?: string;
    }
  ): Promise<IUserPreferences | null> {
    return await UserPreferences.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId) },
      { $set: { homeLocation } },
      { new: true, runValidators: true }
    );
  }

  // ============================================================================
  // NOTIFICATION PREFERENCES OPERATIONS
  // ============================================================================

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(
    userId: string,
    preferences: {
      goldenHourAlerts?: boolean;
      crowdAlerts?: boolean;
      eventAlerts?: boolean;
      poyaDayReminders?: boolean;
    }
  ): Promise<IUserPreferences | null> {
    const updateObj: Record<string, boolean> = {};

    Object.entries(preferences).forEach(([key, value]) => {
      if (value !== undefined) {
        updateObj[`notificationPreferences.${key}`] = value;
      }
    });

    return await UserPreferences.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId) },
      { $set: updateObj },
      { new: true }
    );
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Check if preferences exist for a user
   */
  async exists(userId: string): Promise<boolean> {
    const preferences = await UserPreferences.findOne({
      userId: new mongoose.Types.ObjectId(userId),
    });
    return !!preferences;
  }

  /**
   * Count total preferences documents
   */
  async count(): Promise<number> {
    return await UserPreferences.countDocuments();
  }
}
