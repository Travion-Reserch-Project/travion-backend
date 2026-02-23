import mongoose, { Schema, Document } from 'mongoose';

export interface IConversation extends Document {
  user_id: mongoose.Types.ObjectId;
  title?: string;
  status: 'active' | 'ended' | 'archived';
  context?: {
    current_location?: {
      city_id?: number;
      city_name?: string;
      coordinates?: [number, number];
    };
    destination?: {
      city_id?: number;
      city_name?: string;
      coordinates?: [number, number];
    };
    preferences?: {
      transport_type?: 'bus' | 'train' | 'any';
      budget?: 'low' | 'medium' | 'high';
      language?: 'en' | 'si' | 'ta';
    };
  };
  metadata?: {
    message_count: number;
    last_message_at?: Date;
    total_queries: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    title: {
      type: String,
      required: false,
    },
    status: {
      type: String,
      enum: ['active', 'ended', 'archived'],
      default: 'active',
    },
    context: {
      current_location: {
        city_id: Number,
        city_name: String,
        coordinates: [Number],
      },
      destination: {
        city_id: Number,
        city_name: String,
        coordinates: [Number],
      },
      preferences: {
        transport_type: {
          type: String,
          enum: ['bus', 'train', 'any'],
        },
        budget: {
          type: String,
          enum: ['low', 'medium', 'high'],
        },
        language: {
          type: String,
          enum: ['en', 'si', 'ta'],
          default: 'en',
        },
      },
    },
    metadata: {
      message_count: {
        type: Number,
        default: 0,
      },
      last_message_at: {
        type: Date,
      },
      total_queries: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
ConversationSchema.index({ user_id: 1, status: 1 });
ConversationSchema.index({ createdAt: -1 });

export const Conversation = mongoose.model<IConversation>('Conversation', ConversationSchema);
