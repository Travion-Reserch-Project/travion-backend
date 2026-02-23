import { Router } from 'express';
import { TransportChatbotController } from '../controllers/TransportChatbotController';
import { authenticate } from '../middleware/auth';
import {
  chatMessageValidator,
  conversationIdValidator,
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
