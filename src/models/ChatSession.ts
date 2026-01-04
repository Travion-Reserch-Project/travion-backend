import mongoose, { Document, Schema } from 'mongoose';

export interface IChatSession extends Document {
  sessionId: string;
  userId: mongoose.Types.ObjectId;
  startTime: Date;
  endTime?: Date;
  totalQueries: number;
  avgResponseTime: number;
  userSatisfactionScore?: number; // 1-5 rating for overall session
  sessionStatus: 'active' | 'ended' | 'abandoned';
  deviceInfo?: {
    platform: string;
    version?: string;
  };
  travelState?: {
    origin?: string;
    destination?: string;
    departureDate?: string;
    departureTime?: string;
    pendingFields?: string[];
    lastAskedField?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const chatSessionSchema = new Schema<IChatSession>(
  {
    sessionId: {
      type: String,
      unique: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endTime: {
      type: Date,
    },
    totalQueries: {
      type: Number,
      default: 0,
      min: 0,
    },
    avgResponseTime: {
      type: Number,
      default: 0,
      min: 0,
    },
    userSatisfactionScore: {
      type: Number,
      min: 1,
      max: 5,
    },
    sessionStatus: {
      type: String,
      enum: ['active', 'ended', 'abandoned'],
      default: 'active',
    },
    deviceInfo: {
      platform: {
        type: String,
        trim: true,
      },
      version: {
        type: String,
        trim: true,
      },
    },
    travelState: {
      origin: { type: String, trim: true },
      destination: { type: String, trim: true },
      departureDate: { type: String, trim: true },
      departureTime: { type: String, trim: true },
      pendingFields: [{ type: String, trim: true }],
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

// Foreign Key index
chatSessionSchema.index({ userId: 1 });

// Compound indexes
chatSessionSchema.index({ userId: 1, startTime: -1 });
chatSessionSchema.index({ userId: 1, sessionStatus: 1 });
chatSessionSchema.index({ sessionStatus: 1, startTime: -1 });
chatSessionSchema.index({ startTime: -1 });
chatSessionSchema.index({ userSatisfactionScore: 1 }, { sparse: true });

// Virtual for referential integrity validation
chatSessionSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
});

// Pre-save middleware for referential integrity
chatSessionSchema.pre('save', async function (next) {
  if (this.isNew || this.isModified('userId')) {
    const User = mongoose.model('User');
    const userExists = await User.findById(this.userId);
    if (!userExists) {
      throw new Error('Invalid userId: Referenced user does not exist');
    }
  }

  const doc = this as unknown as { _id: mongoose.Types.ObjectId; sessionId?: string };
  if (!doc.sessionId) {
    doc.sessionId = doc._id.toString();
  }
  next();
});

export const ChatSession = mongoose.model<IChatSession>('ChatSession', chatSessionSchema);
