import { Router } from 'express';
import passport from 'passport';
import { AuthController } from '../controllers/AuthController';
import { GoogleAuthController } from '../controllers/GoogleAuthController';
import { validate } from '../middleware/validator';
import { registerSchema, loginSchema, refreshTokenSchema } from '../validators/authValidator';
import { authenticate } from '../middleware/auth';
import { Request, Response, NextFunction } from 'express';

const router = Router();
const authController = new AuthController();
const googleAuthController = new GoogleAuthController();

// Middleware to check if Google OAuth is configured
const checkGoogleOAuth = (_req: Request, res: Response, next: NextFunction): void => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    res.status(503).json({
      success: false,
      message: 'Google OAuth is not configured. Please contact the administrator.',
    });
    return;
  }
  next();
};

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', validate(registerSchema), authController.register);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', validate(loginSchema), authController.login);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh', validate(refreshTokenSchema), authController.refreshToken);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user and clear cookies
 * @access  Public
 */
router.post('/logout', authController.logout);

// Google OAuth routes
/**
 * @route   GET /api/v1/auth/google
 * @desc    Initiate Google OAuth
 * @access  Public
 */
router.get(
  '/google',
  checkGoogleOAuth,
  passport.authenticate('google', {
    scope: ['profile', 'email'],
  })
);

/**
 * @route   GET /api/v1/auth/google/callback
 * @desc    Google OAuth callback
 * @access  Public
 */
router.get(
  '/google/callback',
  checkGoogleOAuth,
  passport.authenticate('google', {
    failureRedirect: `${process.env.CLIENT_URL}/auth/error`,
    session: false,
  }),
  googleAuthController.googleCallback
);

/**
 * @route   GET /api/v1/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', authenticate as any, googleAuthController.getProfile as any);

export default router;
