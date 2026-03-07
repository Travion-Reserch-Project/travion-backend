// services/PushNotificationService.ts

import admin from 'firebase-admin';
import { DeviceToken, IDeviceToken } from '../models/DeviceToken';
import mongoose from 'mongoose';

export interface NotificationPayload {
  title: string;
  body: string;
  data?: {
    type: 'incident_alert' | 'system';
    screen?: string;
    incidentId?: string;
    latitude?: string;
    longitude?: string;
    [key: string]: string | undefined;
  };
}

export class PushNotificationService {
  private initialized: boolean = false;

  /**
   * Filter out undefined values from data object for Firebase
   */
  private filterData(data?: Record<string, string | undefined>): Record<string, string> {
    if (!data) return {};
    const filtered: Record<string, string> = {};
    Object.keys(data).forEach((key) => {
      if (data[key] !== undefined) {
        filtered[key] = data[key] as string;
      }
    });
    return filtered;
  }

  /**
   * Initialize Firebase Admin SDK
   * Note: You need to set up Firebase service account and store credentials
   */
  initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // Check if Firebase is already initialized
      if (admin.apps.length === 0) {
        // Option 1: Using service account file (recommended for production)
        // Place firebase-service-account.json in your config folder
        // admin.initializeApp({
        //   credential: admin.credential.cert(
        //     require('../../config/firebase-service-account.json')
        //   ),
        // });

        // Option 2: Using environment variables (for development/deployment)
        if (
          process.env.FIREBASE_PROJECT_ID &&
          process.env.FIREBASE_CLIENT_EMAIL &&
          process.env.FIREBASE_PRIVATE_KEY
        ) {
          admin.initializeApp({
            credential: admin.credential.cert({
              projectId: process.env.FIREBASE_PROJECT_ID,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            }),
          });
          console.log('[PushNotificationService] Firebase Admin initialized successfully');
        } else {
          console.warn(
            '[PushNotificationService] Firebase credentials not found. Push notifications disabled.'
          );
          return;
        }
      }

      this.initialized = true;
    } catch (error) {
      console.error('[PushNotificationService] Firebase initialization error:', error);
    }
  }

  /**
   * Send notification to a single device
   */
  async sendToDevice(deviceToken: string, notification: NotificationPayload): Promise<boolean> {
    if (!this.initialized) {
      console.warn('[PushNotificationService] Not initialized. Skipping notification.');
      return false;
    }

    try {
      const message: admin.messaging.Message = {
        token: deviceToken,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: this.filterData(notification.data),
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            priority: 'high' as const,
            channelId: 'incident_alerts',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().send(message);
      console.log('[PushNotificationService] Notification sent successfully:', response);
      return true;
    } catch (error: any) {
      console.error('[PushNotificationService] Send notification error:', error);

      // Handle invalid tokens
      if (
        error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered'
      ) {
        await this.removeInvalidToken(deviceToken);
      }

      return false;
    }
  }

  /**
   * Send notification to multiple devices
   */
  async sendToMultipleDevices(
    deviceTokens: string[],
    notification: NotificationPayload
  ): Promise<{ successCount: number; failureCount: number }> {
    if (!this.initialized) {
      console.warn('[PushNotificationService] Not initialized. Skipping notifications.');
      return { successCount: 0, failureCount: deviceTokens.length };
    }

    if (deviceTokens.length === 0) {
      return { successCount: 0, failureCount: 0 };
    }

    try {
      const message: admin.messaging.MulticastMessage = {
        tokens: deviceTokens,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: this.filterData(notification.data),
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            priority: 'high' as const,
            channelId: 'incident_alerts',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);

      console.log(
        `[PushNotificationService] Sent ${response.successCount}/${deviceTokens.length} notifications`
      );

      // Handle failed tokens
      if (response.failureCount > 0) {
        const failedTokens: string[] = [];
        response.responses.forEach((resp: any, idx: number) => {
          if (!resp.success) {
            failedTokens.push(deviceTokens[idx]);
            console.error(
              `[PushNotificationService] Failed to send to ${deviceTokens[idx]}:`,
              resp.error
            );
          }
        });

        // Remove invalid tokens
        await this.removeInvalidTokens(failedTokens);
      }

      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (error) {
      console.error('[PushNotificationService] Send multiple notifications error:', error);
      return { successCount: 0, failureCount: deviceTokens.length };
    }
  }

  /**
   * Send incident alert to nearby devices
   */
  async sendIncidentAlertToNearby(
    latitude: number,
    longitude: number,
    radiusInKm: number,
    incidentDetails: {
      incidentType: string;
      location: string;
      distance: string;
      incidentId: string;
    },
    reporterUserId?: mongoose.Types.ObjectId,
    reporterDeviceToken?: string
  ): Promise<{ notifiedCount: number }> {
    try {
      // Find nearby active devices (excluding the reporter's device)
      const nearbyDevices = await (DeviceToken as any).findNearbyDevices(
        longitude,
        latitude,
        radiusInKm,
        reporterUserId,
        reporterDeviceToken
      );

      if (nearbyDevices.length === 0) {
        console.log('[PushNotificationService] No nearby devices found');
        return { notifiedCount: 0 };
      }

      console.log(`[PushNotificationService] Found ${nearbyDevices.length} nearby devices`);

      // Extract device tokens
      const deviceTokens = nearbyDevices.map((device: IDeviceToken) => device.deviceToken);

      // Prepare notification
      const notification: NotificationPayload = {
        title: `${incidentDetails.incidentType} Alert Nearby`,
        body: `Reported ${incidentDetails.distance} at ${incidentDetails.location}`,
        data: {
          type: 'incident_alert',
          screen: 'AlertsScreen',
          incidentId: incidentDetails.incidentId,
          latitude: latitude.toString(),
          longitude: longitude.toString(),
        },
      };

      // Send notifications
      const result = await this.sendToMultipleDevices(deviceTokens, notification);

      console.log(
        `[PushNotificationService] Incident alert sent to ${result.successCount} devices`
      );

      return { notifiedCount: result.successCount };
    } catch (error) {
      console.error('[PushNotificationService] Send incident alert error:', error);
      return { notifiedCount: 0 };
    }
  }

  /**
   * Send system notification to a specific user
   */
  async sendToUser(
    userId: mongoose.Types.ObjectId,
    notification: NotificationPayload
  ): Promise<boolean> {
    try {
      const devices = await DeviceToken.find({ userId, isActive: true });

      if (devices.length === 0) {
        console.log(`[PushNotificationService] No active devices for user ${userId}`);
        return false;
      }

      const deviceTokens = devices.map((device) => device.deviceToken);
      const result = await this.sendToMultipleDevices(deviceTokens, notification);

      return result.successCount > 0;
    } catch (error) {
      console.error('[PushNotificationService] Send to user error:', error);
      return false;
    }
  }

  /**
   * Remove invalid device token from database
   */
  private async removeInvalidToken(deviceToken: string): Promise<void> {
    try {
      await DeviceToken.findOneAndUpdate({ deviceToken }, { isActive: false }, { new: true });
      console.log(`[PushNotificationService] Marked token as inactive: ${deviceToken}`);
    } catch (error) {
      console.error('[PushNotificationService] Remove invalid token error:', error);
    }
  }

  /**
   * Remove multiple invalid tokens
   */
  private async removeInvalidTokens(deviceTokens: string[]): Promise<void> {
    try {
      await DeviceToken.updateMany({ deviceToken: { $in: deviceTokens } }, { isActive: false });
      console.log(`[PushNotificationService] Marked ${deviceTokens.length} tokens as inactive`);
    } catch (error) {
      console.error('[PushNotificationService] Remove invalid tokens error:', error);
    }
  }

  /**
   * Cleanup old inactive tokens (run as cron job)
   */
  async cleanupInactiveTokens(daysInactive: number = 30): Promise<number> {
    try {
      const result = await (DeviceToken as any).cleanupInactiveTokens(daysInactive);
      console.log(`[PushNotificationService] Cleaned up ${result.deletedCount} inactive tokens`);
      return result.deletedCount || 0;
    } catch (error) {
      console.error('[PushNotificationService] Cleanup error:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const pushNotificationService = new PushNotificationService();
