import mongoose, { Document, Schema } from 'mongoose';

export interface IIncidentReport extends Document {
  userId?: mongoose.Types.ObjectId; // Optional - reports can be anonymous
  incidentType:
    | 'Pickpocketing'
    | 'Bag Snatching'
    | 'Scam'
    | 'Money Theft'
    | 'Harassment'
    | 'Extortion'
    | 'Theft'
    | 'Other';
  location: {
    latitude?: number;
    longitude?: number;
    address: string;
  };
  incidentTime: Date;
  description: string;
  photoUrl?: string; // URL to uploaded photo (if any)
  status: 'pending' | 'verified' | 'rejected';
  isAnonymous: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const incidentReportSchema = new Schema<IIncidentReport>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false, // Optional for anonymous reports
      index: true,
    },
    incidentType: {
      type: String,
      required: true,
      enum: [
        'Pickpocketing',
        'Bag Snatching',
        'Scam',
        'Money Theft',
        'Harassment',
        'Extortion',
        'Theft',
        'Other',
      ],
      index: true,
    },
    location: {
      latitude: {
        type: Number,
        required: false,
        min: -90,
        max: 90,
      },
      longitude: {
        type: Number,
        required: false,
        min: -180,
        max: 180,
      },
      address: {
        type: String,
        required: true,
      },
    },
    incidentTime: {
      type: Date,
      required: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
      minlength: 10,
      maxlength: 2000,
    },
    photoUrl: {
      type: String,
      required: false,
    },
    status: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
      index: true,
    },
    isAnonymous: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
incidentReportSchema.index({ 'location.latitude': 1, 'location.longitude': 1 });
incidentReportSchema.index({ incidentTime: -1 });
incidentReportSchema.index({ createdAt: -1 });
incidentReportSchema.index({ status: 1, incidentTime: -1 });

const IncidentReport = mongoose.model<IIncidentReport>('IncidentReport', incidentReportSchema);

export default IncidentReport;
