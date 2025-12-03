import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { GoogleAuthController } from '../controllers/GoogleAuthController';
import { validate } from '../middleware/validator';
import { registerSchema, loginSchema, refreshTokenSchema } from '../validators/authValidator';
import { authenticate } from '../middleware/auth';

const router = Router();
const authController = new AuthController();
const googleAuthController = new GoogleAuthController();

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

/**
 * @route   POST /api/v1/auth/google
 * @desc    Authenticate with Google ID token from mobile app
 * @access  Public
 */
router.post('/google', googleAuthController.googleMobileAuth as any);

/**
 * @route   GET /api/v1/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', authenticate as any, googleAuthController.getProfile as any);

export default router;
