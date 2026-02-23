import mongoose, { Schema, Document } from 'mongoose';

export interface ITransportStation extends Document {
  station_id: number;
  name: string;
  station_type: 'bus' | 'train';
  city_id: number;
  location: {
    type: string;
    coordinates: [number, number]; // [longitude, latitude]
  };
  operator?: string;
  additional_info?: {
    platforms?: number;
    facilities?: string[];
    operating_hours?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const TransportStationSchema = new Schema<ITransportStation>(
  {
    station_id: {
      type: Number,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    station_type: {
      type: String,
      enum: ['bus', 'train'],
      required: true,
    },
    city_id: {
      type: Number,
      required: true,
      ref: 'City',
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    operator: {
      type: String,
      required: false,
    },
    additional_info: {
      platforms: {
        type: Number,
        required: false,
      },
      facilities: {
        type: [String],
        required: false,
      },
      operating_hours: {
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
TransportStationSchema.index({ location: '2dsphere' });
TransportStationSchema.index({ station_id: 1 });
TransportStationSchema.index({ city_id: 1 });
TransportStationSchema.index({ station_type: 1 });
TransportStationSchema.index({ name: 'text' });

export const TransportStation = mongoose.model<ITransportStation>(
  'TransportStation',
  TransportStationSchema
);
