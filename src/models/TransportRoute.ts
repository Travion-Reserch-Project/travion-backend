import mongoose, { Schema, Document } from 'mongoose';

export interface ITransportRoute extends Document {
  route_id: string;
  origin_city_id: number;
  destination_city_id: number;
  transport_type: 'bus' | 'train' | 'car';
  distance_km: number;
  estimated_time_min: number;
  base_fare_lkr?: number;
  has_transfer: boolean;
  route_details?: {
    stops?: string[];
    transfer_points?: string[];
    frequency?: string;
    schedule?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const TransportRouteSchema = new Schema<ITransportRoute>(
  {
    route_id: {
      type: String,
      required: true,
      unique: true,
    },
    origin_city_id: {
      type: Number,
      required: true,
      ref: 'City',
    },
    destination_city_id: {
      type: Number,
      required: true,
      ref: 'City',
    },
    transport_type: {
      type: String,
      enum: ['bus', 'train', 'car'],
      required: true,
    },
    distance_km: {
      type: Number,
      required: true,
    },
    estimated_time_min: {
      type: Number,
      required: true,
    },
    base_fare_lkr: {
      type: Number,
      required: false,
    },
    has_transfer: {
      type: Boolean,
      default: false,
    },
    route_details: {
      stops: {
        type: [String],
        required: false,
      },
      transfer_points: {
        type: [String],
        required: false,
      },
      frequency: {
        type: String,
        required: false,
      },
      schedule: {
        type: String,
        required: false,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
TransportRouteSchema.index({ route_id: 1 });
TransportRouteSchema.index({ origin_city_id: 1, destination_city_id: 1 });
TransportRouteSchema.index({ transport_type: 1 });

export const TransportRoute = mongoose.model<ITransportRoute>(
  'TransportRoute',
  TransportRouteSchema
);
