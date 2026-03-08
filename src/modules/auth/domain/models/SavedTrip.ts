/**
 * SavedTrip Model
 * Stores user-saved trips and AI-generated itineraries
 * Integrates with AI Engine chat and recommendation responses
 */

import mongoose, { Document, Schema } from 'mongoose';

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Itinerary item within a trip
 */
export interface IItineraryItem {
  order: number;
  time: string; // HH:MM format
  locationName: string;
  locationId?: string;
  latitude?: number;
  longitude?: number;
  activity: string;
  durationMinutes: number;
  notes?: string;
  crowdPrediction?: number; // 0-100 percentage
  lightingQuality?: 'golden' | 'blue' | 'good' | 'harsh' | 'dark';
  constraints?: string[];
}

/**
 * Constraint violation from AI Engine
 */
export interface ITripConstraint {
  constraintType: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestion?: string;
}

/**
 * AI metadata for generated trips
 */
export interface IAIMetadata {
  sessionId?: string;
  model?: string;
  reasoningLoops?: number;
  documentsRetrieved?: number;
  webSearchUsed?: boolean;
  generatedAt: Date;
}

/**
 * Main SavedTrip document interface
 */
export interface ISavedTrip extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  destinations: string[];
  itinerary: IItineraryItem[];
  totalDays: number;
  isPublic: boolean;
  status: 'draft' | 'planned' | 'ongoing' | 'completed' | 'cancelled';
  coverImage?: string;
  tags: string[];
  estimatedBudget?: {
    currency: string;
    amount: number;
  };
  travelersCount: number;
  generatedBy: 'user' | 'ai';
  aiMetadata?: IAIMetadata;
  constraints?: ITripConstraint[];
  rating?: number;
  review?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// SUB-SCHEMAS
// ============================================================================

const itineraryItemSchema = new Schema<IItineraryItem>(
  {
    order: {
      type: Number,
      required: [true, 'Order is required'],
      min: 0,
    },
    time: {
      type: String,
      required: [true, 'Time is required'],
      match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'],
    },
    locationName: {
      type: String,
      required: [true, 'Location name is required'],
      trim: true,
      maxlength: 200,
    },
    locationId: {
      type: String,
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
    activity: {
      type: String,
      required: [true, 'Activity is required'],
      trim: true,
      maxlength: 500,
    },
    durationMinutes: {
      type: Number,
      required: [true, 'Duration is required'],
      min: 1,
      max: 1440, // Max 24 hours
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    crowdPrediction: {
      type: Number,
      min: 0,
      max: 100,
    },
    lightingQuality: {
      type: String,
      enum: ['golden', 'blue', 'good', 'harsh', 'dark'],
    },
    constraints: [{
      type: String,
      trim: true,
    }],
  },
  { _id: false }
);

const tripConstraintSchema = new Schema<ITripConstraint>(
  {
    constraintType: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      required: true,
    },
    suggestion: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const aiMetadataSchema = new Schema<IAIMetadata>(
  {
    sessionId: {
      type: String,
      trim: true,
    },
    model: {
      type: String,
      trim: true,
    },
    reasoningLoops: {
      type: Number,
      min: 0,
    },
    documentsRetrieved: {
      type: Number,
      min: 0,
    },
    webSearchUsed: {
      type: Boolean,
      default: false,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const estimatedBudgetSchema = new Schema(
  {
    currency: {
      type: String,
      default: 'USD',
      trim: true,
      maxlength: 3,
    },
    amount: {
      type: Number,
      min: 0,
    },
  },
  { _id: false }
);

// ============================================================================
// MAIN SCHEMA
// ============================================================================

const savedTripSchema = new Schema<ISavedTrip>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Trip title is required'],
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    destinations: [{
      type: String,
      trim: true,
    }],
    itinerary: {
      type: [itineraryItemSchema],
      default: [],
      validate: {
        validator: function(v: IItineraryItem[]) {
          return v.length <= 200; // Max 200 items per trip
        },
        message: 'Itinerary cannot have more than 200 items',
      },
    },
    totalDays: {
      type: Number,
      required: [true, 'Total days is required'],
      min: 1,
      max: 365,
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['draft', 'planned', 'ongoing', 'completed', 'cancelled'],
      default: 'draft',
    },
    coverImage: {
      type: String,
      trim: true,
    },
    tags: [{
      type: String,
      trim: true,
      maxlength: 50,
    }],
    estimatedBudget: {
      type: estimatedBudgetSchema,
    },
    travelersCount: {
      type: Number,
      default: 1,
      min: 1,
      max: 100,
    },
    generatedBy: {
      type: String,
      enum: ['user', 'ai'],
      default: 'user',
    },
    aiMetadata: {
      type: aiMetadataSchema,
    },
    constraints: {
      type: [tripConstraintSchema],
      default: [],
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    review: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function(_doc, ret: Record<string, unknown>) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ============================================================================
// INDEXES
// ============================================================================

savedTripSchema.index({ userId: 1, status: 1 });
savedTripSchema.index({ userId: 1, startDate: -1 });
savedTripSchema.index({ isPublic: 1, createdAt: -1 });
savedTripSchema.index({ userId: 1, createdAt: -1 });
savedTripSchema.index({ tags: 1 });

// ============================================================================
// VALIDATION
// ============================================================================

// Validate endDate is after startDate
savedTripSchema.pre('save', function(next) {
  if (this.endDate < this.startDate) {
    const error = new Error('End date must be after start date');
    return next(error);
  }
  next();
});

// Calculate totalDays if not provided
savedTripSchema.pre('save', function(next) {
  if (this.startDate && this.endDate) {
    const diffTime = Math.abs(this.endDate.getTime() - this.startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    this.totalDays = diffDays + 1; // Include both start and end days
  }
  next();
});

// ============================================================================
// EXPORT
// ============================================================================

export const SavedTrip = mongoose.model<ISavedTrip>('SavedTrip', savedTripSchema);
