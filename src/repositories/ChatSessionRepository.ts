/**
 * ChatSession Repository
 * Data access layer for chat sessions and conversation history
 */

import mongoose from 'mongoose';
import {
  ChatSession,
  IChatSession,
  IChatMessage,
  ISessionContext,
} from '../models/ChatSession';

export interface CreateSessionData {
  userId: string;
  sessionId?: string;
  title?: string;
  context?: ISessionContext;
}

export class ChatSessionRepository {
  // ============================================================================
  // CORE CRUD OPERATIONS
  // ============================================================================

  /**
   * Create a new chat session
   */
  async create(data: CreateSessionData): Promise<IChatSession> {
    const sessionId = data.sessionId || this.generateSessionId();
    const session = new ChatSession({
      userId: new mongoose.Types.ObjectId(data.userId),
      sessionId,
      title: data.title,
      context: data.context || {},
      messages: [],
      status: 'active',
    });
    return await session.save();
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 10);
    return `chat_${timestamp}_${randomPart}`;
  }

  /**
   * Find session by session ID
   */
  async findBySessionId(sessionId: string): Promise<IChatSession | null> {
    return await ChatSession.findOne({ sessionId });
  }

  /**
   * Find session by session ID and user ID (ownership check)
   */
  async findBySessionIdAndUser(
    sessionId: string,
    userId: string
  ): Promise<IChatSession | null> {
    return await ChatSession.findOne({
      sessionId,
      userId: new mongoose.Types.ObjectId(userId),
    });
  }

  /**
   * Find session by MongoDB ID
   */
  async findById(id: string): Promise<IChatSession | null> {
    return await ChatSession.findById(id);
  }

  /**
   * Find all sessions for a user with pagination
   */
  async findByUserId(
    userId: string,
    page: number = 1,
    limit: number = 20,
    status?: 'active' | 'closed' | 'archived'
  ): Promise<{ sessions: IChatSession[]; total: number; pages: number }> {
    const query: Record<string, unknown> = {
      userId: new mongoose.Types.ObjectId(userId),
    };

    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;
    const [sessions, total] = await Promise.all([
      ChatSession.find(query)
        .select('sessionId title status messageCount lastActivity createdAt')
        .sort({ lastActivity: -1 })
        .skip(skip)
        .limit(limit),
      ChatSession.countDocuments(query),
    ]);

    return {
      sessions,
      total,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Delete a session
   */
  async delete(sessionId: string, userId: string): Promise<IChatSession | null> {
    return await ChatSession.findOneAndDelete({
      sessionId,
      userId: new mongoose.Types.ObjectId(userId),
    });
  }

  // ============================================================================
  // MESSAGE OPERATIONS
  // ============================================================================

  /**
   * Add a message to session
   */
  async addMessage(
    sessionId: string,
    userId: string,
    message: IChatMessage
  ): Promise<IChatSession | null> {
    return await ChatSession.findOneAndUpdate(
      {
        sessionId,
        userId: new mongoose.Types.ObjectId(userId),
      },
      {
        $push: { messages: { ...message, timestamp: new Date() } },
        $set: { lastActivity: new Date() },
        $inc: { messageCount: 1 },
      },
      { new: true }
    );
  }

  /**
   * Add multiple messages to session (for user + assistant pair)
   */
  async addMessages(
    sessionId: string,
    userId: string,
    messages: IChatMessage[]
  ): Promise<IChatSession | null> {
    const timestampedMessages = messages.map(msg => ({
      ...msg,
      timestamp: msg.timestamp || new Date(),
    }));

    return await ChatSession.findOneAndUpdate(
      {
        sessionId,
        userId: new mongoose.Types.ObjectId(userId),
      },
      {
        $push: { messages: { $each: timestampedMessages } },
        $set: { lastActivity: new Date() },
        $inc: { messageCount: messages.length },
      },
      { new: true }
    );
  }

  /**
   * Get messages with pagination (most recent first)
   */
  async getMessages(
    sessionId: string,
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<IChatMessage[]> {
    const session = await ChatSession.findOne({
      sessionId,
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (!session) return [];

    // Get messages in reverse chronological order
    const messages = session.messages
      .slice()
      .reverse()
      .slice(offset, offset + limit)
      .reverse();

    return messages;
  }

  /**
   * Get last N messages from session
   */
  async getLastMessages(
    sessionId: string,
    userId: string,
    count: number = 10
  ): Promise<IChatMessage[]> {
    const session = await ChatSession.findOne({
      sessionId,
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (!session) return [];

    return session.messages.slice(-count);
  }

  // ============================================================================
  // SESSION STATUS OPERATIONS
  // ============================================================================

  /**
   * Update session status
   */
  async updateStatus(
    sessionId: string,
    userId: string,
    status: 'active' | 'closed' | 'archived'
  ): Promise<IChatSession | null> {
    return await ChatSession.findOneAndUpdate(
      {
        sessionId,
        userId: new mongoose.Types.ObjectId(userId),
      },
      { $set: { status, lastActivity: new Date() } },
      { new: true }
    );
  }

  /**
   * Close a session
   */
  async closeSession(sessionId: string, userId: string): Promise<IChatSession | null> {
    return await this.updateStatus(sessionId, userId, 'closed');
  }

  /**
   * Archive a session
   */
  async archiveSession(sessionId: string, userId: string): Promise<IChatSession | null> {
    return await this.updateStatus(sessionId, userId, 'archived');
  }

  /**
   * Reopen a closed session
   */
  async reopenSession(sessionId: string, userId: string): Promise<IChatSession | null> {
    return await this.updateStatus(sessionId, userId, 'active');
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
  ): Promise<IChatSession | null> {
    const updateObj: Record<string, unknown> = {};

    Object.entries(context).forEach(([key, value]) => {
      if (value !== undefined) {
        updateObj[`context.${key}`] = value;
      }
    });

    return await ChatSession.findOneAndUpdate(
      {
        sessionId,
        userId: new mongoose.Types.ObjectId(userId),
      },
      { $set: updateObj },
      { new: true }
    );
  }

  /**
   * Set current location in context
   */
  async setCurrentLocation(
    sessionId: string,
    userId: string,
    latitude: number,
    longitude: number
  ): Promise<IChatSession | null> {
    return await ChatSession.findOneAndUpdate(
      {
        sessionId,
        userId: new mongoose.Types.ObjectId(userId),
      },
      {
        $set: {
          'context.currentLocation': { latitude, longitude },
          lastActivity: new Date(),
        },
      },
      { new: true }
    );
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
  ): Promise<IChatSession | null> {
    return await ChatSession.findOneAndUpdate(
      {
        sessionId,
        userId: new mongoose.Types.ObjectId(userId),
      },
      { $set: { title } },
      { new: true }
    );
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
  ): Promise<IChatSession | null> {
    return await ChatSession.findOneAndUpdate(
      {
        sessionId,
        userId: new mongoose.Types.ObjectId(userId),
      },
      { $set: { linkedTripId: new mongoose.Types.ObjectId(tripId) } },
      { new: true }
    );
  }

  /**
   * Unlink session from trip
   */
  async unlinkFromTrip(
    sessionId: string,
    userId: string
  ): Promise<IChatSession | null> {
    return await ChatSession.findOneAndUpdate(
      {
        sessionId,
        userId: new mongoose.Types.ObjectId(userId),
      },
      { $unset: { linkedTripId: 1 } },
      { new: true }
    );
  }

  // ============================================================================
  // UTILITY OPERATIONS
  // ============================================================================

  /**
   * Get or create session (useful for thread-based conversations)
   */
  async findOrCreate(
    userId: string,
    sessionId?: string,
    context?: ISessionContext
  ): Promise<IChatSession> {
    if (sessionId) {
      const existing = await this.findBySessionIdAndUser(sessionId, userId);
      if (existing) return existing;
    }

    return await this.create({
      userId,
      sessionId,
      context,
    });
  }

  /**
   * Count sessions for a user
   */
  async countByUser(userId: string, status?: string): Promise<number> {
    const query: Record<string, unknown> = {
      userId: new mongoose.Types.ObjectId(userId),
    };
    if (status) query.status = status;

    return await ChatSession.countDocuments(query);
  }

  /**
   * Get recent active sessions
   */
  async getRecentSessions(
    userId: string,
    limit: number = 5
  ): Promise<IChatSession[]> {
    return await ChatSession.find({
      userId: new mongoose.Types.ObjectId(userId),
      status: 'active',
    })
      .select('sessionId title messageCount lastActivity')
      .sort({ lastActivity: -1 })
      .limit(limit);
  }

  /**
   * Search sessions by title or message content
   */
  async search(
    userId: string,
    searchTerm: string,
    limit: number = 10
  ): Promise<IChatSession[]> {
    const regex = new RegExp(searchTerm, 'i');
    return await ChatSession.find({
      userId: new mongoose.Types.ObjectId(userId),
      $or: [
        { title: regex },
        { 'messages.content': regex },
      ],
    })
      .select('sessionId title status messageCount lastActivity')
      .limit(limit)
      .sort({ lastActivity: -1 });
  }

  /**
   * Delete old archived sessions (cleanup)
   */
  async deleteOldArchived(daysOld: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await ChatSession.deleteMany({
      status: 'archived',
      lastActivity: { $lt: cutoffDate },
    });

    return result.deletedCount;
  }
}
