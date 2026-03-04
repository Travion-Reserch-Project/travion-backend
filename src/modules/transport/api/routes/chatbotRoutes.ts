import { Router } from 'express';
import { TransportChatbotController } from '../controllers/TransportChatbotController';
import { authenticate } from '../../../../shared/middleware/auth';
import {
  chatMessageValidator,
  conversationIdValidator,
  newTripValidator,
  paginationValidator,
} from '../validators/chatbotValidator';

const router = Router();
const chatbotController = new TransportChatbotController();

// Health check (public)
router.get('/health', chatbotController.healthCheck);

// All other routes require authentication
router.use(authenticate as any);

/**
 * @route   POST /api/v1/chatbot/message
 * @desc    Send a message to the chatbot
 * @access  Private
 */
router.post('/message', chatMessageValidator, chatbotController.processMessage);

/**
 * @route   POST /api/v1/chatbot/conversations/new-trip
 * @desc    Start a new trip conversation (ends current active one)
 * @access  Private
 */
router.post('/conversations/new-trip', newTripValidator, chatbotController.startNewTrip);

/**
 * @route   GET /api/v1/chatbot/conversations
 * @desc    Get user's conversation history
 * @access  Private
 */
router.get('/conversations', paginationValidator, chatbotController.getConversations);

/**
 * @route   GET /api/v1/chatbot/conversations/:conversationId
 * @desc    Get specific conversation with messages
 * @access  Private
 */
router.get(
  '/conversations/:conversationId',
  conversationIdValidator,
  chatbotController.getConversation
);

export { router as chatbotRoutes };
