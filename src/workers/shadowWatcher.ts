/**
 * Shadow Watcher - Active Guardian Background Worker
 *
 * Phase 2: Post-Acceptance Active Watcher
 *
 * This worker continuously monitors accepted trip plans for:
 * - Weather changes (via OpenWeatherMap)
 * - News alerts (protests, landslides, road closures)
 * - Travel advisories
 *
 * When issues are detected, it:
 * - Updates trip status to ALERT_DETECTED
 * - Generates "Delta Plans" (alternative itineraries)
 * - Sends notifications to users
 *
 * Runs every 4 hours by default (configurable per trip)
 */

import { TripPlan, ITripPlan, MonitoringStatus, AlertSeverity, AlertCategory } from '../models/TripPlan';
import type { IActiveAlert, IMonitoringCheck, IDeltaPlan, IWeatherForecast } from '../models/TripPlan';
import { httpClient } from '../utils/httpClient';
import { logger } from '../config/logger';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// CONFIGURATION
// ============================================================================

interface ShadowWatcherConfig {
  enabled: boolean;
  checkIntervalMs: number;        // How often to run the worker loop
  batchSize: number;              // How many trips to check per cycle
  weatherCheckEnabled: boolean;
  alertCheckEnabled: boolean;
  deltaPlanEnabled: boolean;
  notificationsEnabled: boolean;
  aiEngineTimeout: number;        // Timeout for AI Engine requests
}

const DEFAULT_CONFIG: ShadowWatcherConfig = {
  enabled: true,
  checkIntervalMs: 5 * 60 * 1000,   // Check for due trips every 5 minutes
  batchSize: 10,                     // Process 10 trips per cycle
  weatherCheckEnabled: true,
  alertCheckEnabled: true,
  deltaPlanEnabled: true,
  notificationsEnabled: true,
  aiEngineTimeout: 60000,            // 60 second timeout for AI calls
};

// ============================================================================
// SHADOW WATCHER CLASS
// ============================================================================

export class ShadowWatcher {
  private config: ShadowWatcherConfig;
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private processingCount: number = 0;

  constructor(config: Partial<ShadowWatcherConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    logger.info('ShadowWatcher initialized', {
      enabled: this.config.enabled,
      checkInterval: this.config.checkIntervalMs,
      batchSize: this.config.batchSize,
    });
  }

  /**
   * Start the Shadow Watcher background worker
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('ShadowWatcher is already running');
      return;
    }

    if (!this.config.enabled) {
      logger.info('ShadowWatcher is disabled by configuration');
      return;
    }

    this.isRunning = true;
    logger.info('ShadowWatcher started');

    // Run immediately on start
    this.runMonitoringCycle();

    // Then schedule periodic runs
    this.intervalId = setInterval(() => {
      this.runMonitoringCycle();
    }, this.config.checkIntervalMs);
  }

  /**
   * Stop the Shadow Watcher
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('ShadowWatcher stopped');
  }

  /**
   * Run a single monitoring cycle
   */
  async runMonitoringCycle(): Promise<void> {
    if (this.processingCount > 0) {
      logger.debug('ShadowWatcher cycle skipped - previous cycle still running');
      return;
    }

    this.processingCount++;
    const cycleStartTime = Date.now();

    try {
      logger.info('ShadowWatcher: Starting monitoring cycle');

      // Find trips that need checking
      const tripsToCheck = await this.findTripsForMonitoring();

      if (tripsToCheck.length === 0) {
        logger.debug('ShadowWatcher: No trips need checking');
        return;
      }

      logger.info(`ShadowWatcher: Found ${tripsToCheck.length} trips to check`);

      // Process each trip
      for (const trip of tripsToCheck) {
        try {
          await this.monitorTrip(trip);
        } catch (error) {
          logger.error(`ShadowWatcher: Error monitoring trip ${trip._id}`, {
            error: (error as Error).message,
            tripId: trip._id,
          });
        }
      }

      const cycleDuration = Date.now() - cycleStartTime;
      logger.info(`ShadowWatcher: Cycle completed`, {
        tripsChecked: tripsToCheck.length,
        durationMs: cycleDuration,
      });

    } catch (error) {
      logger.error('ShadowWatcher: Cycle failed', {
        error: (error as Error).message,
      });
    } finally {
      this.processingCount--;
    }
  }

  /**
   * Find trips that are due for monitoring
   */
  private async findTripsForMonitoring(): Promise<ITripPlan[]> {
    const now = new Date();

    // Find trips with ACTIVE_MONITORING status that are due for check
    const trips = await TripPlan.find({
      monitoringStatus: MonitoringStatus.ACTIVE_MONITORING,
      $or: [
        { nextScheduledCheck: { $lte: now } },
        { nextScheduledCheck: { $exists: false } },
      ],
      startDate: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }, // Trip hasn't ended
    })
      .sort({ nextScheduledCheck: 1 })
      .limit(this.config.batchSize);

    return trips;
  }

  /**
   * Monitor a single trip
   */
  async monitorTrip(trip: ITripPlan): Promise<void> {
    const tripId = trip._id.toString();
    logger.info(`ShadowWatcher: Monitoring trip ${tripId}`, {
      title: trip.title,
      startDate: trip.startDate,
    });

    const checkId = uuidv4();
    const checkStartTime = Date.now();
    let checkStatus: 'passed' | 'warning' | 'failed' = 'passed';
    const details: string[] = [];
    let weatherScore = 100;
    let alertsFound = 0;

    try {
      // 1. Weather Check
      if (this.config.weatherCheckEnabled) {
        const weatherResult = await this.checkWeather(trip);
        weatherScore = weatherResult.score;

        if (weatherResult.hasIssues) {
          checkStatus = weatherResult.isCritical ? 'failed' : 'warning';
          details.push(...weatherResult.details);

          // Add weather alerts to trip
          for (const alert of weatherResult.alerts) {
            await this.addAlertToTrip(trip, alert);
            alertsFound++;
          }

          // Update weather forecasts
          trip.weatherForecasts = weatherResult.forecasts;
          trip.lastWeatherUpdate = new Date();
        }
      }

      // 2. News/Alert Check
      if (this.config.alertCheckEnabled) {
        const alertResult = await this.checkAlerts(trip);

        if (alertResult.hasIssues) {
          checkStatus = alertResult.isCritical ? 'failed' : 'warning';
          details.push(...alertResult.details);

          for (const alert of alertResult.alerts) {
            await this.addAlertToTrip(trip, alert);
            alertsFound++;
          }
        }
      }

      // 3. Generate Delta Plan if needed
      if (this.config.deltaPlanEnabled && checkStatus === 'failed') {
        const deltaPlan = await this.generateDeltaPlan(trip);
        if (deltaPlan) {
          trip.deltaPlans.push(deltaPlan);
          trip.currentDeltaPlanId = deltaPlan.deltaId;
          trip.totalDeltaPlansGenerated++;
          trip.monitoringStatus = MonitoringStatus.DELTA_PLAN_GENERATED;
          details.push(`Delta plan generated: ${deltaPlan.reason}`);
        }
      }

      // 4. Send Notifications if needed
      if (this.config.notificationsEnabled && checkStatus !== 'passed') {
        await this.sendNotifications(trip, checkStatus, details);
      }

      // Create monitoring check record
      const monitoringCheck: IMonitoringCheck = {
        checkId,
        timestamp: new Date(),
        checkType: 'full',
        status: checkStatus,
        weatherScore,
        alertsFound,
        details: details.length > 0 ? details.join('; ') : 'All checks passed',
      };

      // Update trip
      trip.monitoringHistory.push(monitoringCheck);
      trip.monitoringChecksCount++;
      trip.lastMonitoringCheck = new Date();
      trip.nextScheduledCheck = new Date(Date.now() + trip.monitoringInterval);

      await trip.save();

      const checkDuration = Date.now() - checkStartTime;
      logger.info(`ShadowWatcher: Trip check completed`, {
        tripId,
        status: checkStatus,
        weatherScore,
        alertsFound,
        durationMs: checkDuration,
      });

    } catch (error) {
      logger.error(`ShadowWatcher: Failed to monitor trip ${tripId}`, {
        error: (error as Error).message,
      });

      // Still update the check schedule even on error
      trip.nextScheduledCheck = new Date(Date.now() + trip.monitoringInterval);
      await trip.save();
    }
  }

  /**
   * Check weather conditions for the trip
   */
  private async checkWeather(trip: ITripPlan): Promise<{
    hasIssues: boolean;
    isCritical: boolean;
    score: number;
    details: string[];
    alerts: IActiveAlert[];
    forecasts: IWeatherForecast[];
  }> {
    const result = {
      hasIssues: false,
      isCritical: false,
      score: 100,
      details: [] as string[],
      alerts: [] as IActiveAlert[],
      forecasts: [] as IWeatherForecast[],
    };

    try {
      // Build itinerary items for AI Engine
      const itineraryItems = trip.itinerary.map(item => ({
        locationName: item.locationName,
        latitude: item.latitude,
        longitude: item.longitude,
        activity: item.activity,
        time: item.time,
      }));

      // Call AI Engine weather validation
      const response = await httpClient.post<{
        is_valid: boolean;
        overall_risk_level: string;
        score: number;
        blocking_issues: string[];
        warnings: string[];
        location_reports: Array<{
          location_name: string;
          trip_suitability_score: number;
          forecasts: Array<{
            datetime_local: string;
            temperature_celsius: number;
            rain_probability: number;
            wind_speed_kmh: number;
            condition: string;
            alerts: Array<{ severity: string; description: string }>;
          }>;
          critical_alerts: Array<{ severity: string; description: string }>;
        }>;
      }>('/api/v1/tools/weather/validate', {
        itinerary: itineraryItems,
        trip_date: trip.startDate.toISOString(),
      }, { timeout: this.config.aiEngineTimeout });

      result.score = response.score;

      // Check for blocking issues
      if (!response.is_valid) {
        result.hasIssues = true;
        result.isCritical = true;

        for (const issue of response.blocking_issues) {
          result.details.push(`Weather: ${issue}`);

          result.alerts.push({
            alertId: uuidv4(),
            category: AlertCategory.WEATHER,
            severity: AlertSeverity.HIGH,
            title: 'Weather Alert',
            description: issue,
            affectedLocation: 'Trip route',
            detectedAt: new Date(),
            isAcknowledged: false,
            travelImpact: 'Weather conditions may affect planned activities',
            recommendedAction: 'Consider rescheduling or indoor alternatives',
          });
        }
      }

      // Check for warnings
      for (const warning of response.warnings || []) {
        result.hasIssues = true;
        result.details.push(`Weather warning: ${warning}`);
      }

      // Build weather forecasts
      for (const report of response.location_reports || []) {
        for (const forecast of report.forecasts || []) {
          result.forecasts.push({
            locationName: report.location_name,
            date: new Date(forecast.datetime_local),
            condition: forecast.condition,
            temperatureMin: forecast.temperature_celsius - 3,
            temperatureMax: forecast.temperature_celsius + 3,
            rainProbability: forecast.rain_probability,
            windSpeed: forecast.wind_speed_kmh,
            suitabilityScore: report.trip_suitability_score,
            alerts: forecast.alerts?.map(a => a.description) || [],
            lastUpdated: new Date(),
          });
        }
      }

    } catch (error) {
      logger.warn('ShadowWatcher: Weather check failed', {
        tripId: trip._id,
        error: (error as Error).message,
      });
      result.details.push('Weather check unavailable');
    }

    return result;
  }

  /**
   * Check news alerts for the trip
   */
  private async checkAlerts(trip: ITripPlan): Promise<{
    hasIssues: boolean;
    isCritical: boolean;
    details: string[];
    alerts: IActiveAlert[];
  }> {
    const result = {
      hasIssues: false,
      isCritical: false,
      details: [] as string[],
      alerts: [] as IActiveAlert[],
    };

    try {
      // Build itinerary items for AI Engine
      const itineraryItems = trip.itinerary.map(item => ({
        locationName: item.locationName,
        latitude: item.latitude,
        longitude: item.longitude,
      }));

      // Call AI Engine alert validation
      const response = await httpClient.post<{
        is_safe: boolean;
        overall_risk: string;
        blocking_alerts: Array<{
          id: string;
          category: string;
          severity: string;
          title: string;
          description: string;
          affected_locations: string[];
          travel_impact: string;
          recommended_action: string;
          source_url?: string;
        }>;
        all_alerts: Array<{
          id: string;
          category: string;
          severity: string;
          title: string;
          description: string;
          affected_locations: string[];
          travel_impact: string;
          recommended_action: string;
          source_url?: string;
        }>;
        recommendations: string[];
      }>('/api/v1/tools/alerts/validate', {
        itinerary: itineraryItems,
        days_back: 7,
      }, { timeout: this.config.aiEngineTimeout });

      if (!response.is_safe) {
        result.hasIssues = true;
        result.isCritical = true;

        for (const alert of response.blocking_alerts) {
          result.details.push(`Alert: ${alert.title}`);

          result.alerts.push({
            alertId: alert.id || uuidv4(),
            category: this.mapAlertCategory(alert.category),
            severity: this.mapAlertSeverity(alert.severity),
            title: alert.title,
            description: alert.description,
            affectedLocation: alert.affected_locations?.[0] || 'Trip route',
            sourceUrl: alert.source_url,
            detectedAt: new Date(),
            isAcknowledged: false,
            travelImpact: alert.travel_impact,
            recommendedAction: alert.recommended_action,
          });
        }
      }

      // Add non-blocking alerts as warnings
      for (const alert of response.all_alerts || []) {
        if (!response.blocking_alerts.find(b => b.id === alert.id)) {
          result.hasIssues = true;
          result.details.push(`Warning: ${alert.title}`);
        }
      }

    } catch (error) {
      logger.warn('ShadowWatcher: Alert check failed', {
        tripId: trip._id,
        error: (error as Error).message,
      });
      result.details.push('Alert check unavailable');
    }

    return result;
  }

  /**
   * Generate a delta plan for a trip with issues
   */
  private async generateDeltaPlan(trip: ITripPlan): Promise<IDeltaPlan | null> {
    try {
      // Get active alerts for context
      const activeAlerts = trip.activeAlerts.filter(a => !a.isAcknowledged);

      // Build request for AI Engine
      const response = await httpClient.post<{
        success: boolean;
        delta_plan: {
          reason: string;
          original_items: Array<Record<string, unknown>>;
          suggested_items: Array<Record<string, unknown>>;
          affected_dates: string[];
          impact_summary: string;
          ai_explanation: string;
        };
      }>('/api/v1/tools/delta-plan/generate', {
        trip: {
          title: trip.title,
          start_date: trip.startDate.toISOString(),
          end_date: trip.endDate.toISOString(),
          destinations: trip.destinations,
          itinerary: trip.itinerary,
        },
        active_alerts: activeAlerts.map(a => ({
          category: a.category,
          severity: a.severity,
          title: a.title,
          affected_location: a.affectedLocation,
          recommended_action: a.recommendedAction,
        })),
      }, { timeout: this.config.aiEngineTimeout });

      if (!response.success || !response.delta_plan) {
        return null;
      }

      const deltaPlan: IDeltaPlan = {
        deltaId: uuidv4(),
        generatedAt: new Date(),
        reason: response.delta_plan.reason,
        triggeringAlertId: activeAlerts[0]?.alertId,
        originalItems: response.delta_plan.original_items as unknown[],
        suggestedItems: response.delta_plan.suggested_items as unknown[],
        affectedDates: response.delta_plan.affected_dates.map(d => new Date(d)),
        impactSummary: response.delta_plan.impact_summary,
        aiExplanation: response.delta_plan.ai_explanation,
      };

      logger.info('ShadowWatcher: Delta plan generated', {
        tripId: trip._id,
        deltaId: deltaPlan.deltaId,
        reason: deltaPlan.reason,
      });

      return deltaPlan;

    } catch (error) {
      logger.warn('ShadowWatcher: Delta plan generation failed', {
        tripId: trip._id,
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Add an alert to the trip
   */
  private async addAlertToTrip(trip: ITripPlan, alert: IActiveAlert): Promise<void> {
    // Check if alert already exists (by comparing title and location)
    const exists = trip.activeAlerts.some(
      a => a.title === alert.title && a.affectedLocation === alert.affectedLocation
    );

    if (!exists) {
      trip.activeAlerts.push(alert);
      trip.totalAlertsDetected++;

      // Update status if critical
      if (alert.severity === AlertSeverity.HIGH || alert.severity === AlertSeverity.CRITICAL) {
        trip.monitoringStatus = MonitoringStatus.ALERT_DETECTED;
      }
    }
  }

  /**
   * Send notifications to the user
   */
  private async sendNotifications(
    trip: ITripPlan,
    status: 'warning' | 'failed',
    details: string[]
  ): Promise<void> {
    // Check notification preferences
    if (!trip.notificationPreferences.enablePush &&
        !trip.notificationPreferences.enableEmail &&
        !trip.notificationPreferences.enableSms) {
      return;
    }

    const severity = status === 'failed' ? AlertSeverity.HIGH : AlertSeverity.MEDIUM;

    // Check threshold
    const severityOrder = [AlertSeverity.INFO, AlertSeverity.LOW, AlertSeverity.MEDIUM, AlertSeverity.HIGH, AlertSeverity.CRITICAL];
    const thresholdIndex = severityOrder.indexOf(trip.notificationPreferences.alertThreshold);
    const currentIndex = severityOrder.indexOf(severity);

    if (currentIndex < thresholdIndex) {
      return; // Below user's threshold
    }

    const notification = {
      notificationId: uuidv4(),
      type: 'alert' as const,
      title: status === 'failed' ? 'Trip Alert: Action Required' : 'Trip Advisory',
      message: details.slice(0, 3).join('; '),
      sentAt: new Date(),
      sentVia: [] as ('push' | 'email' | 'sms')[],
    };

    // Determine channels
    if (trip.notificationPreferences.enablePush) {
      notification.sentVia.push('push');
      // TODO: Implement push notification sending
    }
    if (trip.notificationPreferences.enableEmail) {
      notification.sentVia.push('email');
      // TODO: Implement email sending
    }
    if (trip.notificationPreferences.enableSms) {
      notification.sentVia.push('sms');
      // TODO: Implement SMS sending
    }

    trip.notifications.push(notification);

    logger.info('ShadowWatcher: Notification sent', {
      tripId: trip._id,
      type: notification.type,
      channels: notification.sentVia,
    });
  }

  /**
   * Map alert category from string to enum
   */
  private mapAlertCategory(category: string): AlertCategory {
    const mapping: Record<string, AlertCategory> = {
      'protest': AlertCategory.PROTEST,
      'strike': AlertCategory.STRIKE,
      'natural_disaster': AlertCategory.NATURAL_DISASTER,
      'landslide': AlertCategory.LANDSLIDE,
      'flood': AlertCategory.FLOOD,
      'road_closure': AlertCategory.ROAD_CLOSURE,
      'transport_disruption': AlertCategory.TRANSPORT_DISRUPTION,
      'security_incident': AlertCategory.SECURITY_INCIDENT,
      'health_emergency': AlertCategory.HEALTH_EMERGENCY,
      'weather': AlertCategory.WEATHER,
      'wildlife_danger': AlertCategory.WILDLIFE_DANGER,
    };
    return mapping[category.toLowerCase()] || AlertCategory.GENERAL;
  }

  /**
   * Map alert severity from string to enum
   */
  private mapAlertSeverity(severity: string): AlertSeverity {
    const mapping: Record<string, AlertSeverity> = {
      'info': AlertSeverity.INFO,
      'low': AlertSeverity.LOW,
      'medium': AlertSeverity.MEDIUM,
      'high': AlertSeverity.HIGH,
      'critical': AlertSeverity.CRITICAL,
    };
    return mapping[severity.toLowerCase()] || AlertSeverity.MEDIUM;
  }

  /**
   * Get watcher status
   */
  getStatus(): {
    isRunning: boolean;
    processingCount: number;
    config: ShadowWatcherConfig;
  } {
    return {
      isRunning: this.isRunning,
      processingCount: this.processingCount,
      config: this.config,
    };
  }

  /**
   * Manually trigger monitoring for a specific trip
   */
  async triggerMonitoring(tripId: string): Promise<void> {
    const trip = await TripPlan.findById(tripId);
    if (!trip) {
      throw new Error(`Trip not found: ${tripId}`);
    }

    if (trip.monitoringStatus !== MonitoringStatus.ACTIVE_MONITORING) {
      throw new Error(`Trip is not in active monitoring: ${trip.monitoringStatus}`);
    }

    await this.monitorTrip(trip);
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let shadowWatcherInstance: ShadowWatcher | null = null;

/**
 * Get or create Shadow Watcher instance
 */
export function getShadowWatcher(config?: Partial<ShadowWatcherConfig>): ShadowWatcher {
  if (!shadowWatcherInstance) {
    shadowWatcherInstance = new ShadowWatcher(config);
  }
  return shadowWatcherInstance;
}

/**
 * Start the Shadow Watcher
 */
export function startShadowWatcher(config?: Partial<ShadowWatcherConfig>): ShadowWatcher {
  const watcher = getShadowWatcher(config);
  watcher.start();
  return watcher;
}

/**
 * Stop the Shadow Watcher
 */
export function stopShadowWatcher(): void {
  if (shadowWatcherInstance) {
    shadowWatcherInstance.stop();
  }
}

export default ShadowWatcher;
