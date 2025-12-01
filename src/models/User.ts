import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  email: string;
  password?: string; // Made optional for OAuth users
  firstName: string;
  lastName: string;
  gender: 'Male' | 'Female' | 'Other';
  dob: Date;
  isActive: boolean;
  googleId?: string;
  profilePicture?: string;
  provider: 'local' | 'google';
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: function (this: IUser) {
        return this.provider === 'local'; // Only required for local auth
      },
      minlength: [6, 'Password must be at least 6 characters long'],
      select: false,
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other'],
      required: [false, 'Gender is not required'],
    },
    dob: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Google OAuth fields
    googleId: {
      type: String,
      sparse: true, // Allows multiple null values but unique non-null values
    },
    profilePicture: {
      type: String,
    },
    provider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (_doc, ret: Record<string, unknown>) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Hash password before saving (only for local auth)
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || this.provider !== 'local' || !this.password) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Method to compare passwords (only for local auth)
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  if (this.provider !== 'local' || !this.password) {
    return false;
  }
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model<IUser>('User', userSchema);
