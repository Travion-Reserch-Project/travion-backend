import { Response, NextFunction } from 'express';
import { TransportChatbotService } from '../../domain/services/TransportChatbotService';
import { AuthRequest } from '../../../../shared/middleware/auth';
import { logger } from '../../../../shared/config/logger';

export class TransportChatbotController {
  private chatbotService: TransportChatbotService;

  constructor() {
    this.chatbotService = new TransportChatbotService();
  }

  /**
   * Process chat message
   */
  processMessage = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
        return;
      }

      const { message, conversation_id, language, current_location } = req.body;

      if (!message) {
        res.status(400).json({
          success: false,
          message: 'Message is required',
        });
        return;
      }

      const response = await this.chatbotService.processQuery({
        user_id: userId,
        message,
        conversation_id,
        language: language || 'en',
        context: current_location ? { current_location } : undefined,
      });

      res.status(200).json({
        success: true,
        data: response,
      });
    } catch (error) {
      logger.error('Error in processMessage:', error);
      next(error);
    }
  };

  /**
   * Start a new trip conversation
   */
  startNewTrip = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
        return;
      }

      const { title } = req.body;
      const result = await this.chatbotService.startNewTripConversation(userId, title);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Error in startNewTrip:', error);
      next(error);
    }
  };

  /**
   * Get conversation history
   */
  getConversations = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await this.chatbotService.getConversationHistory(userId, page, limit);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Error in getConversations:', error);
      next(error);
    }
  };

  /**
   * Get specific conversation with messages
   */
  getConversation = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
        return;
      }

      const { conversationId } = req.params;

      const result = await this.chatbotService.getConversationWithMessages(conversationId);

      if (!result) {
        res.status(404).json({
          success: false,
          message: 'Conversation not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Error in getConversation:', error);
      next(error);
    }
  };

  /**
   * Health check
   */
  healthCheck = async (_req: AuthRequest, res: Response): Promise<void> => {
    res.status(200).json({
      success: true,
      message: 'Transport Chatbot service is running',
      timestamp: new Date().toISOString(),
    });
  };
}
