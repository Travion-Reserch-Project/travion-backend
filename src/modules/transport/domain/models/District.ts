import mongoose, { Schema, Document } from 'mongoose';

export interface IDistrict extends Document {
  district_id: number;
  province_id: number;
  name: {
    en: string;
    si: string;
    ta: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const DistrictSchema = new Schema<IDistrict>(
  {
    district_id: {
      type: Number,
      required: true,
      unique: true,
    },
    province_id: {
      type: Number,
      required: true,
      ref: 'Province',
    },
    name: {
      en: {
        type: String,
        required: true,
      },
      si: {
        type: String,
        required: true,
      },
      ta: {
        type: String,
        required: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
DistrictSchema.index({ district_id: 1 });
DistrictSchema.index({ province_id: 1 });
DistrictSchema.index({ 'name.en': 'text', 'name.si': 'text', 'name.ta': 'text' });

export const District = mongoose.model<IDistrict>('District', DistrictSchema);
