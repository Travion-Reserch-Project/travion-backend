/**
 * Trip Monitoring Service
 *
 * Provides the API layer for Active Guardian Shadow Monitoring functionality.
 * Handles trip monitoring operations, alert management, and delta plan interactions.
 *
 * This service is the interface between:
 * - REST API controllers
 * - Shadow Watcher background worker
 * - AI Engine integration
 */

import mongoose from 'mongoose';
import {
  TripPlan,
  ITripPlan,
  MonitoringStatus,
  AlertSeverity,
  AlertCategory,
} from '../models/TripPlan';
import type {
  IActiveAlert,
  IMonitoringCheck,
  IDeltaPlan,
  IValidationResult,
} from '../models/TripPlan';
import { httpClient } from '../utils/httpClient';
import { logger } from '../config/logger';
import { getShadowWatcher } from '../workers/shadowWatcher';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPES
// ============================================================================

export interface CreateTripPlanInput {
  userId: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  destinations: string[];
  itinerary: Array<{
    order: number;
    time: string;
    locationName: string;
    locationId?: string;
    latitude?: number;
    longitude?: number;
    activity: string;
    durationMinutes: number;
    notes?: string;
  }>;
  travelersCount?: number;
  estimatedBudget?: {
    currency: string;
    amount: number;
  };
  notificationPreferences?: {
    enablePush?: boolean;
    enableEmail?: boolean;
    enableSms?: boolean;
    alertThreshold?: AlertSeverity;
  };
}

export interface ValidationResponse {
  isValid: boolean;
  status: 'APPROVED' | 'APPROVED_WITH_WARNINGS' | 'NEEDS_ADJUSTMENT' | 'REJECTED';
  overallScore: number;
  constraints: Array<{
    type: string;
    severity: string;
    description: string;
    suggestion: string;
    isBlocking: boolean;
  }>;
  recommendations: string[];
  weatherInfo?: Record<string, unknown>;
  alertInfo?: Record<string, unknown>;
}

export interface MonitoringStatusResponse {
  tripId: string;
  status: MonitoringStatus;
  lastCheck?: Date;
  nextCheck?: Date;
  activeAlertsCount: number;
  deltaPlanAvailable: boolean;
  overallHealth: 'good' | 'warning' | 'critical';
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

class TripMonitoringService {
  /**
   * Create a new trip plan with initial validation
   */
  async createTripPlan(input: CreateTripPlanInput): Promise<ITripPlan> {
    logger.info('TripMonitoringService: Creating new trip plan', {
      userId: input.userId,
      title: input.title,
    });

    // Validate input
    if (!input.userId || !input.title || !input.startDate || !input.endDate) {
      throw new Error('Missing required fields: userId, title, startDate, endDate');
    }

    // Create the trip plan
    const tripPlan = new TripPlan({
      userId: new mongoose.Types.ObjectId(input.userId),
      title: input.title,
      description: input.description,
      startDate: input.startDate,
      endDate: input.endDate,
      destinations: input.destinations,
      itinerary: input.itinerary,
      travelersCount: input.travelersCount || 1,
      estimatedBudget: input.estimatedBudget,
      generatedBy: 'ai',
      status: 'draft',
      monitoringStatus: MonitoringStatus.NOT_MONITORING,
      notificationPreferences: {
        enablePush: input.notificationPreferences?.enablePush ?? true,
        enableEmail: input.notificationPreferences?.enableEmail ?? true,
        enableSms: input.notificationPreferences?.enableSms ?? false,
        alertThreshold: input.notificationPreferences?.alertThreshold ?? AlertSeverity.MEDIUM,
      },
    });

    // Perform initial validation via AI Engine
    const validation = await this.validateTripPlan(tripPlan);
    tripPlan.initialValidation = validation;

    // Set constraints from validation
    if (validation.correctionHints && validation.correctionHints.length > 0) {
      tripPlan.constraints = validation.correctionHints.map((hint, index) => ({
        constraintType: 'validation',
        description: hint,
        severity: validation.status === 'REJECTED' ? 'critical' : 'medium',
        suggestion: validation.recommendations[index] || 'Review and adjust',
      }));
    }

    await tripPlan.save();

    logger.info('TripMonitoringService: Trip plan created', {
      tripId: tripPlan._id,
      validationStatus: validation.status,
    });

    return tripPlan;
  }

  /**
   * Validate a trip plan using AI Engine
   */
  async validateTripPlan(tripPlan: ITripPlan): Promise<IValidationResult> {
    const validationId = uuidv4();

    try {
      // Build itinerary items for AI Engine
      const itineraryItems = tripPlan.itinerary.map(item => ({
        locationName: item.locationName,
        latitude: item.latitude,
        longitude: item.longitude,
        activity: item.activity,
        time: item.time,
      }));

      // Call AI Engine shadow monitor validation
      const response = await httpClient.postWithLongTimeout<{
        status: string;
        overall_score: number;
        constraints: Array<{
          constraint_type: string;
          severity: string;
          description: string;
          suggestion: string;
          is_blocking: boolean;
        }>;
        weather_validation?: Record<string, unknown>;
        alert_validation?: Record<string, unknown>;
        event_validation?: Record<string, unknown>;
        recommendations: string[];
        should_trigger_correction: boolean;
        correction_hints: string[];
      }>('/api/v1/shadow-monitor/validate', {
        itinerary: itineraryItems,
        trip_date: tripPlan.startDate.toISOString(),
        activities: tripPlan.itinerary.map(i => i.activity),
      }, 120000);

      const result: IValidationResult = {
        validationId,
        timestamp: new Date(),
        status: response.status as IValidationResult['status'],
        overallScore: response.overall_score,
        weatherValidation: response.weather_validation,
        alertValidation: response.alert_validation,
        eventValidation: response.event_validation,
        recommendations: response.recommendations,
        correctionHints: response.correction_hints,
      };

      return result;

    } catch (error) {
      logger.error('TripMonitoringService: Validation failed', {
        tripId: tripPlan._id,
        error: (error as Error).message,
      });

      // Return a fallback validation result
      return {
        validationId,
        timestamp: new Date(),
        status: 'APPROVED_WITH_WARNINGS',
        overallScore: 70,
        recommendations: ['Validation service unavailable - manual review recommended'],
        correctionHints: [],
      };
    }
  }

  /**
   * Start monitoring for a trip
   */
  async startMonitoring(tripId: string): Promise<ITripPlan> {
    const trip = await TripPlan.findById(tripId);
    if (!trip) {
      throw new Error(`Trip not found: ${tripId}`);
    }

    if (trip.monitoringStatus === MonitoringStatus.ACTIVE_MONITORING) {
      throw new Error('Trip is already being monitored');
    }

    // Check if trip can be monitored (must be in future or ongoing)
    const now = new Date();
    if (trip.endDate < now) {
      throw new Error('Cannot monitor completed trips');
    }

    trip.monitoringStatus = MonitoringStatus.ACTIVE_MONITORING;
    trip.monitoringStartedAt = new Date();
    trip.nextScheduledCheck = new Date(Date.now() + trip.monitoringInterval);
    trip.status = 'planned';

    await trip.save();

    logger.info('TripMonitoringService: Monitoring started', {
      tripId,
      nextCheck: trip.nextScheduledCheck,
    });

    return trip;
  }

  /**
   * Stop monitoring for a trip
   */
  async stopMonitoring(
    tripId: string,
    reason: 'completed' | 'cancelled' | 'paused'
  ): Promise<ITripPlan> {
    const trip = await TripPlan.findById(tripId);
    if (!trip) {
      throw new Error(`Trip not found: ${tripId}`);
    }

    const statusMap = {
      completed: MonitoringStatus.COMPLETED,
      cancelled: MonitoringStatus.CANCELLED,
      paused: MonitoringStatus.PAUSED,
    };

    trip.monitoringStatus = statusMap[reason];
    trip.monitoringEndedAt = new Date();
    trip.nextScheduledCheck = undefined;

    if (reason === 'completed') {
      trip.status = 'completed';
    } else if (reason === 'cancelled') {
      trip.status = 'cancelled';
    }

    await trip.save();

    logger.info('TripMonitoringService: Monitoring stopped', {
      tripId,
      reason,
    });

    return trip;
  }

  /**
   * Get monitoring status for a trip
   */
  async getMonitoringStatus(tripId: string): Promise<MonitoringStatusResponse> {
    const trip = await TripPlan.findById(tripId);
    if (!trip) {
      throw new Error(`Trip not found: ${tripId}`);
    }

    // Determine overall health
    let overallHealth: 'good' | 'warning' | 'critical' = 'good';
    const activeAlerts = trip.activeAlerts.filter(a => !a.isAcknowledged);

    if (activeAlerts.some(a => a.severity === AlertSeverity.CRITICAL)) {
      overallHealth = 'critical';
    } else if (activeAlerts.some(a =>
      a.severity === AlertSeverity.HIGH || a.severity === AlertSeverity.MEDIUM
    )) {
      overallHealth = 'warning';
    }

    return {
      tripId: trip._id.toString(),
      status: trip.monitoringStatus,
      lastCheck: trip.lastMonitoringCheck,
      nextCheck: trip.nextScheduledCheck,
      activeAlertsCount: activeAlerts.length,
      deltaPlanAvailable: trip.deltaPlans.some(dp => !dp.userAccepted),
      overallHealth,
    };
  }

  /**
   * Get active alerts for a trip
   */
  async getActiveAlerts(tripId: string): Promise<IActiveAlert[]> {
    const trip = await TripPlan.findById(tripId);
    if (!trip) {
      throw new Error(`Trip not found: ${tripId}`);
    }

    return trip.activeAlerts.filter(a => !a.isAcknowledged);
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(
    tripId: string,
    alertId: string,
    response: 'accept_risk' | 'modify_plan' | 'cancel'
  ): Promise<ITripPlan> {
    const trip = await TripPlan.findById(tripId);
    if (!trip) {
      throw new Error(`Trip not found: ${tripId}`);
    }

    const alert = trip.activeAlerts.find(a => a.alertId === alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    alert.isAcknowledged = true;
    alert.acknowledgedAt = new Date();
    alert.userResponse = response;

    // Move to history
    trip.alertHistory.push({ ...alert });

    // Remove from active alerts
    trip.activeAlerts = trip.activeAlerts.filter(a => a.alertId !== alertId);

    // Update monitoring status if no more unacknowledged alerts
    if (trip.activeAlerts.filter(a => !a.isAcknowledged).length === 0) {
      if (response === 'cancel') {
        trip.monitoringStatus = MonitoringStatus.CANCELLED;
        trip.status = 'cancelled';
      } else {
        trip.monitoringStatus = MonitoringStatus.ACTIVE_MONITORING;
      }
    }

    await trip.save();

    logger.info('TripMonitoringService: Alert acknowledged', {
      tripId,
      alertId,
      response,
    });

    return trip;
  }

  /**
   * Get current delta plan for a trip
   */
  async getCurrentDeltaPlan(tripId: string): Promise<IDeltaPlan | null> {
    const trip = await TripPlan.findById(tripId);
    if (!trip) {
      throw new Error(`Trip not found: ${tripId}`);
    }

    if (!trip.currentDeltaPlanId) {
      return null;
    }

    return trip.deltaPlans.find(dp => dp.deltaId === trip.currentDeltaPlanId) || null;
  }

  /**
   * Accept or reject a delta plan
   */
  async respondToDeltaPlan(
    tripId: string,
    deltaId: string,
    accept: boolean
  ): Promise<ITripPlan> {
    const trip = await TripPlan.findById(tripId);
    if (!trip) {
      throw new Error(`Trip not found: ${tripId}`);
    }

    const deltaPlan = trip.deltaPlans.find(dp => dp.deltaId === deltaId);
    if (!deltaPlan) {
      throw new Error(`Delta plan not found: ${deltaId}`);
    }

    deltaPlan.userAccepted = accept;
    deltaPlan.acceptedAt = new Date();

    if (accept) {
      // Apply the delta plan - replace affected itinerary items
      // This is a simplified version - in production, would need more sophisticated merging
      trip.itinerary = deltaPlan.suggestedItems as ITripPlan['itinerary'];

      logger.info('TripMonitoringService: Delta plan accepted and applied', {
        tripId,
        deltaId,
      });
    } else {
      logger.info('TripMonitoringService: Delta plan rejected', {
        tripId,
        deltaId,
      });
    }

    // Clear current delta plan
    trip.currentDeltaPlanId = undefined;

    // Return to active monitoring
    if (trip.monitoringStatus === MonitoringStatus.DELTA_PLAN_GENERATED) {
      trip.monitoringStatus = MonitoringStatus.ACTIVE_MONITORING;
    }

    await trip.save();

    return trip;
  }

  /**
   * Trigger immediate monitoring check for a trip
   */
  async triggerImmediateCheck(tripId: string): Promise<void> {
    const watcher = getShadowWatcher();
    await watcher.triggerMonitoring(tripId);
  }

  /**
   * Get monitoring history for a trip
   */
  async getMonitoringHistory(
    tripId: string,
    limit: number = 20
  ): Promise<IMonitoringCheck[]> {
    const trip = await TripPlan.findById(tripId);
    if (!trip) {
      throw new Error(`Trip not found: ${tripId}`);
    }

    return trip.monitoringHistory
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get weather forecasts for a trip
   */
  async getWeatherForecasts(tripId: string): Promise<ITripPlan['weatherForecasts']> {
    const trip = await TripPlan.findById(tripId);
    if (!trip) {
      throw new Error(`Trip not found: ${tripId}`);
    }

    return trip.weatherForecasts;
  }

  /**
   * Update notification preferences for a trip
   */
  async updateNotificationPreferences(
    tripId: string,
    preferences: Partial<ITripPlan['notificationPreferences']>
  ): Promise<ITripPlan> {
    const trip = await TripPlan.findById(tripId);
    if (!trip) {
      throw new Error(`Trip not found: ${tripId}`);
    }

    trip.notificationPreferences = {
      ...trip.notificationPreferences,
      ...preferences,
    };

    await trip.save();

    return trip;
  }

  /**
   * Get all monitored trips for a user
   */
  async getUserMonitoredTrips(userId: string): Promise<ITripPlan[]> {
    return TripPlan.find({
      userId: new mongoose.Types.ObjectId(userId),
      monitoringStatus: {
        $in: [
          MonitoringStatus.ACTIVE_MONITORING,
          MonitoringStatus.ALERT_DETECTED,
          MonitoringStatus.DELTA_PLAN_GENERATED,
        ],
      },
    }).sort({ startDate: 1 });
  }

  /**
   * Get trip statistics for a user
   */
  async getUserTripStats(userId: string): Promise<{
    totalTrips: number;
    activeMonitoring: number;
    totalAlertsDetected: number;
    totalDeltaPlansGenerated: number;
    completedTrips: number;
  }> {
    const trips = await TripPlan.find({
      userId: new mongoose.Types.ObjectId(userId),
    });

    return {
      totalTrips: trips.length,
      activeMonitoring: trips.filter(
        t => t.monitoringStatus === MonitoringStatus.ACTIVE_MONITORING
      ).length,
      totalAlertsDetected: trips.reduce((sum, t) => sum + t.totalAlertsDetected, 0),
      totalDeltaPlansGenerated: trips.reduce((sum, t) => sum + t.totalDeltaPlansGenerated, 0),
      completedTrips: trips.filter(
        t => t.monitoringStatus === MonitoringStatus.COMPLETED
      ).length,
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const tripMonitoringService = new TripMonitoringService();

export default TripMonitoringService;
