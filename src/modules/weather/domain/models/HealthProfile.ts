import mongoose from 'mongoose';

const HealthProfileHistorySchema = new mongoose.Schema(
  {
    skinType: {
      type: Number,
      required: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    timeStamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const UserHealthProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    age: {
      type: Number,
      required: true,
    },
    skinType: {
      type: Number,
      required: true,
    },
    historicalSunburnTimes: {
      type: Number,
      default: 0,
    },

    historicalTanningTimes: {
      type: Number,
      default: 0,
    },
    skinProductInteraction: {
      type: String,
      required: true,
    },

    useOfSunglasses: {
      type: String,
      required: true,
    },

    imageUrl: {
      type: String,
      required: true,
    },
    history: {
      type: [HealthProfileHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('UserHealthProfile', UserHealthProfileSchema);
