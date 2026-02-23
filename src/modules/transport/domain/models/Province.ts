import mongoose, { Schema, Document } from 'mongoose';

export interface IProvince extends Document {
  province_id: number;
  name: {
    en: string;
    si: string;
    ta: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ProvinceSchema = new Schema<IProvince>(
  {
    province_id: {
      type: Number,
      required: true,
      unique: true,
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

// Index for faster queries
ProvinceSchema.index({ province_id: 1 });
ProvinceSchema.index({ 'name.en': 'text', 'name.si': 'text', 'name.ta': 'text' });

export const Province = mongoose.model<IProvince>('Province', ProvinceSchema);
