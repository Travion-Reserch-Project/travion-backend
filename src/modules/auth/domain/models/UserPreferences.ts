/**
 * UserPreferences Model
 * Stores user travel preferences, saved locations, and search history
 * Used for personalized recommendations via the AI Engine
 */

import mongoose, { Document, Schema } from 'mongoose';

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Saved/favorite location entry
 */
export interface ISavedLocation {
  locationId: string;
  name: string;
  latitude?: number;
  longitude?: number;
  category?: string;
  savedAt: Date;
  notes?: string;
}

/**
 * Search history entry
 */
export interface ISearchHistoryEntry {
  query: string;
  timestamp: Date;
  resultCount?: number;
  selectedLocationId?: string;
  selectedLocationName?: string;
}

/**
 * Travel style preferences
 */
export interface ITravelStylePreferences {
  pacePreference: 'slow' | 'moderate' | 'fast';
  budgetRange: 'budget' | 'mid-range' | 'luxury';
  groupSize: 'solo' | 'couple' | 'small-group' | 'large-group';
  accessibility: boolean;
  dietaryRestrictions?: string[];
  transportationPreferences?: string[];
  accommodationType?: 'hotel' | 'hostel' | 'resort' | 'homestay' | 'any';
}

/**
 * Preference scores for recommendation matching
 * Based on AI Engine recommendation system dimensions
 */
export interface IPreferenceScores {
  history: number;     // 0-1: Interest in historical/cultural sites (Sigiriya, Anuradhapura)
  adventure: number;   // 0-1: Interest in adventure activities (rafting, hiking)
  nature: number;      // 0-1: Interest in nature and wildlife (Yala, Sinharaja)
  relaxation: number;  // 0-1: Interest in relaxation and leisure (beaches, spas)
}

/**
 * Main UserPreferences document interface
 */
export interface IUserPreferences extends Document {
  userId: mongoose.Types.ObjectId;
  preferenceScores: IPreferenceScores;
  travelStyle: ITravelStylePreferences;
  savedLocations: ISavedLocation[];
  searchHistory: ISearchHistoryEntry[];
  favoriteCategories: string[];
  avoidCategories: string[];
  visitedLocations: string[];
  homeLocation?: {
    latitude: number;
    longitude: number;
    city?: string;
    country?: string;
  };
  notificationPreferences: {
    goldenHourAlerts: boolean;
    crowdAlerts: boolean;
    eventAlerts: boolean;
    poyaDayReminders: boolean;
  };
  lastUpdated: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// SUB-SCHEMAS
// ============================================================================

const savedLocationSchema = new Schema<ISavedLocation>(
  {
    locationId: {
      type: String,
      required: [true, 'Location ID is required'],
    },
    name: {
      type: String,
      required: [true, 'Location name is required'],
      trim: true,
    },
    latitude: {
      type: Number,
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      min: -180,
      max: 180,
    },
    category: {
      type: String,
      trim: true,
    },
    savedAt: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      maxlength: 1000,
    },
  },
  { _id: false }
);

const searchHistoryEntrySchema = new Schema<ISearchHistoryEntry>(
  {
    query: {
      type: String,
      required: [true, 'Search query is required'],
      trim: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    resultCount: {
      type: Number,
      min: 0,
    },
    selectedLocationId: {
      type: String,
    },
    selectedLocationName: {
      type: String,
    },
  },
  { _id: false }
);

const travelStyleSchema = new Schema<ITravelStylePreferences>(
  {
    pacePreference: {
      type: String,
      enum: ['slow', 'moderate', 'fast'],
      default: 'moderate',
    },
    budgetRange: {
      type: String,
      enum: ['budget', 'mid-range', 'luxury'],
      default: 'mid-range',
    },
    groupSize: {
      type: String,
      enum: ['solo', 'couple', 'small-group', 'large-group'],
      default: 'solo',
    },
    accessibility: {
      type: Boolean,
      default: false,
    },
    dietaryRestrictions: [{
      type: String,
      trim: true,
    }],
    transportationPreferences: [{
      type: String,
      trim: true,
    }],
    accommodationType: {
      type: String,
      enum: ['hotel', 'hostel', 'resort', 'homestay', 'any'],
      default: 'any',
    },
  },
  { _id: false }
);

const preferenceScoresSchema = new Schema<IPreferenceScores>(
  {
    history: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5,
    },
    adventure: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5,
    },
    nature: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5,
    },
    relaxation: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5,
    },
  },
  { _id: false }
);

const homeLocationSchema = new Schema(
  {
    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
    },
    city: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const notificationPreferencesSchema = new Schema(
  {
    goldenHourAlerts: {
      type: Boolean,
      default: true,
    },
    crowdAlerts: {
      type: Boolean,
      default: true,
    },
    eventAlerts: {
      type: Boolean,
      default: true,
    },
    poyaDayReminders: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

// ============================================================================
// MAIN SCHEMA
// ============================================================================

const userPreferencesSchema = new Schema<IUserPreferences>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      unique: true,
      index: true,
    },
    preferenceScores: {
      type: preferenceScoresSchema,
      default: () => ({
        history: 0.5,
        adventure: 0.5,
        nature: 0.5,
        relaxation: 0.5,
      }),
    },
    travelStyle: {
      type: travelStyleSchema,
      default: () => ({
        pacePreference: 'moderate',
        budgetRange: 'mid-range',
        groupSize: 'solo',
        accessibility: false,
        accommodationType: 'any',
      }),
    },
    savedLocations: {
      type: [savedLocationSchema],
      default: [],
      validate: {
        validator: function (v: ISavedLocation[]) {
          return v.length <= 100; // Max 100 saved locations
        },
        message: 'Cannot save more than 100 locations',
      },
    },
    searchHistory: {
      type: [searchHistoryEntrySchema],
      default: [],
    },
    favoriteCategories: [{
      type: String,
      trim: true,
    }],
    avoidCategories: [{
      type: String,
      trim: true,
    }],
    visitedLocations: [{
      type: String,
      trim: true,
    }],
    homeLocation: {
      type: homeLocationSchema,
    },
    notificationPreferences: {
      type: notificationPreferencesSchema,
      default: () => ({
        goldenHourAlerts: true,
        crowdAlerts: true,
        eventAlerts: true,
        poyaDayReminders: true,
      }),
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (_doc, ret: Record<string, unknown>) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ============================================================================
// INDEXES
// ============================================================================

// Index for efficient querying
userPreferencesSchema.index({ userId: 1 });
userPreferencesSchema.index({ 'savedLocations.locationId': 1 });
userPreferencesSchema.index({ 'searchHistory.timestamp': -1 });
userPreferencesSchema.index({ lastUpdated: -1 });

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Update lastUpdated timestamp on save
userPreferencesSchema.pre('save', function (next) {
  this.lastUpdated = new Date();
  next();
});

// Limit search history to 100 entries
userPreferencesSchema.pre('save', function (next) {
  if (this.searchHistory && this.searchHistory.length > 100) {
    // Keep only the most recent 100 entries
    this.searchHistory = this.searchHistory
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 100);
  }
  next();
});

// ============================================================================
// EXPORT
// ============================================================================

export const UserPreferences = mongoose.model<IUserPreferences>(
  'UserPreferences',
  userPreferencesSchema
);
