import { Request, Response } from 'express';
import { UserPreferences } from '../../../auth/domain/models/UserPreferences';
import { DeviceToken } from '../../../safety/domain/models/DeviceToken';
import { SunProtectionService } from '../../domain/services/SunProtectionService';
import { pushNotificationService } from '../../../safety/domain/services/PushNotificationService';
import { logger } from '../../../../shared/config/logger';

/**
 * Controller for processing high UV alerts via scheduler
 */
export const processHighUVAlerts = async (req: Request, res: Response) => {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // 1. Find all users with high UV alerts enabled
    const preferences = await UserPreferences.find({
      'notificationPreferences.highUVAlerts': true,
    });

    if (preferences.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No users with high UV alerts enabled',
      });
    }

    const notifiedUsers = [];

    // 2. Process each user
    for (const pref of preferences) {
      const userId = pref.userId;

      // Find active device tokens for the user
      const devices = await DeviceToken.find({ userId, isActive: true });
      if (devices.length === 0) continue;

      // Take the most recently active device's location
      const latestDevice = devices.sort(
        (a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime()
      )[0];

      if (!latestDevice.location || !latestDevice.location.coordinates) continue;

      const [lon, lat] = latestDevice.location.coordinates;

      try {
        // 3. Call ML model and weather API
        // This will throw if the user doesn't have a health profile yet. We must catch that gracefully.
        const riskData = await SunProtectionService.predictRisk(userId.toString(), lat, lon);

        // 4. Check if UV index is high (e.g. 6 or higher is generally considered High)
        if (riskData.weather && riskData.weather.uvIndex >= 6) {
          // Extract ML prediction string for better body format
          let mlRiskInfo = '';
          if (riskData.prediction) {
            const predData =
              typeof riskData.prediction === 'string'
                ? JSON.parse(riskData.prediction)
                : riskData.prediction;
            mlRiskInfo = predData.Risk_Level ? ` Risk level: ${predData.Risk_Level}.` : '';
          }

          // Send notification
          const notificationTitle = `High UV Alert (Index: ${riskData.weather.uvIndex})`;
          const notificationBody = `The UV Index is currently high in your area.${mlRiskInfo} Please wear sunscreen and avoid direct sunlight.`;

          await pushNotificationService.sendToUser(userId as any, {
            title: notificationTitle,
            body: notificationBody,
            data: {
              type: 'system',
              screen: 'SafetyAdvisor',
            },
          });

          notifiedUsers.push(userId);
        }
      } catch (err: any) {
        logger.error(`Error processing UV alert for user ${userId}: ${err.message}`);
      }
    }

    return res.status(200).json({
      success: true,
      notifiedCount: notifiedUsers.length,
      message: `Processed ${preferences.length} users, notified ${notifiedUsers.length}`,
    });
  } catch (error: any) {
    logger.error('Error processing high UV alerts:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to process high UV alerts',
      error: error.message,
    });
  }
};
