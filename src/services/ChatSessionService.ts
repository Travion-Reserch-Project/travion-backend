/**
 * ChatSession Service
 * Business logic for chat session management and AI integration
 */

import { AppError } from '../middleware/errorHandler';
import { ChatSessionRepository, CreateSessionData } from '../repositories/ChatSessionRepository';
import { IChatSession, IChatMessage, ISessionContext } from '../models/ChatSession';
import { AIEngineService } from './AIEngineService';
import { UserPreferencesRepository } from '../repositories/UserPreferencesRepository';

export class ChatSessionService {
  private repository: ChatSessionRepository;
  private aiService: AIEngineService;
  private preferencesRepository: UserPreferencesRepository;

  constructor() {
    this.repository = new ChatSessionRepository();
    this.aiService = new AIEngineService();
    this.preferencesRepository = new UserPreferencesRepository();
  }

  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================

  /**
   * Create a new chat session
   */
  async createSession(data: CreateSessionData): Promise<IChatSession> {
    // Load user preferences for context
    const preferences = await this.preferencesRepository.findByUserId(data.userId);
    const context: ISessionContext = {
      ...data.context,
      preferences: preferences?.preferenceScores,
    };

    return await this.repository.create({
      ...data,
      context,
    });
  }

  /**
   * Get session by session ID
   */
  async getSession(sessionId: string, userId: string): Promise<IChatSession> {
    const session = await this.repository.findBySessionIdAndUser(sessionId, userId);
    if (!session) {
      throw new AppError('Chat session not found', 404);
    }
    return session;
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(
    userId: string,
    page: number = 1,
    limit: number = 20,
    status?: 'active' | 'closed' | 'archived'
  ): Promise<{ sessions: IChatSession[]; total: number; pages: number; page: number }> {
    const result = await this.repository.findByUserId(userId, page, limit, status);
    return { ...result, page };
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string, userId: string): Promise<void> {
    const session = await this.repository.delete(sessionId, userId);
    if (!session) {
      throw new AppError('Chat session not found', 404);
    }
  }

  /**
   * Get or create session (for seamless conversation continuation)
   */
  async getOrCreateSession(
    userId: string,
    sessionId?: string,
    context?: ISessionContext
  ): Promise<IChatSession> {
    return await this.repository.findOrCreate(userId, sessionId, context);
  }

  // ============================================================================
  // CHAT OPERATIONS
  // ============================================================================

  /**
   * Send a message and get AI response
   */
  async sendMessage(
    sessionId: string,
    userId: string,
    message: string,
    context?: Partial<ISessionContext>
  ): Promise<{
    session: IChatSession;
    response: string;
    intent?: string;
    itinerary?: unknown[];
    constraints?: unknown[];
    metadata?: unknown;
  }> {
    // Get or create session
    let session = await this.repository.findBySessionIdAndUser(sessionId, userId);
    if (!session) {
      session = await this.createSession({ userId, sessionId, context });
    }

    // Update context if provided
    if (context) {
      await this.repository.updateContext(sessionId, userId, context);
    }

    // Add user message
    const userMessage: IChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date(),
    };

    // Call AI Engine
    const aiResponse = await this.aiService.chat(
      message,
      sessionId,
      session.context
    );

    // Add assistant message with metadata
    // Map constraints from snake_case (AI Engine) to camelCase (our model)
    const mappedConstraints = aiResponse.constraints?.map(c => ({
      constraintType: c.constraint_type,
      description: c.description,
      severity: c.severity,
    }));

    const assistantMessage: IChatMessage = {
      role: 'assistant',
      content: aiResponse.response,
      timestamp: new Date(),
      metadata: {
        intent: aiResponse.intent,
        reasoningLoops: aiResponse.metadata?.reasoning_loops,
        documentsRetrieved: aiResponse.metadata?.documents_retrieved,
        webSearchUsed: aiResponse.metadata?.web_search_used,
        constraints: mappedConstraints,
      },
    };

    // Save both messages
    const updatedSession = await this.repository.addMessages(
      sessionId,
      userId,
      [userMessage, assistantMessage]
    );

    if (!updatedSession) {
      throw new AppError('Failed to save messages', 500);
    }

    return {
      session: updatedSession,
      response: aiResponse.response,
      intent: aiResponse.intent,
      itinerary: aiResponse.itinerary,
      constraints: aiResponse.constraints,
      metadata: aiResponse.metadata,
    };
  }

  /**
   * Get chat history with pagination
   */
  async getChatHistory(
    sessionId: string,
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<IChatMessage[]> {
    await this.getSession(sessionId, userId); // Verify ownership
    return await this.repository.getMessages(sessionId, userId, limit, offset);
  }

  /**
   * Get last N messages (for context summary)
   */
  async getLastMessages(
    sessionId: string,
    userId: string,
    count: number = 10
  ): Promise<IChatMessage[]> {
    await this.getSession(sessionId, userId); // Verify ownership
    return await this.repository.getLastMessages(sessionId, userId, count);
  }

  // ============================================================================
  // SESSION STATUS OPERATIONS
  // ============================================================================

  /**
   * Close a session
   */
  async closeSession(sessionId: string, userId: string): Promise<IChatSession> {
    const session = await this.repository.closeSession(sessionId, userId);
    if (!session) {
      throw new AppError('Chat session not found', 404);
    }
    return session;
  }

  /**
   * Archive a session
   */
  async archiveSession(sessionId: string, userId: string): Promise<IChatSession> {
    const session = await this.repository.archiveSession(sessionId, userId);
    if (!session) {
      throw new AppError('Chat session not found', 404);
    }
    return session;
  }

  /**
   * Reopen a closed session
   */
  async reopenSession(sessionId: string, userId: string): Promise<IChatSession> {
    const existingSession = await this.getSession(sessionId, userId);
    if (existingSession.status === 'active') {
      throw new AppError('Session is already active', 400);
    }

    const session = await this.repository.reopenSession(sessionId, userId);
    if (!session) {
      throw new AppError('Chat session not found', 404);
    }
    return session;
  }

  // ============================================================================
  // CONTEXT OPERATIONS
  // ============================================================================

  /**
   * Update session context
   */
  async updateContext(
    sessionId: string,
    userId: string,
    context: Partial<ISessionContext>
  ): Promise<IChatSession> {
    await this.getSession(sessionId, userId); // Verify ownership

    const session = await this.repository.updateContext(sessionId, userId, context);
    if (!session) {
      throw new AppError('Failed to update context', 500);
    }
    return session;
  }

  /**
   * Set current location
   */
  async setLocation(
    sessionId: string,
    userId: string,
    latitude: number,
    longitude: number
  ): Promise<IChatSession> {
    await this.getSession(sessionId, userId); // Verify ownership

    const session = await this.repository.setCurrentLocation(
      sessionId,
      userId,
      latitude,
      longitude
    );
    if (!session) {
      throw new AppError('Failed to set location', 500);
    }
    return session;
  }

  // ============================================================================
  // TITLE OPERATIONS
  // ============================================================================

  /**
   * Update session title
   */
  async updateTitle(
    sessionId: string,
    userId: string,
    title: string
  ): Promise<IChatSession> {
    if (!title || title.trim().length === 0) {
      throw new AppError('Title cannot be empty', 400);
    }

    const session = await this.repository.updateTitle(sessionId, userId, title.trim());
    if (!session) {
      throw new AppError('Chat session not found', 404);
    }
    return session;
  }

  // ============================================================================
  // TRIP LINKING OPERATIONS
  // ============================================================================

  /**
   * Link session to a saved trip
   */
  async linkToTrip(
    sessionId: string,
    userId: string,
    tripId: string
  ): Promise<IChatSession> {
    await this.getSession(sessionId, userId); // Verify ownership

    const session = await this.repository.linkToTrip(sessionId, userId, tripId);
    if (!session) {
      throw new AppError('Failed to link trip', 500);
    }
    return session;
  }

  /**
   * Unlink session from trip
   */
  async unlinkFromTrip(sessionId: string, userId: string): Promise<IChatSession> {
    await this.getSession(sessionId, userId); // Verify ownership

    const session = await this.repository.unlinkFromTrip(sessionId, userId);
    if (!session) {
      throw new AppError('Failed to unlink trip', 500);
    }
    return session;
  }

  // ============================================================================
  // UTILITY OPERATIONS
  // ============================================================================

  /**
   * Get recent active sessions
   */
  async getRecentSessions(userId: string, limit: number = 5): Promise<IChatSession[]> {
    return await this.repository.getRecentSessions(userId, limit);
  }

  /**
   * Search sessions
   */
  async searchSessions(
    userId: string,
    searchTerm: string,
    limit: number = 10
  ): Promise<IChatSession[]> {
    return await this.repository.search(userId, searchTerm, limit);
  }

  /**
   * Get session count for user
   */
  async getSessionCount(userId: string, status?: string): Promise<number> {
    return await this.repository.countByUser(userId, status);
  }

  /**
   * Cleanup old archived sessions
   */
  async cleanupOldSessions(daysOld: number = 90): Promise<number> {
    return await this.repository.deleteOldArchived(daysOld);
  }
}
