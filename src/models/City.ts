import mongoose, { Schema, Document } from 'mongoose';

export interface ICity extends Document {
  city_id: number;
  district_id: number;
  name: {
    en: string;
    si: string;
    ta: string;
  };
  location: {
    type: string;
    coordinates: [number, number]; // [longitude, latitude]
  };
  transport_access: {
    has_railway: boolean;
    has_bus: boolean;
    has_any_transport: boolean;
    has_both: boolean;
  };
  transport_stats: {
    railway_stations_count: number;
    bus_stations_count: number;
    distance_to_nearest_railway_km?: number;
    distance_to_nearest_bus_km?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const CitySchema = new Schema<ICity>(
  {
    city_id: {
      type: Number,
      required: true,
      unique: true,
    },
    district_id: {
      type: Number,
      required: true,
      ref: 'District',
    },
    name: {
      en: {
        type: String,
        required: true,
      },
      si: {
        type: String,
        required: true,
      },
      ta: {
        type: String,
        required: true,
      },
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
    transport_access: {
      has_railway: {
        type: Boolean,
        default: false,
      },
      has_bus: {
        type: Boolean,
        default: false,
      },
      has_any_transport: {
        type: Boolean,
        default: false,
      },
      has_both: {
        type: Boolean,
        default: false,
      },
    },
    transport_stats: {
      railway_stations_count: {
        type: Number,
        default: 0,
      },
      bus_stations_count: {
        type: Number,
        default: 0,
      },
      distance_to_nearest_railway_km: {
        type: Number,
        required: false,
      },
      distance_to_nearest_bus_km: {
        type: Number,
        required: false,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Geospatial index for location-based queries
CitySchema.index({ location: '2dsphere' });
CitySchema.index({ city_id: 1 });
CitySchema.index({ district_id: 1 });
CitySchema.index({ 'name.en': 'text', 'name.si': 'text', 'name.ta': 'text' });

export const City = mongoose.model<ICity>('City', CitySchema);
