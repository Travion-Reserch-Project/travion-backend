//models/DeviceToken.ts

import mongoose, { Document, Schema } from 'mongoose';

export interface IDeviceToken extends Document {
  userId?: mongoose.Types.ObjectId;
  deviceToken: string;
  platform: 'ios' | 'android';
  location: {
    type: string;
    coordinates: [number, number]; // [longitude, latitude] - GeoJSON format
  };
  locationUpdatedAt: Date;
  isActive: boolean;
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const deviceTokenSchema = new Schema<IDeviceToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false, // Allows anonymous users
    },
    deviceToken: {
      type: String,
      required: [true, 'Device token is required'],
      unique: true,
      trim: true,
    },
    platform: {
      type: String,
      required: [true, 'Platform is required'],
      enum: ['ios', 'android'],
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: [true, 'Location coordinates are required'],
        validate: {
          validator: function (v: number[]) {
            return v.length === 2 && v[0] >= -180 && v[0] <= 180 && v[1] >= -90 && v[1] <= 90;
          },
          message: 'Invalid coordinates format. Must be [longitude, latitude]',
        },
      },
    },
    locationUpdatedAt: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// Create 2dsphere index for geospatial queries
deviceTokenSchema.index({ location: '2dsphere' });

// Index for querying by userId
deviceTokenSchema.index({ userId: 1 });

// Index for finding active tokens
deviceTokenSchema.index({ isActive: 1, lastActiveAt: -1 });

// Compound index for efficient token lookups
deviceTokenSchema.index({ deviceToken: 1, isActive: 1 });

// Method to update last active timestamp
deviceTokenSchema.methods.updateLastActive = function () {
  this.lastActiveAt = new Date();
  return this.save();
};

// Static method to find nearby active devices
deviceTokenSchema.statics.findNearbyDevices = function (
  longitude: number,
  latitude: number,
  radiusInKm: number = 5,
  excludeUserId?: mongoose.Types.ObjectId,
) {
  const radiusInMeters = radiusInKm * 1000;

  const query: any = {
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
        $maxDistance: radiusInMeters,
      },
    },
    isActive: true,
  };

  // Exclude specific user if provided
  if (excludeUserId) {
    query.userId = { $ne: excludeUserId };
  }

  return this.find(query);
};

// Static method to cleanup old inactive tokens
deviceTokenSchema.statics.cleanupInactiveTokens = function (daysInactive: number = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

  return this.deleteMany({
    lastActiveAt: { $lt: cutoffDate },
    isActive: false,
  });
};

export const DeviceToken = mongoose.model<IDeviceToken>('DeviceToken', deviceTokenSchema);
