import mongoose, { Schema, Document } from 'mongoose';

export interface ILocation {
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  district?: string;
}

export interface IIncidentVerification {
  confirmed_by_users: string[]; // User IDs who confirmed this incident
  count: number;
  last_confirmed_at?: Date;
}

export interface IAffectedRoute {
  route_name: string; // e.g., "Colombo to Kandy via A1 Highway"
  polyline?: string; // Encoded polyline from Google Maps for rendering
  coordinates: {
    start: { latitude: number; longitude: number; address?: string };
    end: { latitude: number; longitude: number; address?: string };
  };
  bounds?: {
    northeast: { latitude: number; longitude: number };
    southwest: { latitude: number; longitude: number };
  };
  distance_km?: number;
  estimated_delay_min?: number;
  transport_types?: string[]; // ['bus', 'car', 'train'] - multiple types can be affected
}

export interface IRoadIncident extends Document {
  reporter_id: mongoose.Types.ObjectId; // User who reported
  incident_type:
    | 'accident'
    | 'road_block'
    | 'traffic_jam'
    | 'pothole'
    | 'flooding'
    | 'landslide'
    | 'construction'
    | 'other';
  title: string;
  description: string;
  location: ILocation;
  severity: 'low' | 'medium' | 'high' | 'critical'; // Impact on travel
  status: 'active' | 'resolved' | 'archived';
  affected_routes?: IAffectedRoute[];
  verification: IIncidentVerification;
  impact_estimate?: {
    affected_users_count?: number;
    estimated_delay_minutes?: number;
    affected_transport_types?: string[];
  };
  attachments?: {
    image_urls?: string[];
    video_urls?: string[];
  };
  is_resolved: boolean;
  resolved_by?: mongoose.Types.ObjectId;
  resolved_at?: Date;
  resolution_notes?: string;
  expires_at?: Date; // Auto-archive after certain time
  createdAt: Date;
  updatedAt: Date;
}

const RoadIncidentSchema = new Schema<IRoadIncident>(
  {
    reporter_id: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    incident_type: {
      type: String,
      enum: [
        'accident',
        'road_block',
        'traffic_jam',
        'pothole',
        'flooding',
        'landslide',
        'construction',
        'other',
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    location: {
      latitude: {
        type: Number,
        required: true,
      },
      longitude: {
        type: Number,
        required: true,
      },
      address: {
        type: String,
        required: false,
      },
      city: {
        type: String,
        required: false,
      },
      district: {
        type: String,
        required: false,
      },
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['active', 'resolved', 'archived'],
      default: 'active',
    },
    affected_routes: [
      {
        route_name: {
          type: String,
          required: true,
        },
        polyline: {
          type: String,
          required: false,
        },
        coordinates: {
          start: {
            latitude: { type: Number, required: true },
            longitude: { type: Number, required: true },
            address: { type: String, required: false },
          },
          end: {
            latitude: { type: Number, required: true },
            longitude: { type: Number, required: true },
            address: { type: String, required: false },
          },
        },
        bounds: {
          northeast: {
            latitude: { type: Number, required: false },
            longitude: { type: Number, required: false },
          },
          southwest: {
            latitude: { type: Number, required: false },
            longitude: { type: Number, required: false },
          },
        },
        distance_km: {
          type: Number,
          required: false,
        },
        estimated_delay_min: {
          type: Number,
          required: false,
        },
        transport_types: {
          type: [String],
          required: false,
        },
      },
    ],
    verification: {
      confirmed_by_users: {
        type: [Schema.Types.ObjectId],
        default: [],
        ref: 'User',
      },
      count: {
        type: Number,
        default: 0,
      },
      last_confirmed_at: {
        type: Date,
        required: false,
      },
    },
    impact_estimate: {
      affected_users_count: {
        type: Number,
        required: false,
      },
      estimated_delay_minutes: {
        type: Number,
        required: false,
      },
      affected_transport_types: {
        type: [String],
        required: false,
      },
    },
    attachments: {
      image_urls: {
        type: [String],
        required: false,
      },
      video_urls: {
        type: [String],
        required: false,
      },
    },
    is_resolved: {
      type: Boolean,
      default: false,
    },
    resolved_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    resolved_at: {
      type: Date,
      required: false,
    },
    resolution_notes: {
      type: String,
      required: false,
    },
    expires_at: {
      type: Date,
      required: false,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days default
    },
  },
  {
    timestamps: true,
  }
);

// Index for geospatial queries
RoadIncidentSchema.index({ 'location.latitude': 1, 'location.longitude': 1 });
RoadIncidentSchema.index({ status: 1, is_resolved: 1 });
RoadIncidentSchema.index({ reporter_id: 1, createdAt: -1 });
RoadIncidentSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 }); // TTL index

export const RoadIncident = mongoose.model<IRoadIncident>('RoadIncident', RoadIncidentSchema);
