/**
 * ChatSession Routes
 * API routes for chat session management
 */

import { Router } from 'express';
import { ChatSessionController } from '../controllers/ChatSessionController';
import { authenticate } from '../middleware/auth';
import { validate, validateParams, validateQuery } from '../middleware/validator';
import {
  createSessionSchema,
  sendMessageSchema,
  quickChatSchema,
  updateContextSchema,
  setLocationSchema,
  updateTitleSchema,
  linkTripSchema,
  sessionIdParamSchema,
  getSessionsQuerySchema,
  getMessagesQuerySchema,
  searchSessionsQuerySchema,
  recentSessionsQuerySchema,
} from '../validators/chatSessionValidator';

const router = Router();
const chatController = new ChatSessionController();

// ============================================================================
// PROTECTED ROUTES (All routes require authentication)
// ============================================================================

// Apply authentication to all routes
router.use(authenticate);

// ============================================================================
// QUICK CHAT (Convenience endpoint)
// ============================================================================

/**
 * @route   POST /chat/quick
 * @desc    Quick chat - auto-creates session if needed
 * @access  Private
 */
router.post(
  '/quick',
  validate(quickChatSchema),
  chatController.quickChat
);

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * @route   GET /chat/sessions
 * @desc    Get all sessions for authenticated user
 * @access  Private
 */
router.get(
  '/sessions',
  validateQuery(getSessionsQuerySchema),
  chatController.getSessions
);

/**
 * @route   POST /chat/sessions
 * @desc    Create a new chat session
 * @access  Private
 */
router.post(
  '/sessions',
  validate(createSessionSchema),
  chatController.createSession
);

/**
 * @route   GET /chat/sessions/recent
 * @desc    Get recent active sessions
 * @access  Private
 */
router.get(
  '/sessions/recent',
  validateQuery(recentSessionsQuerySchema),
  chatController.getRecentSessions
);

/**
 * @route   GET /chat/sessions/search
 * @desc    Search sessions
 * @access  Private
 */
router.get(
  '/sessions/search',
  validateQuery(searchSessionsQuerySchema),
  chatController.searchSessions
);

/**
 * @route   GET /chat/sessions/:sessionId
 * @desc    Get session by ID
 * @access  Private
 */
router.get(
  '/sessions/:sessionId',
  validateParams(sessionIdParamSchema),
  chatController.getSession
);

/**
 * @route   DELETE /chat/sessions/:sessionId
 * @desc    Delete session
 * @access  Private
 */
router.delete(
  '/sessions/:sessionId',
  validateParams(sessionIdParamSchema),
  chatController.deleteSession
);

// ============================================================================
// MESSAGE OPERATIONS
// ============================================================================

/**
 * @route   GET /chat/sessions/:sessionId/messages
 * @desc    Get chat history
 * @access  Private
 */
router.get(
  '/sessions/:sessionId/messages',
  validateParams(sessionIdParamSchema),
  validateQuery(getMessagesQuerySchema),
  chatController.getMessages
);

/**
 * @route   POST /chat/sessions/:sessionId/messages
 * @desc    Send message and get AI response
 * @access  Private
 */
router.post(
  '/sessions/:sessionId/messages',
  validateParams(sessionIdParamSchema),
  validate(sendMessageSchema),
  chatController.sendMessage
);

// ============================================================================
// SESSION STATUS OPERATIONS
// ============================================================================

/**
 * @route   POST /chat/sessions/:sessionId/close
 * @desc    Close session
 * @access  Private
 */
router.post(
  '/sessions/:sessionId/close',
  validateParams(sessionIdParamSchema),
  chatController.closeSession
);

/**
 * @route   POST /chat/sessions/:sessionId/archive
 * @desc    Archive session
 * @access  Private
 */
router.post(
  '/sessions/:sessionId/archive',
  validateParams(sessionIdParamSchema),
  chatController.archiveSession
);

/**
 * @route   POST /chat/sessions/:sessionId/reopen
 * @desc    Reopen closed session
 * @access  Private
 */
router.post(
  '/sessions/:sessionId/reopen',
  validateParams(sessionIdParamSchema),
  chatController.reopenSession
);

// ============================================================================
// CONTEXT & SETTINGS
// ============================================================================

/**
 * @route   PATCH /chat/sessions/:sessionId/context
 * @desc    Update session context
 * @access  Private
 */
router.patch(
  '/sessions/:sessionId/context',
  validateParams(sessionIdParamSchema),
  validate(updateContextSchema),
  chatController.updateContext
);

/**
 * @route   PATCH /chat/sessions/:sessionId/location
 * @desc    Set current location
 * @access  Private
 */
router.patch(
  '/sessions/:sessionId/location',
  validateParams(sessionIdParamSchema),
  validate(setLocationSchema),
  chatController.setLocation
);

/**
 * @route   PATCH /chat/sessions/:sessionId/title
 * @desc    Update session title
 * @access  Private
 */
router.patch(
  '/sessions/:sessionId/title',
  validateParams(sessionIdParamSchema),
  validate(updateTitleSchema),
  chatController.updateTitle
);

// ============================================================================
// TRIP LINKING
// ============================================================================

/**
 * @route   POST /chat/sessions/:sessionId/link-trip
 * @desc    Link session to a saved trip
 * @access  Private
 */
router.post(
  '/sessions/:sessionId/link-trip',
  validateParams(sessionIdParamSchema),
  validate(linkTripSchema),
  chatController.linkToTrip
);

/**
 * @route   DELETE /chat/sessions/:sessionId/link-trip
 * @desc    Unlink session from trip
 * @access  Private
 */
router.delete(
  '/sessions/:sessionId/link-trip',
  validateParams(sessionIdParamSchema),
  chatController.unlinkFromTrip
);

export default router;
