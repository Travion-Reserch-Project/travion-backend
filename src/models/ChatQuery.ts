import mongoose, { Document, Schema } from 'mongoose';

export interface IChatQuery extends Document {
  queryId: string;
  sessionId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  queryText: string;
  queryType: 'transport' | 'general' | 'location' | 'recommendation' | 'other';
  userLocation?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  mlServiceRequest?: {
    endpoint: string;
    payload: any;
    timestamp: Date;
  };
  mlServiceResponse?: {
    data: any;
    statusCode: number;
    timestamp: Date;
  };
  mlServiceLatency: number; // in milliseconds
  mlServiceStatus: 'success' | 'error' | 'timeout' | 'unavailable';
  formattedResponse: string;
  userRating?: number; // 1-5 rating for this specific response
  userFeedback?: string;
  wasHelpful?: boolean;
  responseTime: number; // total response time in milliseconds
  errorDetails?: {
    message: string;
    code?: string;
    stack?: string;
  };
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const chatQuerySchema = new Schema<IChatQuery>(
  {
    queryId: {
      type: String,
      required: true,
      unique: true,
    },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'ChatSession',
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    queryText: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    queryType: {
      type: String,
      enum: ['transport', 'general', 'location', 'recommendation', 'other'],
      required: true,
    },
    userLocation: {
      latitude: {
        type: Number,
      },
      longitude: {
        type: Number,
      },
      address: {
        type: String,
        trim: true,
      },
    },
    mlServiceRequest: {
      endpoint: {
        type: String,
      },
      payload: {
        type: mongoose.Schema.Types.Mixed,
      },
      timestamp: {
        type: Date,
      },
    },
    mlServiceResponse: {
      data: {
        type: mongoose.Schema.Types.Mixed,
      },
      statusCode: {
        type: Number,
      },
      timestamp: {
        type: Date,
      },
    },
    mlServiceLatency: {
      type: Number,
      required: true,
      min: 0,
    },
    mlServiceStatus: {
      type: String,
      enum: ['success', 'error', 'timeout', 'unavailable'],
      required: true,
    },
    formattedResponse: {
      type: String,
      required: true,
      trim: true,
    },
    userRating: {
      type: Number,
      min: 1,
      max: 5,
    },
    userFeedback: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    wasHelpful: {
      type: Boolean,
    },
    responseTime: {
      type: Number,
      required: true,
      min: 0,
    },
    errorDetails: {
      message: {
        type: String,
      },
      code: {
        type: String,
      },
      stack: {
        type: String,
      },
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (_doc, ret: Record<string, unknown>) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

chatQuerySchema.index({ userId: 1 });
chatQuerySchema.index({ sessionId: 1 });

// Compound indexes for efficient querying
chatQuerySchema.index({ sessionId: 1, timestamp: -1 });
chatQuerySchema.index({ userId: 1, timestamp: -1 });
chatQuerySchema.index({ userId: 1, queryType: 1 });
chatQuerySchema.index({ queryType: 1, timestamp: -1 });
chatQuerySchema.index({ mlServiceStatus: 1, timestamp: -1 });
chatQuerySchema.index({ mlServiceStatus: 1, queryType: 1 });
chatQuerySchema.index({ userRating: 1 }, { sparse: true });
chatQuerySchema.index({ timestamp: -1 });
chatQuerySchema.index({ wasHelpful: 1 }, { sparse: true });

// Virtual relationships for referential integrity
chatQuerySchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
});

chatQuerySchema.virtual('session', {
  ref: 'ChatSession',
  localField: 'sessionId',
  foreignField: 'sessionId',
  justOne: true,
});

// Pre-save middleware for referential integrity validation
chatQuerySchema.pre('save', async function (next) {
  if (this.isNew || this.isModified('userId') || this.isModified('sessionId')) {
    // Validate User reference
    const User = mongoose.model('User');
    const userExists = await User.findById(this.userId);
    if (!userExists) {
      throw new Error('Invalid userId: Referenced user does not exist');
    }

    // Validate Session reference
    const ChatSession = mongoose.model('ChatSession');
    const sessionExists = await ChatSession.findOne({ sessionId: this.sessionId });
    if (!sessionExists) {
      throw new Error('Invalid sessionId: Referenced session does not exist');
    }

    // Validate that session belongs to the same user
    if (sessionExists.userId.toString() !== this.userId.toString()) {
      throw new Error('Session does not belong to the specified user');
    }
  }
  next();
});

export const ChatQuery = mongoose.model<IChatQuery>('ChatQuery', chatQuerySchema);
