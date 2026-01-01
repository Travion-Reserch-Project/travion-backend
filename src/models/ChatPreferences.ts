import mongoose, { Document, Schema } from 'mongoose';

export interface IChatPreferences extends Document {
  userId: mongoose.Types.ObjectId;
  language: string;
  enableNotifications: boolean;
  responseFormat?: 'text' | 'detailed' | 'brief';
  createdAt: Date;
  updatedAt: Date;
}

const chatPreferencesSchema = new Schema<IChatPreferences>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },

    language: {
      type: String,
      default: 'en',
      enum: ['en', 'es', 'fr', 'de', 'pt', 'ja', 'zh'],
    },
    enableNotifications: {
      type: Boolean,
      default: true,
    },
    responseFormat: {
      type: String,
      enum: ['text', 'detailed', 'brief'],
      default: 'text',
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

// Pre-save middleware for referential integrity
chatPreferencesSchema.pre('save', async function (next) {
  if (this.isNew || this.isModified('userId')) {
    const User = mongoose.model('User');
    const userExists = await User.findById(this.userId);
    if (!userExists) {
      throw new Error('Invalid userId: Referenced user does not exist');
    }
  }
  next();
});

export const ChatPreferences = mongoose.model<IChatPreferences>(
  'ChatPreferences',
  chatPreferencesSchema
);
