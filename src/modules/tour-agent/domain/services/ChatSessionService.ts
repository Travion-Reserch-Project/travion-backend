/**
 * Chat Session Service
 * Manages user chat sessions and message history.
 * Integrates with the AI Engine for RAG-based location chat.
 */

import { logger } from '../../../../shared/config/logger';
import { httpClient } from '../../../../shared/utils/httpClient';
import { aiEngineConfig } from '../../../../shared/config/aiEngine';

// ---------------------------------------------------------------------------
// In-memory session store
// ---------------------------------------------------------------------------

interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface SessionRecord {
  sessionId: string;
  userId: string;
  title: string;
  context: Record<string, any>;
  status: 'active' | 'closed' | 'archived';
  messages: StoredMessage[];
  createdAt: Date;
  updatedAt: Date;
}

// Keyed by sessionId
const sessionStore: Map<string, SessionRecord> = new Map();

// Keyed by `${userId}::${locationName}` → sessionId
const locationSessionIndex: Map<string, string> = new Map();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function makeMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function locationKey(userId: string, locationName: string): string {
  return `${userId}::${locationName}`;
}

function sessionSummary(session: SessionRecord) {
  return {
    sessionId: session.sessionId,
    userId: session.userId,
    title: session.title,
    context: session.context,
    status: session.status,
    messageCount: session.messages.length,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

// ---------------------------------------------------------------------------

export class ChatSessionService {
  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================

  async createSession(userId: string, sessionData?: any): Promise<any> {
    const sessionId = makeSessionId();
    const record: SessionRecord = {
      sessionId,
      userId,
      title: sessionData?.title || 'New Chat Session',
      context: sessionData?.context || {},
      status: 'active',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    sessionStore.set(sessionId, record);
    return sessionSummary(record);
  }

  async getUserSessions(
    userId: string,
    page: number,
    limit: number,
    status?: string
  ): Promise<any> {
    const all = Array.from(sessionStore.values())
      .filter(s => s.userId === userId && (!status || s.status === status))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    const total = all.length;
    const start = (page - 1) * limit;
    const sessions = all.slice(start, start + limit).map(sessionSummary);

    return {
      sessions,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async getSession(sessionId: string, userId: string): Promise<any> {
    const session = sessionStore.get(sessionId);
    if (!session || session.userId !== userId) {
      return {
        sessionId,
        userId,
        title: 'Chat Session',
        status: 'active',
        messageCount: 0,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    return { ...sessionSummary(session), messages: session.messages };
  }

  async deleteSession(sessionId: string, userId: string): Promise<void> {
    const session = sessionStore.get(sessionId);
    if (session && session.userId === userId) {
      sessionStore.delete(sessionId);
      for (const [key, sid] of locationSessionIndex.entries()) {
        if (sid === sessionId) locationSessionIndex.delete(key);
      }
    }
  }

  async getRecentSessions(userId: string, limit: number = 5): Promise<any> {
    return Array.from(sessionStore.values())
      .filter(s => s.userId === userId && s.status === 'active')
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit)
      .map(sessionSummary);
  }

  // ============================================================================
  // CHAT OPERATIONS
  // ============================================================================

  async sendMessage(
    sessionId: string,
    userId: string,
    message: string,
    context?: any
  ): Promise<any> {
    let session = sessionStore.get(sessionId);
    if (!session) {
      const created = await this.createSession(userId, {
        title: message.slice(0, 60),
        context,
      });
      session = sessionStore.get(created.sessionId)!;
    }

    const userMsg: StoredMessage = {
      id: makeMessageId(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    session.messages.push(userMsg);

    let aiResponse = "I couldn't generate a response.";
    let aiMetadata: Record<string, any> = {};
    let aiIntent: string | null = null;

    try {
      const result = await httpClient.postWithLongTimeout<any>(
        '/api/v1/chat',
        {
          message,
          thread_id: sessionId,
          user_id: userId,
        },
        120000
      );

      aiResponse = result?.response || result?.final_response || aiResponse;
      aiIntent = result?.intent || null;
      aiMetadata = result?.metadata || {};
    } catch (err) {
      logger.error('ChatSessionService.sendMessage — AI Engine error:', err);
      aiResponse = "Sorry, I'm having trouble connecting to the AI service. Please try again.";
    }

    const assistantMsg: StoredMessage = {
      id: makeMessageId(),
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date().toISOString(),
      metadata: aiMetadata,
    };
    session.messages.push(assistantMsg);
    session.updatedAt = new Date();

    return {
      session: sessionSummary(session),
      response: aiResponse,
      intent: aiIntent,
      itinerary: null,
      constraints: null,
      metadata: aiMetadata,
    };
  }

  async getOrCreateSession(userId: string, sessionId?: string, context?: any): Promise<any> {
    if (sessionId) {
      const existing = sessionStore.get(sessionId);
      if (existing && existing.userId === userId) return sessionSummary(existing);
    }
    return this.createSession(userId, { context });
  }

  async getMessages(sessionId: string, userId: string): Promise<any> {
    return this.getChatHistory(sessionId, userId);
  }

  async getChatHistory(
    sessionId: string,
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<any> {
    const session = sessionStore.get(sessionId);
    if (!session || session.userId !== userId) return [];
    return session.messages
      .slice(offset, offset + limit)
      .map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        metadata: m.metadata,
      }));
  }

  // ============================================================================
  // SESSION STATUS OPERATIONS
  // ============================================================================

  async closeSession(sessionId: string, userId: string): Promise<any> {
    const session = sessionStore.get(sessionId);
    if (session && session.userId === userId) {
      session.status = 'closed';
      session.updatedAt = new Date();
    }
    return { sessionId, userId, status: 'closed', updatedAt: new Date() };
  }

  async archiveSession(sessionId: string, userId: string): Promise<any> {
    const session = sessionStore.get(sessionId);
    if (session && session.userId === userId) {
      session.status = 'archived';
      session.updatedAt = new Date();
    }
    return { sessionId, userId, status: 'archived', updatedAt: new Date() };
  }

  async reopenSession(sessionId: string, userId: string): Promise<any> {
    const session = sessionStore.get(sessionId);
    if (session && session.userId === userId) {
      session.status = 'active';
      session.updatedAt = new Date();
    }
    return { sessionId, userId, status: 'active', updatedAt: new Date() };
  }

  // ============================================================================
  // CONTEXT & TITLE OPERATIONS
  // ============================================================================

  async updateContext(sessionId: string, userId: string, context: any): Promise<any> {
    const session = sessionStore.get(sessionId);
    if (session && session.userId === userId) {
      session.context = { ...session.context, ...context };
      session.updatedAt = new Date();
    }
    return { sessionId, userId, context, updatedAt: new Date() };
  }

  async setLocation(
    sessionId: string,
    userId: string,
    latitude: number,
    longitude: number
  ): Promise<any> {
    return this.updateContext(sessionId, userId, {
      location: { latitude, longitude },
    });
  }

  async updateTitle(sessionId: string, userId: string, title: string): Promise<any> {
    const session = sessionStore.get(sessionId);
    if (session && session.userId === userId) {
      session.title = title;
      session.updatedAt = new Date();
    }
    return { sessionId, userId, title, updatedAt: new Date() };
  }

  // ============================================================================
  // TRIP LINKING OPERATIONS
  // ============================================================================

  async linkToTrip(sessionId: string, userId: string, tripId: string): Promise<any> {
    return this.updateContext(sessionId, userId, { linkedTripId: tripId });
  }

  async unlinkFromTrip(sessionId: string, userId: string): Promise<any> {
    return this.updateContext(sessionId, userId, { linkedTripId: null });
  }

  // ============================================================================
  // SEARCH OPERATIONS
  // ============================================================================

  async searchSessions(userId: string, query: string, limit: number = 10): Promise<any> {
    const q = query.toLowerCase();
    return Array.from(sessionStore.values())
      .filter(s => s.userId === userId && s.title.toLowerCase().includes(q))
      .slice(0, limit)
      .map(sessionSummary);
  }

  // ============================================================================
  // LOCATION-SPECIFIC CHAT OPERATIONS
  // ============================================================================

  /**
   * Send a location-focused message through the AI Engine RAG pipeline.
   * Routes to /api/v1/chat/location on the AI Engine, which performs:
   *   1. Intent routing
   *   2. RAG retrieval from ChromaDB (location-filtered)
   *   3. Relevance grading
   *   4. Web search fallback if knowledge base is insufficient
   *   5. Response generation with verification loop
   * Full multi-turn session history is maintained in memory.
   */
  async sendLocationMessage(userId: string, locationName: string, message: string): Promise<any> {
    const key = locationKey(userId, locationName);

    // Get or create a persistent session for this user+location pair
    let sessionId = locationSessionIndex.get(key);
    let session = sessionId ? sessionStore.get(sessionId) : undefined;

    if (!session) {
      const created = await this.createSession(userId, {
        title: locationName,
        context: { locationName },
      });
      session = sessionStore.get(created.sessionId)!;
      sessionId = session.sessionId;
      locationSessionIndex.set(key, sessionId);
    }

    // Store incoming user message
    const userMsg: StoredMessage = {
      id: makeMessageId(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    session.messages.push(userMsg);

    let aiResponse = `I'm having trouble answering your question about ${locationName} right now. Please try again. 🙏`;
    let aiMetadata: Record<string, any> = {};
    let aiIntent: string | null = null;

    try {
      // Build conversation history (exclude current user message)
      const conversationHistory = session.messages
        .slice(0, -1) // skip the message we just pushed
        .slice(-10)   // keep last 10 turns for context
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      // Call AI Engine location chat endpoint (full RAG + web search pipeline)
      const result = await httpClient.postWithLongTimeout<any>(
        aiEngineConfig.endpoints.locationChat,
        {
          message,
          location_name: locationName,
          thread_id: sessionId,
          user_id: userId,
          conversation_history: conversationHistory.length > 0 ? conversationHistory : undefined,
        },
        120000
      );

      aiResponse = result?.response || result?.final_response || aiResponse;
      aiIntent = result?.intent || null;
      aiMetadata = result?.metadata || {};

      logger.info(
        `LocationChat [${locationName}] — intent=${aiIntent}, ` +
        `docs=${aiMetadata.documents_retrieved ?? 0}, ` +
        `web=${aiMetadata.web_search_used ?? false}, ` +
        `loops=${aiMetadata.reasoning_loops ?? 0}`
      );
    } catch (err) {
      logger.error(
        `ChatSessionService.sendLocationMessage — AI Engine failed for "${locationName}":`,
        err
      );
    }

    // Store assistant response
    const assistantMsg: StoredMessage = {
      id: makeMessageId(),
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date().toISOString(),
      metadata: aiMetadata,
    };
    session.messages.push(assistantMsg);
    session.updatedAt = new Date();

    return {
      session: {
        sessionId: session.sessionId,
        userId: session.userId,
        messageCount: session.messages.length,
        context: session.context,
      },
      response: aiResponse,
      intent: aiIntent,
      metadata: {
        reasoning_loops: aiMetadata.reasoning_loops ?? 0,
        documents_retrieved: aiMetadata.documents_retrieved ?? 0,
        web_search_used: aiMetadata.web_search_used ?? false,
        target_location: locationName,
      },
    };
  }

  /**
   * Return an existing session for this user+location, or null if none exists yet.
   */
  async getLocationSession(userId: string, locationName: string): Promise<any> {
    const key = locationKey(userId, locationName);
    const sessionId = locationSessionIndex.get(key);
    if (!sessionId) return null;

    const session = sessionStore.get(sessionId);
    if (!session || session.userId !== userId) return null;

    return sessionSummary(session);
  }

  // ============================================================================
  // MESSAGE OPERATIONS
  // ============================================================================

  async clearMessages(sessionId: string, userId: string): Promise<any> {
    const session = sessionStore.get(sessionId);
    if (session && session.userId === userId) {
      session.messages = [];
      session.updatedAt = new Date();
    }
    return {
      sessionId,
      userId,
      messageCount: 0,
      messages: [],
      updatedAt: new Date(),
    };
  }
}
