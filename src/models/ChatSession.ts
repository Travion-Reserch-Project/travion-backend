/**
 * ChatSession Model
 * Stores conversation history with AI Engine
 * Supports thread-based conversations for context persistence
 */

import mongoose, { Document, Schema } from 'mongoose';

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Message metadata from AI Engine response
 */
export interface IMessageMetadata {
  intent?: string;
  reasoningLoops?: number;
  documentsRetrieved?: number;
  webSearchUsed?: boolean;
  processingTimeMs?: number;
  constraints?: Array<{
    constraintType: string;
    description: string;
    severity: string;
  }>;
}

/**
 * Individual chat message
 */
export interface IChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: IMessageMetadata;
}

/**
 * Session context for personalization
 */
export interface ISessionContext {
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
  targetDate?: Date;
  preferences?: {
    history: number;
    adventure: number;
    nature: number;
    relaxation: number;
  };
  lastRecommendations?: string[];
}

/**
 * Main ChatSession document interface
 */
export interface IChatSession extends Document {
  userId: mongoose.Types.ObjectId;
  sessionId: string;
  title?: string;
  messages: IChatMessage[];
  context: ISessionContext;
  status: 'active' | 'closed' | 'archived';
  messageCount: number;
  lastActivity: Date;
  linkedTripId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// SUB-SCHEMAS
// ============================================================================

const messageMetadataSchema = new Schema<IMessageMetadata>(
  {
    intent: {
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
    },
    processingTimeMs: {
      type: Number,
      min: 0,
    },
    constraints: [{
      constraintType: String,
      description: String,
      severity: String,
    }],
  },
  { _id: false }
);

const chatMessageSchema = new Schema<IChatMessage>(
  {
    role: {
      type: String,
      enum: ['user', 'assistant', 'system'],
      required: [true, 'Message role is required'],
    },
    content: {
      type: String,
      required: [true, 'Message content is required'],
      maxlength: 10000, // 10K char limit per message
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      type: messageMetadataSchema,
    },
  },
  { _id: false }
);

const sessionContextSchema = new Schema<ISessionContext>(
  {
    currentLocation: {
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
    },
    targetDate: {
      type: Date,
    },
    preferences: {
      history: { type: Number, min: 0, max: 1 },
      adventure: { type: Number, min: 0, max: 1 },
      nature: { type: Number, min: 0, max: 1 },
      relaxation: { type: Number, min: 0, max: 1 },
    },
    lastRecommendations: [{
      type: String,
    }],
  },
  { _id: false }
);

// ============================================================================
// MAIN SCHEMA
// ============================================================================

const chatSessionSchema = new Schema<IChatSession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    sessionId: {
      type: String,
      required: [true, 'Session ID is required'],
      unique: true,
      index: true,
    },
    title: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    messages: {
      type: [chatMessageSchema],
      default: [],
      validate: {
        validator: function(v: IChatMessage[]) {
          return v.length <= 500; // Max 500 messages per session
        },
        message: 'Session cannot have more than 500 messages',
      },
    },
    context: {
      type: sessionContextSchema,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: ['active', 'closed', 'archived'],
      default: 'active',
    },
    messageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastActivity: {
      type: Date,
      default: Date.now,
    },
    linkedTripId: {
      type: Schema.Types.ObjectId,
      ref: 'SavedTrip',
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

chatSessionSchema.index({ userId: 1, lastActivity: -1 });
chatSessionSchema.index({ userId: 1, status: 1 });
chatSessionSchema.index({ sessionId: 1 });
chatSessionSchema.index({ userId: 1, createdAt: -1 });

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Update messageCount and lastActivity on save
chatSessionSchema.pre('save', function(next) {
  this.messageCount = this.messages.length;
  this.lastActivity = new Date();
  next();
});

// Auto-generate title from first user message if not provided
chatSessionSchema.pre('save', function(next) {
  if (!this.title && this.messages.length > 0) {
    const firstUserMessage = this.messages.find(m => m.role === 'user');
    if (firstUserMessage) {
      // Take first 50 chars of first user message as title
      this.title = firstUserMessage.content.substring(0, 50);
      if (firstUserMessage.content.length > 50) {
        this.title += '...';
      }
    }
  }
  next();
});

// ============================================================================
// METHODS
// ============================================================================

// Static method to generate unique session ID
chatSessionSchema.statics.generateSessionId = function(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `chat_${timestamp}_${randomPart}`;
};

// ============================================================================
// EXPORT
// ============================================================================

export const ChatSession = mongoose.model<IChatSession>('ChatSession', chatSessionSchema);
