/**
 * ChatSession Controller
 * HTTP request handlers for chat session endpoints
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ChatSessionService } from '../services/ChatSessionService';
import { AppError } from '../middleware/errorHandler';

export class ChatSessionController {
  private chatService: ChatSessionService;

  constructor() {
    this.chatService = new ChatSessionService();
  }

  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================

  /**
   * Create a new chat session
   * POST /chat/sessions
   */
  createSession = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw new AppError('Unauthorized', 401);
      }

      const { title, context } = req.body;
      const session = await this.chatService.createSession({
        userId: req.user.userId,
        title,
        context,
      });

      res.status(201).json({
        success: true,
        message: 'Chat session created',
        data: { session },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get all sessions for authenticated user
   * GET /chat/sessions
   */
  getSessions = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw new AppError('Unauthorized', 401);
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as 'active' | 'closed' | 'archived' | undefined;

      const result = await this.chatService.getUserSessions(
        req.user.userId,
        page,
        limit,
        status
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get session by session ID
   * GET /chat/sessions/:sessionId
   */
  getSession = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw new AppError('Unauthorized', 401);
      }

      const session = await this.chatService.getSession(
        req.params.sessionId,
        req.user.userId
      );

      res.status(200).json({
        success: true,
        data: { session },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete session
   * DELETE /chat/sessions/:sessionId
   */
  deleteSession = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw new AppError('Unauthorized', 401);
      }

      await this.chatService.deleteSession(req.params.sessionId, req.user.userId);

      res.status(200).json({
        success: true,
        message: 'Chat session deleted',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get recent sessions
   * GET /chat/sessions/recent
   */
  getRecentSessions = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw new AppError('Unauthorized', 401);
      }

      const limit = parseInt(req.query.limit as string) || 5;
      const sessions = await this.chatService.getRecentSessions(req.user.userId, limit);

      res.status(200).json({
        success: true,
        data: { sessions },
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // CHAT OPERATIONS
  // ============================================================================

  /**
   * Send a message and get AI response
   * POST /chat/sessions/:sessionId/messages
   */
  sendMessage = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw new AppError('Unauthorized', 401);
      }

      const { message, context } = req.body;
      if (!message || message.trim().length === 0) {
        throw new AppError('Message is required', 400);
      }

      const result = await this.chatService.sendMessage(
        req.params.sessionId,
        req.user.userId,
        message,
        context
      );

      res.status(200).json({
        success: true,
        data: {
          sessionId: result.session.sessionId,
          response: result.response,
          intent: result.intent,
          itinerary: result.itinerary,
          constraints: result.constraints,
          metadata: result.metadata,
          messageCount: result.session.messageCount,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Quick chat (auto-creates session if needed)
   * POST /chat/quick
   */
  quickChat = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw new AppError('Unauthorized', 401);
      }

      const { message, sessionId, context } = req.body;
      if (!message || message.trim().length === 0) {
        throw new AppError('Message is required', 400);
      }

      // Get or create session
      const session = await this.chatService.getOrCreateSession(
        req.user.userId,
        sessionId,
        context
      );

      const result = await this.chatService.sendMessage(
        session.sessionId,
        req.user.userId,
        message,
        context
      );

      res.status(200).json({
        success: true,
        data: {
          sessionId: result.session.sessionId,
          response: result.response,
          intent: result.intent,
          itinerary: result.itinerary,
          constraints: result.constraints,
          metadata: result.metadata,
          messageCount: result.session.messageCount,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get chat history
   * GET /chat/sessions/:sessionId/messages
   */
  getMessages = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw new AppError('Unauthorized', 401);
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const messages = await this.chatService.getChatHistory(
        req.params.sessionId,
        req.user.userId,
        limit,
        offset
      );

      res.status(200).json({
        success: true,
        data: { messages },
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // SESSION STATUS OPERATIONS
  // ============================================================================

  /**
   * Close session
   * POST /chat/sessions/:sessionId/close
   */
  closeSession = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw new AppError('Unauthorized', 401);
      }

      const session = await this.chatService.closeSession(
        req.params.sessionId,
        req.user.userId
      );

      res.status(200).json({
        success: true,
        message: 'Chat session closed',
        data: { session },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Archive session
   * POST /chat/sessions/:sessionId/archive
   */
  archiveSession = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw new AppError('Unauthorized', 401);
      }

      const session = await this.chatService.archiveSession(
        req.params.sessionId,
        req.user.userId
      );

      res.status(200).json({
        success: true,
        message: 'Chat session archived',
        data: { session },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Reopen session
   * POST /chat/sessions/:sessionId/reopen
   */
  reopenSession = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw new AppError('Unauthorized', 401);
      }

      const session = await this.chatService.reopenSession(
        req.params.sessionId,
        req.user.userId
      );

      res.status(200).json({
        success: true,
        message: 'Chat session reopened',
        data: { session },
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // CONTEXT & TITLE OPERATIONS
  // ============================================================================

  /**
   * Update session context
   * PATCH /chat/sessions/:sessionId/context
   */
  updateContext = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw new AppError('Unauthorized', 401);
      }

      const session = await this.chatService.updateContext(
        req.params.sessionId,
        req.user.userId,
        req.body
      );

      res.status(200).json({
        success: true,
        message: 'Context updated',
        data: { session },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Set current location
   * PATCH /chat/sessions/:sessionId/location
   */
  setLocation = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw new AppError('Unauthorized', 401);
      }

      const { latitude, longitude } = req.body;
      const session = await this.chatService.setLocation(
        req.params.sessionId,
        req.user.userId,
        latitude,
        longitude
      );

      res.status(200).json({
        success: true,
        message: 'Location set',
        data: { session },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update session title
   * PATCH /chat/sessions/:sessionId/title
   */
  updateTitle = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw new AppError('Unauthorized', 401);
      }

      const { title } = req.body;
      const session = await this.chatService.updateTitle(
        req.params.sessionId,
        req.user.userId,
        title
      );

      res.status(200).json({
        success: true,
        message: 'Title updated',
        data: { session },
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // TRIP LINKING OPERATIONS
  // ============================================================================

  /**
   * Link session to trip
   * POST /chat/sessions/:sessionId/link-trip
   */
  linkToTrip = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw new AppError('Unauthorized', 401);
      }

      const { tripId } = req.body;
      const session = await this.chatService.linkToTrip(
        req.params.sessionId,
        req.user.userId,
        tripId
      );

      res.status(200).json({
        success: true,
        message: 'Session linked to trip',
        data: { session },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Unlink session from trip
   * DELETE /chat/sessions/:sessionId/link-trip
   */
  unlinkFromTrip = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw new AppError('Unauthorized', 401);
      }

      const session = await this.chatService.unlinkFromTrip(
        req.params.sessionId,
        req.user.userId
      );

      res.status(200).json({
        success: true,
        message: 'Session unlinked from trip',
        data: { session },
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // SEARCH OPERATIONS
  // ============================================================================

  /**
   * Search sessions
   * GET /chat/sessions/search
   */
  searchSessions = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw new AppError('Unauthorized', 401);
      }

      const { q, limit } = req.query;
      if (!q) {
        throw new AppError('Search query is required', 400);
      }

      const sessions = await this.chatService.searchSessions(
        req.user.userId,
        q as string,
        parseInt(limit as string) || 10
      );

      res.status(200).json({
        success: true,
        data: { sessions },
      });
    } catch (error) {
      next(error);
    }
  };
}
