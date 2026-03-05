// routes/pushNotificationRoutes.ts

import { Router } from 'express';
import { PushNotificationController } from '../controllers/PushNotificationController';
import { authenticate } from '../../../../shared/middleware/auth';
import { apiLimiter } from '../../../../shared/config/rateLimiter';
import { body } from 'express-validator';

const router = Router();
const pushNotificationController = new PushNotificationController();

// POST /api/v1/push-notifications/register
router.post(
  '/register',
  authenticate as any,
  apiLimiter,
  [
    body('deviceToken').isString().notEmpty().withMessage('Device token is required'),
    body('platform')
      .isString()
      .isIn(['ios', 'android'])
      .withMessage('Platform must be ios or android'),
    body('location.latitude').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
    body('location.longitude').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  ],
  pushNotificationController.registerToken
);

// PUT /api/v1/push-notifications/location
router.put(
  '/location',
  authenticate as any,
  apiLimiter,
  [
    body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
    body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  ],
  pushNotificationController.updateLocation
);

// DELETE /api/v1/push-notifications/unregister
router.delete(
  '/unregister',
  authenticate as any,
  apiLimiter,
  pushNotificationController.unregisterToken
);

// GET /api/v1/push-notifications/devices
router.get('/devices', authenticate as any, apiLimiter, pushNotificationController.getUserDevices);

export { router as pushNotificationRoutes };
