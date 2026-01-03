import mongoose, { Document, Schema } from 'mongoose';

export interface ISafetyAlert extends Document {
  userId: mongoose.Types.ObjectId;
  location: {
    latitude: number;
    longitude: number;
    address?: string;
    locationName?: string;
  };
  features: {
    area_cluster: number;
    is_beach: number;
    is_crowded: number;
    is_tourist_place: number;
    is_transit: number;
    hour: number;
    day_of_week: number;
    is_weekend: number;
    police_nearby: number;
  };
  predictions: {
    incidentType: string;
    riskLevel: 'low' | 'medium' | 'high';
    confidence: number;
  }[];
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const safetyAlertSchema = new Schema<ISafetyAlert>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    location: {
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
      address: {
        type: String,
        trim: true,
      },
      locationName: {
        type: String,
        trim: true,
      },
    },
    features: {
      area_cluster: { type: Number, default: 0 },
      is_beach: { type: Number, default: 0, min: 0, max: 1 },
      is_crowded: { type: Number, default: 0, min: 0, max: 1 },
      is_tourist_place: { type: Number, default: 0, min: 0, max: 1 },
      is_transit: { type: Number, default: 0, min: 0, max: 1 },
      hour: { type: Number, default: 0, min: 0, max: 23 },
      day_of_week: { type: Number, default: 0, min: 0, max: 6 },
      is_weekend: { type: Number, default: 0, min: 0, max: 1 },
      police_nearby: { type: Number, default: 0, min: 0, max: 1 },
    },
    predictions: [
      {
        incidentType: {
          type: String,
          required: true,
          enum: [
            'Scam',
            'Pickpocket',
            'Theft',
            'Money Theft',
            'Harassment',
            'Bag Snatching',
            'Extortion',
          ],
        },
        riskLevel: {
          type: String,
          required: true,
          enum: ['low', 'medium', 'high'],
        },
        confidence: {
          type: Number,
          required: true,
          min: 0,
          max: 1,
        },
      },
    ],
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
safetyAlertSchema.index({ userId: 1, timestamp: -1 });
safetyAlertSchema.index({ 'location.latitude': 1, 'location.longitude': 1 });

export const SafetyAlert = mongoose.model<ISafetyAlert>('SafetyAlert', safetyAlertSchema);
