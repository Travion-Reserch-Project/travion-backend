// controllers/PushNotificationController.ts

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../../../shared/middleware/auth';
import { validationResult } from 'express-validator';
import { DeviceToken } from '../../domain/models/DeviceToken';
import mongoose from 'mongoose';

export class PushNotificationController {
  /**
   * Register device token with location
   * POST /api/v1/push-notifications/register
   */
  registerToken = async (req: AuthRequest, res: Response, _next: NextFunction): Promise<void> => {
    try {
      console.log('token reg triggered');
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid request data',
            details: errors.array(),
          },
        });
        return;
      }

      const { deviceToken, platform, location } = req.body;
      const userId = req.user?.userId;

      console.log('[PushNotificationController] Registering token:', {
        userId,
        platform,
        hasToken: !!deviceToken,
        location,
      });

      // Check if token already exists
      const existingToken = await DeviceToken.findOne({ deviceToken });

      if (existingToken) {
        // Update existing token
        existingToken.userId = userId ? new mongoose.Types.ObjectId(userId) : undefined;
        existingToken.platform = platform;
        existingToken.location = {
          type: 'Point',
          coordinates: [location.longitude, location.latitude],
        };
        existingToken.locationUpdatedAt = new Date();
        existingToken.isActive = true;
        existingToken.lastActiveAt = new Date();

        await existingToken.save();

        console.log('[PushNotificationController] Token updated successfully');

        res.status(200).json({
          success: true,
          message: 'Device token updated successfully',
          data: {
            tokenId: existingToken._id,
          },
        });
      } else {
        // Create new token
        const newToken = new DeviceToken({
          userId: userId ? new mongoose.Types.ObjectId(userId) : undefined,
          deviceToken,
          platform,
          location: {
            type: 'Point',
            coordinates: [location.longitude, location.latitude],
          },
          isActive: true,
          lastActiveAt: new Date(),
        });

        await newToken.save();

        console.log('[PushNotificationController] Token registered successfully');

        res.status(201).json({
          success: true,
          message: 'Device token registered successfully',
          data: {
            tokenId: newToken._id,
          },
        });
      }
    } catch (error) {
      console.error('[PushNotificationController] Register token error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: (error as Error).message || 'Failed to register device token',
        },
      });
    }
  };

  /**
   * Update device location
   * PUT /api/v1/push-notifications/location
   */
  updateLocation = async (req: AuthRequest, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid request data',
            details: errors.array(),
          },
        });
        return;
      }

      const { latitude, longitude } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            message: 'Authentication required',
          },
        });
        return;
      }

      console.log('[PushNotificationController] Updating location for user:', userId);

      // Update all active tokens for this user
      const result = await DeviceToken.updateMany(
        { userId: new mongoose.Types.ObjectId(userId), isActive: true },
        {
          $set: {
            location: {
              type: 'Point',
              coordinates: [longitude, latitude],
            },
            locationUpdatedAt: new Date(),
            lastActiveAt: new Date(),
          },
        }
      );

      console.log('[PushNotificationController] Updated locations:', result.modifiedCount);

      res.status(200).json({
        success: true,
        message: 'Location updated successfully',
        data: {
          updatedCount: result.modifiedCount,
        },
      });
    } catch (error) {
      console.error('[PushNotificationController] Update location error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: (error as Error).message || 'Failed to update location',
        },
      });
    }
  };

  /**
   * Unregister device token
   * DELETE /api/v1/push-notifications/unregister
   */
  unregisterToken = async (req: AuthRequest, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            message: 'Authentication required',
          },
        });
        return;
      }

      console.log('[PushNotificationController] Unregistering tokens for user:', userId);

      // Mark all tokens for this user as inactive
      const result = await DeviceToken.updateMany(
        { userId: new mongoose.Types.ObjectId(userId) },
        {
          $set: {
            isActive: false,
            lastActiveAt: new Date(),
          },
        }
      );

      console.log('[PushNotificationController] Unregistered tokens:', result.modifiedCount);

      res.status(200).json({
        success: true,
        message: 'Device tokens unregistered successfully',
        data: {
          unregisteredCount: result.modifiedCount,
        },
      });
    } catch (error) {
      console.error('[PushNotificationController] Unregister token error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: (error as Error).message || 'Failed to unregister device token',
        },
      });
    }
  };

  /**
   * Get user's registered devices
   * GET /api/v1/push-notifications/devices
   */
  getUserDevices = async (req: AuthRequest, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            message: 'Authentication required',
          },
        });
        return;
      }

      const devices = await DeviceToken.find({
        userId: new mongoose.Types.ObjectId(userId),
        isActive: true,
      }).select('-deviceToken'); // Don't expose actual tokens

      res.status(200).json({
        success: true,
        data: {
          devices: devices.map((device) => ({
            id: device._id,
            platform: device.platform,
            lastActiveAt: device.lastActiveAt,
            locationUpdatedAt: device.locationUpdatedAt,
          })),
          count: devices.length,
        },
      });
    } catch (error) {
      console.error('[PushNotificationController] Get user devices error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: (error as Error).message || 'Failed to fetch devices',
        },
      });
    }
  };
}


