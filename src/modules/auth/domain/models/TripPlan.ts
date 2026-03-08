/**
 * TripPlan Model
 * Extends SavedTrip with Active Guardian monitoring capabilities
 * Implements Phase 2: Post-Acceptance Active Watcher
 *
 * Features:
 * - Monitoring states for trip lifecycle
 * - Weather and alert tracking history
 * - Delta plans for trip modifications
 * - Background monitoring integration
 */

import mongoose, { Document, Schema } from 'mongoose';
import { IItineraryItem, ITripConstraint, IAIMetadata } from './SavedTrip';

// ============================================================================
// MONITORING ENUMS AND INTERFACES
// ============================================================================

/**
 * Trip monitoring status
 */
export enum MonitoringStatus {
  NOT_MONITORING = 'NOT_MONITORING',      // Trip not yet accepted for monitoring
  ACTIVE_MONITORING = 'ACTIVE_MONITORING', // Trip is being actively monitored
  ALERT_DETECTED = 'ALERT_DETECTED',       // Issues detected, awaiting user response
  DELTA_PLAN_GENERATED = 'DELTA_PLAN_GENERATED', // Alternative plan generated
  PAUSED = 'PAUSED',                       // Monitoring temporarily paused
  COMPLETED = 'COMPLETED',                 // Trip completed, monitoring ended
  CANCELLED = 'CANCELLED',                 // Trip cancelled
}

/**
 * Alert severity levels
 */
export enum AlertSeverity {
  INFO = 'info',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Alert categories for monitoring
 */
export enum AlertCategory {
  WEATHER = 'weather',
  PROTEST = 'protest',
  STRIKE = 'strike',
  NATURAL_DISASTER = 'natural_disaster',
  LANDSLIDE = 'landslide',
  FLOOD = 'flood',
  ROAD_CLOSURE = 'road_closure',
  TRANSPORT_DISRUPTION = 'transport_disruption',
  SECURITY_INCIDENT = 'security_incident',
  HEALTH_EMERGENCY = 'health_emergency',
  WILDLIFE_DANGER = 'wildlife_danger',
  GENERAL = 'general',
}

/**
 * Monitoring check record
 */
export interface IMonitoringCheck {
  checkId: string;
  timestamp: Date;
  checkType: 'weather' | 'alerts' | 'full';
  status: 'passed' | 'warning' | 'failed';
  weatherScore?: number;        // 0-100 suitability score
  alertsFound?: number;
  details: string;
  rawResponse?: Record<string, unknown>;
}

/**
 * Active alert affecting the trip
 */
export interface IActiveAlert {
  alertId: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  description: string;
  affectedLocation: string;
  affectedDate?: Date;
  sourceUrl?: string;
  detectedAt: Date;
  expiresAt?: Date;
  isAcknowledged: boolean;
  acknowledgedAt?: Date;
  userResponse?: 'accept_risk' | 'modify_plan' | 'cancel';
  travelImpact: string;
  recommendedAction: string;
}

/**
 * Weather forecast for trip dates
 */
export interface IWeatherForecast {
  locationName: string;
  date: Date;
  condition: string;
  temperatureMin: number;
  temperatureMax: number;
  rainProbability: number;
  windSpeed: number;
  suitabilityScore: number;  // 0-100
  alerts: string[];
  lastUpdated: Date;
}

/**
 * Delta plan - alternative itinerary suggestions
 */
export interface IDeltaPlan {
  deltaId: string;
  generatedAt: Date;
  reason: string;            // Why this delta was generated
  triggeringAlertId?: string;
  originalItems: IItineraryItem[];
  suggestedItems: IItineraryItem[];
  affectedDates: Date[];
  impactSummary: string;
  userAccepted?: boolean;
  acceptedAt?: Date;
  aiExplanation?: string;
}

/**
 * User notification record
 */
export interface INotificationRecord {
  notificationId: string;
  type: 'alert' | 'delta_plan' | 'reminder' | 'status_change';
  title: string;
  message: string;
  sentAt: Date;
  sentVia: ('push' | 'email' | 'sms')[];
  readAt?: Date;
  relatedAlertId?: string;
  relatedDeltaId?: string;
}

/**
 * Shadow Monitor validation result
 */
export interface IValidationResult {
  validationId: string;
  timestamp: Date;
  status: 'APPROVED' | 'APPROVED_WITH_WARNINGS' | 'NEEDS_ADJUSTMENT' | 'REJECTED';
  overallScore: number;
  weatherValidation?: Record<string, unknown>;
  alertValidation?: Record<string, unknown>;
  eventValidation?: Record<string, unknown>;
  recommendations: string[];
  correctionHints?: string[];
}

/**
 * Main TripPlan document interface
 */
export interface ITripPlan extends Document {
  // Core trip information (from SavedTrip)
  userId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  destinations: string[];
  itinerary: IItineraryItem[];
  totalDays: number;
  isPublic: boolean;
  status: 'draft' | 'planned' | 'ongoing' | 'completed' | 'cancelled';
  coverImage?: string;
  tags: string[];
  estimatedBudget?: {
    currency: string;
    amount: number;
  };
  travelersCount: number;
  generatedBy: 'user' | 'ai';
  aiMetadata?: IAIMetadata;
  constraints?: ITripConstraint[];

  // Active Guardian Monitoring Fields
  monitoringStatus: MonitoringStatus;
  monitoringStartedAt?: Date;
  monitoringEndedAt?: Date;
  lastMonitoringCheck?: Date;
  nextScheduledCheck?: Date;
  monitoringInterval: number;      // In milliseconds, default 4 hours

  // Validation and Checks
  initialValidation?: IValidationResult;
  monitoringHistory: IMonitoringCheck[];

  // Active Alerts
  activeAlerts: IActiveAlert[];
  alertHistory: IActiveAlert[];

  // Weather Forecasts
  weatherForecasts: IWeatherForecast[];
  lastWeatherUpdate?: Date;

  // Delta Plans
  deltaPlans: IDeltaPlan[];
  currentDeltaPlanId?: string;

  // Notifications
  notifications: INotificationRecord[];
  notificationPreferences: {
    enablePush: boolean;
    enableEmail: boolean;
    enableSms: boolean;
    alertThreshold: AlertSeverity;
  };

  // Statistics
  totalAlertsDetected: number;
  totalDeltaPlansGenerated: number;
  monitoringChecksCount: number;

  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// SUB-SCHEMAS
// ============================================================================

const monitoringCheckSchema = new Schema<IMonitoringCheck>(
  {
    checkId: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
    checkType: {
      type: String,
      enum: ['weather', 'alerts', 'full'],
      required: true,
    },
    status: {
      type: String,
      enum: ['passed', 'warning', 'failed'],
      required: true,
    },
    weatherScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    alertsFound: {
      type: Number,
      min: 0,
    },
    details: {
      type: String,
      required: true,
    },
    rawResponse: {
      type: Schema.Types.Mixed,
    },
  },
  { _id: false }
);

const activeAlertSchema = new Schema<IActiveAlert>(
  {
    alertId: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: Object.values(AlertCategory),
      required: true,
    },
    severity: {
      type: String,
      enum: Object.values(AlertSeverity),
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    affectedLocation: {
      type: String,
      required: true,
      trim: true,
    },
    affectedDate: {
      type: Date,
    },
    sourceUrl: {
      type: String,
      trim: true,
    },
    detectedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
    },
    isAcknowledged: {
      type: Boolean,
      default: false,
    },
    acknowledgedAt: {
      type: Date,
    },
    userResponse: {
      type: String,
      enum: ['accept_risk', 'modify_plan', 'cancel'],
    },
    travelImpact: {
      type: String,
      required: true,
      trim: true,
    },
    recommendedAction: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const weatherForecastSchema = new Schema<IWeatherForecast>(
  {
    locationName: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: Date,
      required: true,
    },
    condition: {
      type: String,
      required: true,
    },
    temperatureMin: {
      type: Number,
      required: true,
    },
    temperatureMax: {
      type: Number,
      required: true,
    },
    rainProbability: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
    },
    windSpeed: {
      type: Number,
      min: 0,
      required: true,
    },
    suitabilityScore: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
    },
    alerts: [{
      type: String,
      trim: true,
    }],
    lastUpdated: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { _id: false }
);

const deltaPlanSchema = new Schema<IDeltaPlan>(
  {
    deltaId: {
      type: String,
      required: true,
    },
    generatedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    triggeringAlertId: {
      type: String,
    },
    originalItems: {
      type: [Schema.Types.Mixed],
      default: [],
    },
    suggestedItems: {
      type: [Schema.Types.Mixed],
      default: [],
    },
    affectedDates: [{
      type: Date,
    }],
    impactSummary: {
      type: String,
      required: true,
      trim: true,
    },
    userAccepted: {
      type: Boolean,
    },
    acceptedAt: {
      type: Date,
    },
    aiExplanation: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const notificationRecordSchema = new Schema<INotificationRecord>(
  {
    notificationId: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['alert', 'delta_plan', 'reminder', 'status_change'],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    sentAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    sentVia: [{
      type: String,
      enum: ['push', 'email', 'sms'],
    }],
    readAt: {
      type: Date,
    },
    relatedAlertId: {
      type: String,
    },
    relatedDeltaId: {
      type: String,
    },
  },
  { _id: false }
);

const validationResultSchema = new Schema<IValidationResult>(
  {
    validationId: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['APPROVED', 'APPROVED_WITH_WARNINGS', 'NEEDS_ADJUSTMENT', 'REJECTED'],
      required: true,
    },
    overallScore: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
    },
    weatherValidation: {
      type: Schema.Types.Mixed,
    },
    alertValidation: {
      type: Schema.Types.Mixed,
    },
    eventValidation: {
      type: Schema.Types.Mixed,
    },
    recommendations: [{
      type: String,
      trim: true,
    }],
    correctionHints: [{
      type: String,
      trim: true,
    }],
  },
  { _id: false }
);

const itineraryItemSchema = new Schema<IItineraryItem>(
  {
    order: {
      type: Number,
      required: [true, 'Order is required'],
      min: 0,
    },
    time: {
      type: String,
      required: [true, 'Time is required'],
      match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'],
    },
    locationName: {
      type: String,
      required: [true, 'Location name is required'],
      trim: true,
      maxlength: 200,
    },
    locationId: String,
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 },
    activity: {
      type: String,
      required: [true, 'Activity is required'],
      trim: true,
      maxlength: 500,
    },
    durationMinutes: {
      type: Number,
      required: [true, 'Duration is required'],
      min: 1,
      max: 1440,
    },
    notes: { type: String, trim: true, maxlength: 1000 },
    crowdPrediction: { type: Number, min: 0, max: 100 },
    lightingQuality: {
      type: String,
      enum: ['golden', 'blue', 'good', 'harsh', 'dark'],
    },
    constraints: [{ type: String, trim: true }],
  },
  { _id: false }
);

const tripConstraintSchema = new Schema<ITripConstraint>(
  {
    constraintType: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      required: true,
    },
    suggestion: { type: String, trim: true },
  },
  { _id: false }
);

const aiMetadataSchema = new Schema<IAIMetadata>(
  {
    sessionId: { type: String, trim: true },
    model: { type: String, trim: true },
    reasoningLoops: { type: Number, min: 0 },
    documentsRetrieved: { type: Number, min: 0 },
    webSearchUsed: { type: Boolean, default: false },
    generatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// ============================================================================
// MAIN SCHEMA
// ============================================================================

const tripPlanSchema = new Schema<ITripPlan>(
  {
    // Core Trip Information
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Trip title is required'],
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    destinations: [{
      type: String,
      trim: true,
    }],
    itinerary: {
      type: [itineraryItemSchema],
      default: [],
    },
    totalDays: {
      type: Number,
      required: [true, 'Total days is required'],
      min: 1,
      max: 365,
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['draft', 'planned', 'ongoing', 'completed', 'cancelled'],
      default: 'draft',
    },
    coverImage: {
      type: String,
      trim: true,
    },
    tags: [{
      type: String,
      trim: true,
      maxlength: 50,
    }],
    estimatedBudget: {
      currency: { type: String, default: 'USD', maxlength: 3 },
      amount: { type: Number, min: 0 },
    },
    travelersCount: {
      type: Number,
      default: 1,
      min: 1,
      max: 100,
    },
    generatedBy: {
      type: String,
      enum: ['user', 'ai'],
      default: 'ai',
    },
    aiMetadata: {
      type: aiMetadataSchema,
    },
    constraints: {
      type: [tripConstraintSchema],
      default: [],
    },

    // Active Guardian Monitoring Fields
    monitoringStatus: {
      type: String,
      enum: Object.values(MonitoringStatus),
      default: MonitoringStatus.NOT_MONITORING,
      index: true,
    },
    monitoringStartedAt: Date,
    monitoringEndedAt: Date,
    lastMonitoringCheck: Date,
    nextScheduledCheck: {
      type: Date,
      index: true,
    },
    monitoringInterval: {
      type: Number,
      default: 4 * 60 * 60 * 1000, // 4 hours in milliseconds
      min: 15 * 60 * 1000,         // Minimum 15 minutes
      max: 24 * 60 * 60 * 1000,    // Maximum 24 hours
    },

    // Validation
    initialValidation: {
      type: validationResultSchema,
    },
    monitoringHistory: {
      type: [monitoringCheckSchema],
      default: [],
    },

    // Alerts
    activeAlerts: {
      type: [activeAlertSchema],
      default: [],
    },
    alertHistory: {
      type: [activeAlertSchema],
      default: [],
    },

    // Weather
    weatherForecasts: {
      type: [weatherForecastSchema],
      default: [],
    },
    lastWeatherUpdate: Date,

    // Delta Plans
    deltaPlans: {
      type: [deltaPlanSchema],
      default: [],
    },
    currentDeltaPlanId: String,

    // Notifications
    notifications: {
      type: [notificationRecordSchema],
      default: [],
    },
    notificationPreferences: {
      enablePush: { type: Boolean, default: true },
      enableEmail: { type: Boolean, default: true },
      enableSms: { type: Boolean, default: false },
      alertThreshold: {
        type: String,
        enum: Object.values(AlertSeverity),
        default: AlertSeverity.MEDIUM,
      },
    },

    // Statistics
    totalAlertsDetected: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalDeltaPlansGenerated: {
      type: Number,
      default: 0,
      min: 0,
    },
    monitoringChecksCount: {
      type: Number,
      default: 0,
      min: 0,
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

// Index for finding trips that need monitoring checks
tripPlanSchema.index({
  monitoringStatus: 1,
  nextScheduledCheck: 1
});

// Index for user's monitored trips
tripPlanSchema.index({
  userId: 1,
  monitoringStatus: 1
});

// Index for trips with active alerts
tripPlanSchema.index({
  'activeAlerts.severity': 1,
  'activeAlerts.isAcknowledged': 1
});

// Index for trips starting soon (for pre-trip checks)
tripPlanSchema.index({
  startDate: 1,
  monitoringStatus: 1
});

// Index for user + date range
tripPlanSchema.index({
  userId: 1,
  startDate: -1
});

// ============================================================================
// VALIDATION
// ============================================================================

tripPlanSchema.pre('save', function(next) {
  if (this.endDate < this.startDate) {
    const error = new Error('End date must be after start date');
    return next(error);
  }

  // Calculate totalDays
  if (this.startDate && this.endDate) {
    const diffTime = Math.abs(this.endDate.getTime() - this.startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    this.totalDays = diffDays + 1;
  }

  next();
});

// ============================================================================
// METHODS
// ============================================================================

/**
 * Start monitoring for this trip
 */
tripPlanSchema.methods.startMonitoring = function(): void {
  this.monitoringStatus = MonitoringStatus.ACTIVE_MONITORING;
  this.monitoringStartedAt = new Date();
  this.nextScheduledCheck = new Date(Date.now() + this.monitoringInterval);
};

/**
 * Stop monitoring for this trip
 */
tripPlanSchema.methods.stopMonitoring = function(reason: 'completed' | 'cancelled' | 'paused'): void {
  if (reason === 'completed') {
    this.monitoringStatus = MonitoringStatus.COMPLETED;
  } else if (reason === 'cancelled') {
    this.monitoringStatus = MonitoringStatus.CANCELLED;
  } else {
    this.monitoringStatus = MonitoringStatus.PAUSED;
  }
  this.monitoringEndedAt = new Date();
  this.nextScheduledCheck = undefined;
};

/**
 * Add a new alert to the trip
 */
tripPlanSchema.methods.addAlert = function(alert: IActiveAlert): void {
  this.activeAlerts.push(alert);
  this.totalAlertsDetected += 1;

  // Update monitoring status if high/critical alert
  if (alert.severity === AlertSeverity.HIGH || alert.severity === AlertSeverity.CRITICAL) {
    this.monitoringStatus = MonitoringStatus.ALERT_DETECTED;
  }
};

/**
 * Add a monitoring check record
 */
tripPlanSchema.methods.addMonitoringCheck = function(check: IMonitoringCheck): void {
  this.monitoringHistory.push(check);
  this.monitoringChecksCount += 1;
  this.lastMonitoringCheck = check.timestamp;

  // Schedule next check
  this.nextScheduledCheck = new Date(Date.now() + this.monitoringInterval);
};

/**
 * Check if trip needs monitoring check
 */
tripPlanSchema.methods.needsMonitoringCheck = function(): boolean {
  if (this.monitoringStatus !== MonitoringStatus.ACTIVE_MONITORING) {
    return false;
  }

  if (!this.nextScheduledCheck) {
    return true;
  }

  return new Date() >= this.nextScheduledCheck;
};

// ============================================================================
// STATICS
// ============================================================================

/**
 * Find all trips that need monitoring checks
 */
tripPlanSchema.statics.findTripsNeedingCheck = function() {
  return this.find({
    monitoringStatus: MonitoringStatus.ACTIVE_MONITORING,
    nextScheduledCheck: { $lte: new Date() },
  });
};

/**
 * Find trips starting within specified days
 */
tripPlanSchema.statics.findUpcomingTrips = function(daysAhead: number = 7) {
  const now = new Date();
  const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  return this.find({
    startDate: { $gte: now, $lte: futureDate },
    monitoringStatus: { $in: [MonitoringStatus.ACTIVE_MONITORING, MonitoringStatus.NOT_MONITORING] },
  });
};

// ============================================================================
// EXPORT
// ============================================================================

export const TripPlan = mongoose.model<ITripPlan>('TripPlan', tripPlanSchema);
