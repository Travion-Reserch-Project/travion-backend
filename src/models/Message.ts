import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage extends Document {
  conversation_id: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId;
  role: 'user' | 'assistant' | 'system';
  content: string;
  message_type: 'text' | 'route_suggestion' | 'weather_info' | 'location_info' | 'error';
  metadata?: {
    intent?: string;
    entities?: {
      origin?: string;
      destination?: string;
      date?: string;
      time?: string;
      transport_type?: string;
    };
    locations_identified?: Array<{
      name: string;
      city_id?: number;
      confidence: number;
    }>;
    api_calls?: {
      google_maps?: boolean;
      weather?: boolean;
      ml_service?: boolean;
    };
    response_data?: {
      routes?: unknown[];
      weather?: unknown;
      stations?: unknown[];
    };
    processing_time_ms?: number;
    tokens_used?: number;
  };
  is_error: boolean;
  error_details?: {
    code: string;
    message: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    conversation_id: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Conversation',
    },
    user_id: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    role: {
      type: String,
      enum: ['user', 'assistant', 'system'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    message_type: {
      type: String,
      enum: ['text', 'route_suggestion', 'weather_info', 'location_info', 'error'],
      default: 'text',
    },
    metadata: {
      intent: String,
      entities: {
        origin: String,
        destination: String,
        date: String,
        time: String,
        transport_type: String,
      },
      locations_identified: [
        {
          name: String,
          city_id: Number,
          confidence: Number,
        },
      ],
      api_calls: {
        google_maps: Boolean,
        weather: Boolean,
        ml_service: Boolean,
      },
      response_data: {
        routes: Schema.Types.Mixed,
        weather: Schema.Types.Mixed,
        stations: Schema.Types.Mixed,
      },
      processing_time_ms: Number,
      tokens_used: Number,
    },
    is_error: {
      type: Boolean,
      default: false,
    },
    error_details: {
      code: String,
      message: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
MessageSchema.index({ conversation_id: 1, createdAt: 1 });
MessageSchema.index({ user_id: 1 });
MessageSchema.index({ message_type: 1 });

export const Message = mongoose.model<IMessage>('Message', MessageSchema);
