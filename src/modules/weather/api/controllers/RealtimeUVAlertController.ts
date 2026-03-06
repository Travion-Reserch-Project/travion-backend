// Removed UserPreferences import since we want to send to all users
import { SunProtectionService } from '../../domain/services/SunProtectionService';
import { pushNotificationService } from '../../../safety/domain/services/PushNotificationService';
import { logger } from '../../../../shared/config/logger';

/**
 * Real-time UV Alert Service
 * Checks UV risk for a user after their location updates
 * and sends a push notification if risk is high or very high
 */

// In-memory cooldown to prevent spamming notifications
// key: userId, value: timestamp of last notification sent
const notificationCooldown = new Map<string, number>();
const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes cooldown between notifications

export class RealtimeUVAlertService {
  /**
   * Check UV risk for a specific user at given coordinates
   * and send push notification if risk is high or very high.
   * This is called after a location update.
   */
  static async checkAndNotify(
    userId: string,
    latitude: number,
    longitude: number
  ): Promise<{ notified: boolean; riskLevel?: string; reason?: string }> {
    try {
      // 1. Check cooldown - don't spam notifications
      const lastNotified = notificationCooldown.get(userId);
      if (lastNotified && Date.now() - lastNotified < COOLDOWN_MS) {
        logger.info(`[RealtimeUVAlert] User ${userId} in cooldown, skipping check`);
        return { notified: false, reason: 'cooldown' };
      }

      // 2. We are now skipping the user preference check
      // User requested to send notifications to ALL users, not just those with highUVAlerts enabled.
      // Removed the code that checks UserPreferences.

      // 3. Predict risk using health profile + weather + ML model
      let riskData: any;
      try {
        riskData = await SunProtectionService.predictRisk(userId, latitude, longitude);
      } catch (err: any) {
        // User might not have health profile yet - skip gracefully
        logger.warn(`[RealtimeUVAlert] Cannot predict risk for user ${userId}: ${err.message}`);
        return { notified: false, reason: 'prediction_failed' };
      }

      // 4. Extract risk level from ML prediction
      let riskLevel = 'low';
      if (riskData.prediction) {
        const predData =
          typeof riskData.prediction === 'string'
            ? JSON.parse(riskData.prediction)
            : riskData.prediction;

        // Handle nested prediction structure from ML service
        if (predData.prediction) {
          const innerPred =
            typeof predData.prediction === 'string'
              ? JSON.parse(predData.prediction)
              : predData.prediction;
          riskLevel = (innerPred.Risk_Level || innerPred.risk_level || 'low').toLowerCase();
        } else {
          riskLevel = (predData.Risk_Level || predData.risk_level || 'low').toLowerCase();
        }
      }

      const uvIndex = riskData.weather?.uvIndex ?? 0;

      logger.info(
        `[RealtimeUVAlert] User ${userId} - UV Index: ${uvIndex}, Risk Level: ${riskLevel}`
      );

      // 5. Only send notification for HIGH or VERY HIGH risk
      if (riskLevel === 'high' || riskLevel === 'very high') {
        const isVeryHigh = riskLevel === 'very high';

        const notificationTitle = isVeryHigh
          ? `🚨 Very High UV Risk Alert (UV Index: ${uvIndex})`
          : `⚠️ High UV Risk Alert (UV Index: ${uvIndex})`;

        const notificationBody = isVeryHigh
          ? `URGENT: UV risk is very high at your current location! Seek shade immediately, apply SPF 50+ sunscreen, and wear protective clothing.`
          : `UV risk is high at your current location. Apply sunscreen, wear sunglasses and a hat, and limit sun exposure.`;

        await pushNotificationService.sendToUser(userId as any, {
          title: notificationTitle,
          body: notificationBody,
          data: {
            type: 'system',
            screen: 'SafetyAdvisor',
            uvIndex: uvIndex.toString(),
            riskLevel: riskLevel,
          },
        });

        // Update cooldown
        notificationCooldown.set(userId, Date.now());

        logger.info(
          `[RealtimeUVAlert] 🔔 Notification sent to user ${userId} - Risk: ${riskLevel}`
        );

        return { notified: true, riskLevel };
      }

      return { notified: false, riskLevel, reason: 'risk_not_high' };
    } catch (error: any) {
      logger.error(`[RealtimeUVAlert] Error checking UV risk for user ${userId}: ${error.message}`);
      return { notified: false, reason: 'error' };
    }
  }
}
