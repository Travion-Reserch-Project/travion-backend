/**
 * ChatSession Controller
 * HTTP request handlers for chat session endpoints
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../../../shared/middleware/auth';
import { ChatSessionService } from '../../domain/services/ChatSessionService';
import { AppError } from '../../../../shared/middleware/errorHandler';
import { aiEngineConfig } from '../../../../shared/config/aiEngine';
import { logger } from '../../../../shared/config/logger';
import { uploadImageToImageKit } from '../../../../shared/utils/imageKitService';

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
      const session = await this.chatService.createSession(req.user.userId, {
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

      const result = await this.chatService.getUserSessions(req.user.userId, page, limit, status);

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

      const session = await this.chatService.getSession(req.params.sessionId, req.user.userId);

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
  getRecentSessions = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
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

      const { message, imageBase64 } = req.body;
      if (!message || message.trim().length === 0) {
        throw new AppError('Message is required', 400);
      }

      const result = await this.chatService.sendMessage(
        req.params.sessionId,
        req.user.userId,
        message,
        undefined,
        imageBase64
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
          imageResults: result.imageResults,
          imageValidationMessage: result.imageValidationMessage,
          userImageUrl: result.userImageUrl || null,
          // Tour-planning artifacts surfaced from the AI Engine so the
          // chat screen can render clarification questions, HITL cards,
          // the final tour plan card, weather prompts, and live progress.
          clarificationQuestion: result.clarificationQuestion ?? null,
          culturalTips: result.culturalTips ?? null,
          finalItinerary: result.finalItinerary ?? null,
          pendingUserSelection: result.pendingUserSelection ?? null,
          selectionCards: result.selectionCards ?? null,
          promptText: result.promptText ?? null,
          weatherInterrupt: result.weatherInterrupt ?? null,
          weatherPromptMessage: result.weatherPromptMessage ?? null,
          weatherPromptOptions: result.weatherPromptOptions ?? null,
          stepResults: result.stepResults ?? null,
          threadId: result.session.sessionId,
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

      const { message, sessionId, context, imageBase64 } = req.body;
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
        undefined,
        imageBase64
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
          imageResults: result.imageResults,
          imageValidationMessage: result.imageValidationMessage,
          userImageUrl: result.userImageUrl || null,
          // Tour-planning artifacts surfaced from the AI Engine so the
          // chat screen can render clarification questions, HITL cards,
          // the final tour plan card, weather prompts, and live progress.
          clarificationQuestion: result.clarificationQuestion ?? null,
          culturalTips: result.culturalTips ?? null,
          finalItinerary: result.finalItinerary ?? null,
          pendingUserSelection: result.pendingUserSelection ?? null,
          selectionCards: result.selectionCards ?? null,
          promptText: result.promptText ?? null,
          weatherInterrupt: result.weatherInterrupt ?? null,
          weatherPromptMessage: result.weatherPromptMessage ?? null,
          weatherPromptOptions: result.weatherPromptOptions ?? null,
          stepResults: result.stepResults ?? null,
          threadId: result.session.sessionId,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Stream chat response via Server-Sent Events.
   * POST /chat/sessions/:sessionId/messages/stream
   * Proxies the AI engine's /chat/stream endpoint and forwards step events
   * to the mobile client. After completion, persists the user message and
   * assistant response on the chat session.
   */
  streamMessage = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw new AppError('Unauthorized', 401);
      }

      const sessionId = req.params.sessionId;
      const { message, imageBase64 } = req.body;
      if (!message || message.trim().length === 0) {
        throw new AppError('Message is required', 400);
      }

      // Set up SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();

      // Upload image first (if provided) so the user message has the CDN URL
      let uploadedImageUrl: string | null = null;
      if (imageBase64) {
        try {
          uploadedImageUrl = await uploadImageToImageKit(imageBase64);
        } catch (e) {
          logger.warn('streamMessage: imageKit upload failed', e);
        }
      }

      // Persist the user message immediately
      await this.chatService.appendUserMessage?.(sessionId, req.user.userId, message, uploadedImageUrl);

      // Open SSE connection to AI engine
      const aiUrl = `${aiEngineConfig.baseUrl}/api/v1/chat/stream`;
      const aiBody = {
        message,
        thread_id: sessionId,
        user_id: req.user.userId,
        ...(imageBase64 ? { image_base64: imageBase64 } : {}),
      };

      const aiResp = await fetch(aiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify(aiBody),
      });

      if (!aiResp.ok || !aiResp.body) {
        res.write(
          `data: ${JSON.stringify({ type: 'error', error: `AI engine returned ${aiResp.status}` })}\n\n`
        );
        res.end();
        return;
      }

      // Stream chunks through, capturing the final 'complete' frame so we
      // can persist the assistant message into the chat session.
      const decoder = new TextDecoder();
      const reader = (aiResp.body as any).getReader();
      let buffer = '';
      let lastComplete: any = null;

      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          // Forward raw bytes to the client so the SSE framing is preserved
          res.write(chunk);

          // Parse complete events out of the buffer to track the final frame
          const frames = buffer.split('\n\n');
          buffer = frames.pop() || '';
          for (const frame of frames) {
            const dataLine = frame
              .split('\n')
              .find(l => l.startsWith('data: '));
            if (!dataLine) continue;
            try {
              const payload = JSON.parse(dataLine.slice(6));
              if (payload?.type === 'complete') {
                lastComplete = payload.result;
              }
            } catch {}
          }
        }
      } catch (err) {
        logger.error('streamMessage: stream reading error', err);
      } finally {
        try { reader.releaseLock?.(); } catch {}
      }

      // After streaming finishes, persist the assistant message
      if (lastComplete) {
        await this.chatService.appendAssistantMessageFromStream?.(
          sessionId,
          req.user.userId,
          lastComplete
        );
      }

      res.end();
    } catch (error) {
      next(error);
    }
  };

  /**
   * Resume a paused planning agent after the user picks a HITL selection card.
   * POST /chat/sessions/:sessionId/resume-selection
   */
  resumeSelection = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw new AppError('Unauthorized', 401);
      }
      const { selectedCandidateId, label } = req.body;
      if (!selectedCandidateId) {
        throw new AppError('selectedCandidateId is required', 400);
      }

      const result = await this.chatService.resumeSelection(
        req.params.sessionId,
        req.user.userId,
        selectedCandidateId,
        label
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
          imageResults: result.imageResults,
          imageValidationMessage: result.imageValidationMessage,
          userImageUrl: result.userImageUrl || null,
          clarificationQuestion: result.clarificationQuestion ?? null,
          culturalTips: result.culturalTips ?? null,
          finalItinerary: result.finalItinerary ?? null,
          pendingUserSelection: result.pendingUserSelection ?? null,
          selectionCards: result.selectionCards ?? null,
          promptText: result.promptText ?? null,
          weatherInterrupt: result.weatherInterrupt ?? null,
          weatherPromptMessage: result.weatherPromptMessage ?? null,
          weatherPromptOptions: result.weatherPromptOptions ?? null,
          stepResults: result.stepResults ?? null,
          threadId: result.session.sessionId,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Resume a paused planning agent after the user makes a weather decision.
   * POST /chat/sessions/:sessionId/resume-weather
   */
  resumeWeather = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw new AppError('Unauthorized', 401);
      }
      const { choice } = req.body;
      if (!choice || !['switch_indoor', 'reschedule', 'keep'].includes(choice)) {
        throw new AppError(
          "choice must be one of 'switch_indoor', 'reschedule', or 'keep'",
          400
        );
      }

      const result = await this.chatService.resumeWeather(
        req.params.sessionId,
        req.user.userId,
        choice
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
          imageResults: result.imageResults,
          imageValidationMessage: result.imageValidationMessage,
          userImageUrl: result.userImageUrl || null,
          clarificationQuestion: result.clarificationQuestion ?? null,
          culturalTips: result.culturalTips ?? null,
          finalItinerary: result.finalItinerary ?? null,
          pendingUserSelection: result.pendingUserSelection ?? null,
          selectionCards: result.selectionCards ?? null,
          promptText: result.promptText ?? null,
          weatherInterrupt: result.weatherInterrupt ?? null,
          weatherPromptMessage: result.weatherPromptMessage ?? null,
          weatherPromptOptions: result.weatherPromptOptions ?? null,
          stepResults: result.stepResults ?? null,
          threadId: result.session.sessionId,
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

      const session = await this.chatService.closeSession(req.params.sessionId, req.user.userId);

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

      const session = await this.chatService.archiveSession(req.params.sessionId, req.user.userId);

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

      const session = await this.chatService.reopenSession(req.params.sessionId, req.user.userId);

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

      const session = await this.chatService.unlinkFromTrip(req.params.sessionId, req.user.userId);

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

  // ============================================================================
  // LOCATION-SPECIFIC CHAT OPERATIONS
  // ============================================================================

  /**
   * Location-specific chat
   * POST /chat/location
   */
  locationChat = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw new AppError('Unauthorized', 401);
      }

      const { locationName, message } = req.body;
      if (!locationName || locationName.trim().length === 0) {
        throw new AppError('Location name is required', 400);
      }
      if (!message || message.trim().length === 0) {
        throw new AppError('Message is required', 400);
      }

      const result = await this.chatService.sendLocationMessage(
        req.user.userId,
        locationName.trim(),
        message
      );

      res.status(200).json({
        success: true,
        data: {
          sessionId: result.session.sessionId,
          locationName: result.session.context.locationName,
          response: result.response,
          intent: result.intent,
          metadata: result.metadata,
          messageCount: result.session.messageCount,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get location session
   * GET /chat/location/:locationName
   */
  getLocationSession = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw new AppError('Unauthorized', 401);
      }

      const locationName = decodeURIComponent(req.params.locationName);
      const session = await this.chatService.getLocationSession(req.user.userId, locationName);

      res.status(200).json({
        success: true,
        data: {
          session,
          hasSession: !!session,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Clear messages from a session
   * DELETE /chat/sessions/:sessionId/messages
   */
  clearMessages = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw new AppError('Unauthorized', 401);
      }

      const session = await this.chatService.clearMessages(req.params.sessionId, req.user.userId);

      res.status(200).json({
        success: true,
        message: 'Messages cleared',
        data: { session },
      });
    } catch (error) {
      next(error);
    }
  };
}
