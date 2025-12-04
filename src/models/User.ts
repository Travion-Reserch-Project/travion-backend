import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  userName: string;
  gender: 'Male' | 'Female' | 'Other';
  dob: Date;
  isActive: boolean;
  profileStatus: 'Incomplete' | 'Complete';
  country?: string;
  preferredLanguage?: string;
  googleId?: string;
  profilePicture?: string;
  provider: 'local' | 'google';
  lastLogin?: Date;
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
        return this.provider === 'local';
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
    userName: {
      type: String,
      unique: true,
      trim: true,
      sparse: true, // Allow null values for unique index
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
    profileStatus: {
      type: String,
      enum: ['Incomplete', 'Complete'],
      default: 'Incomplete',
    },
    country: {
      type: String,
      trim: true,
    },
    preferredLanguage: {
      type: String,
      trim: true,
    },
    googleId: {
      type: String,
      sparse: true,
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
    lastLogin: {
      type: Date,
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

// Generate unique username if not provided
userSchema.pre('save', async function (next) {
  if (!this.userName) {
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      // Generate username: first name + random 4-digit number
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const baseUsername = this.firstName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const generatedUsername = `${baseUsername}${randomNum}`;

      // Check if username already exists
      const existingUser = await (this.constructor as any).findOne({ userName: generatedUsername });

      if (!existingUser) {
        this.userName = generatedUsername;
        isUnique = true;
      }

      attempts++;
    }

    // If we couldn't generate a unique username after max attempts, use timestamp
    if (!isUnique) {
      const timestamp = Date.now();
      const baseUsername = this.firstName.toLowerCase().replace(/[^a-z0-9]/g, '');
      this.userName = `${baseUsername}${timestamp}`;
    }
  }
  next();
});

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
