import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { authenticate } from '../middleware/auth';
import { validate, validateParams, validateQuery } from '../middleware/validator';
import { updateUserSchema, userIdSchema, paginationSchema } from '../validators/userValidator';
import { updateChatPreferencesValidator } from '../validators/chatValidator';

const router = Router();
const userController = new UserController();

// All routes require authentication
router.use(authenticate as any);

/**
 * @route   GET /api/v1/users/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', userController.getProfile as any);

/**
 * @route   PUT /api/v1/users/profile
 * @desc    Update current user profile
 * @access  Private
 */
router.put('/profile', validate(updateUserSchema), userController.updateProfile as any);

/**
 * @route   GET /api/v1/users
 * @desc    Get all users (with pagination)
 * @access  Private
 */
router.get('/', validateQuery(paginationSchema), userController.getAllUsers as any);

/**
 * @route   GET /api/v1/users/:userId
 * @desc    Get user by ID
 * @access  Private
 */
router.get('/:userId', validateParams(userIdSchema), userController.getUserById as any);

/**
 * @route   PUT /api/v1/users/:userId
 * @desc    Update user by ID
 * @access  Private
 */
router.put(
  '/:userId',
  validateParams(userIdSchema),
  validate(updateUserSchema),
  userController.updateUser as any
);

/**
 * @route   DELETE /api/v1/users/:userId
 * @desc    Delete user by ID
 * @access  Private
 */
router.delete('/:userId', validateParams(userIdSchema), userController.deleteUser as any);

/**
 * @route   PUT /api/v1/users/chat/preferences
 * @desc    Update chat preferences for current user
 * @access  Private
 */
router.put(
  '/chat/preferences',
  updateChatPreferencesValidator,
  userController.updateChatPreferences as any
);

export default router;
