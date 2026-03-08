import mongoose, { Document, Schema } from 'mongoose';

/**
 * Location document interface
 */
export interface ILocation extends Document {
  name: string;
  preferenceScores: {
    history: number;    // l_hist: Interest in historical/cultural sites
    adventure: number;  // l_adv: Interest in adventure activities
    nature: number;     // l_nat: Interest in nature/wildlife
    relaxation: number; // l_rel: Interest in relaxation/spiritual
  };
  isOutdoor: boolean;   // l_outdoor
  coordinates: {
    latitude: number;   // l_lat
    longitude: number;  // l_lng
  };
  imageUrls: string[];  // Array of image URLs
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Location Schema
 */
const locationSchema = new Schema<ILocation>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    preferenceScores: {
      history: {
        type: Number,
        required: true,
        min: 0,
        max: 1,
        default: 0.5,
      },
      adventure: {
        type: Number,
        required: true,
        min: 0,
        max: 1,
        default: 0.5,
      },
      nature: {
        type: Number,
        required: true,
        min: 0,
        max: 1,
        default: 0.5,
      },
      relaxation: {
        type: Number,
        required: true,
        min: 0,
        max: 1,
        default: 0.5,
      },
    },
    isOutdoor: {
      type: Boolean,
      required: true,
      default: true,
    },
    coordinates: {
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
    },
    imageUrls: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: 'locations',
  }
);

// Create 2dsphere index for geospatial queries
locationSchema.index({ 'coordinates.latitude': 1, 'coordinates.longitude': 1 });

// Text index for location name search
locationSchema.index({ name: 'text' });

/**
 * Location Model
 */
export const Location = mongoose.model<ILocation>('Location', locationSchema);

export default Location;


