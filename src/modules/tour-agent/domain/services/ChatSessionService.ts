/**
 * Chat Session Service
 * Manages user chat sessions and message history.
 * Integrates with the AI Engine for RAG-based location chat.
 */

import { logger } from '../../../../shared/config/logger';
import { httpClient } from '../../../../shared/utils/httpClient';
import { aiEngineConfig } from '../../../../shared/config/aiEngine';
import { uploadImageToImageKit } from '../../../../shared/utils/imageKitService';
import { AIEngineService } from './AIEngineService';

const aiEngineService = new AIEngineService();

// ---------------------------------------------------------------------------
// In-memory session store
// ---------------------------------------------------------------------------

interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  imageUrl?: string;
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
    context?: any,
    imageBase64?: string
  ): Promise<any> {
    let session = sessionStore.get(sessionId);
    if (!session) {
      const created = await this.createSession(userId, {
        title: message.slice(0, 60),
        context,
      });
      session = sessionStore.get(created.sessionId)!;
    }

    // Upload image to ImageKit for a permanent CDN URL
    let uploadedImageUrl: string | null = null;
    if (imageBase64) {
      uploadedImageUrl = await uploadImageToImageKit(imageBase64);
    }

    const userMsg: StoredMessage = {
      id: makeMessageId(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
      ...(uploadedImageUrl ? { imageUrl: uploadedImageUrl } : {}),
    };
    session.messages.push(userMsg);

    let aiResponse = "I couldn't generate a response.";
    let aiMetadata: Record<string, any> = {};
    let aiIntent: string | null = null;
    let aiItinerary: any[] | null = null;
    let aiConstraints: any[] | null = null;
    // Tour-planning HITL/clarification artifacts surfaced by the AI Engine
    let clarificationQuestion: any = null;
    let culturalTips: any[] | null = null;
    let finalItinerary: any = null;
    let pendingUserSelection: boolean | null = null;
    let selectionCards: any[] | null = null;
    let promptText: string | null = null;
    let weatherInterrupt: boolean | null = null;
    let weatherPromptMessage: string | null = null;
    let weatherPromptOptions: any[] | null = null;
    let stepResults: any[] | null = null;

    try {
      const payload: Record<string, any> = {
        message,
        thread_id: sessionId,
        user_id: userId,
      };
      if (imageBase64) {
        payload.image_base64 = imageBase64;
      }

      const result = await httpClient.postWithLongTimeout<any>(
        '/api/v1/chat',
        payload,
        120000
      );

      aiResponse = result?.response || result?.final_response || aiResponse;
      aiIntent = result?.intent || null;
      aiMetadata = result?.metadata || {};
      aiItinerary = result?.itinerary || null;
      aiConstraints = result?.constraints || null;
      // Preserve image results from AI Engine
      if (result?.image_results) {
        aiMetadata.image_results = result.image_results;
      }
      if (result?.image_validation_message) {
        aiMetadata.image_validation_message = result.image_validation_message;
      }
      // Capture tour-planning artifacts (snake_case from AI engine → camelCase out)
      clarificationQuestion = result?.clarification_question ?? null;
      culturalTips = result?.cultural_tips ?? null;
      finalItinerary = result?.final_itinerary ?? null;
      pendingUserSelection = result?.pending_user_selection ?? null;
      selectionCards = result?.selection_cards ?? null;
      promptText = result?.prompt_text ?? null;
      weatherInterrupt = result?.weather_interrupt ?? null;
      weatherPromptMessage = result?.weather_prompt_message ?? null;
      weatherPromptOptions = result?.weather_prompt_options ?? null;
      stepResults = result?.step_results ?? null;
    } catch (err) {
      logger.error('ChatSessionService.sendMessage — AI Engine error:', err);
      aiResponse = "Sorry, I'm having trouble connecting to the AI service. Please try again.";
    }

    // Persist planning artifacts on the assistant message metadata so that
    // when the user reloads the session, the inline tour plan card / HITL
    // bubbles can be re-rendered from history without another agent call.
    const assistantMetadata: Record<string, any> = {
      ...aiMetadata,
      intent: aiIntent,
      itinerary: aiItinerary,
      constraints: aiConstraints,
      clarification_question: clarificationQuestion,
      cultural_tips: culturalTips,
      final_itinerary: finalItinerary,
      pending_user_selection: pendingUserSelection,
      selection_cards: selectionCards,
      prompt_text: promptText,
      weather_interrupt: weatherInterrupt,
      weather_prompt_message: weatherPromptMessage,
      weather_prompt_options: weatherPromptOptions,
      step_results: stepResults,
    };

    const assistantMsg: StoredMessage = {
      id: makeMessageId(),
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date().toISOString(),
      metadata: assistantMetadata,
    };
    session.messages.push(assistantMsg);
    session.updatedAt = new Date();

    return {
      session: sessionSummary(session),
      response: aiResponse,
      intent: aiIntent,
      itinerary: aiItinerary,
      constraints: aiConstraints,
      metadata: aiMetadata,
      imageResults: aiMetadata.image_results || null,
      imageValidationMessage: aiMetadata.image_validation_message || null,
      userImageUrl: uploadedImageUrl || null,
      // Tour-planning fields (camelCase for the mobile client)
      clarificationQuestion,
      culturalTips,
      finalItinerary,
      pendingUserSelection,
      selectionCards,
      promptText,
      weatherInterrupt,
      weatherPromptMessage,
      weatherPromptOptions,
      stepResults,
    };
  }

  // ============================================================================
  // STREAMING SUPPORT — append user/assistant messages out-of-band
  // ============================================================================

  async appendUserMessage(
    sessionId: string,
    userId: string,
    content: string,
    imageUrl?: string | null
  ): Promise<void> {
    let session = sessionStore.get(sessionId);
    if (!session) {
      const created = await this.createSession(userId, {
        title: content.slice(0, 60),
      });
      session = sessionStore.get(created.sessionId)!;
    }
    if (session.userId !== userId) return;
    session.messages.push({
      id: makeMessageId(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
      ...(imageUrl ? { imageUrl } : {}),
    });
    session.updatedAt = new Date();
  }

  async appendAssistantMessageFromStream(
    sessionId: string,
    userId: string,
    result: any
  ): Promise<void> {
    const session = sessionStore.get(sessionId);
    if (!session || session.userId !== userId) return;

    const content: string = result?.final_response || result?.response || 'Plan ready.';

    session.messages.push({
      id: makeMessageId(),
      role: 'assistant',
      content,
      timestamp: new Date().toISOString(),
      metadata: {
        intent: result?.intent ?? null,
        reasoning_loops: result?.reasoning_loops ?? 0,
        documents_retrieved: result?.documents_retrieved ?? 0,
        web_search_used: result?.web_search_used ?? false,
        itinerary: result?.itinerary ?? null,
        constraints: result?.constraint_violations ?? null,
        clarification_question: result?.clarification_question ?? null,
        cultural_tips: result?.cultural_tips ?? null,
        final_itinerary: result?.final_itinerary ?? null,
        pending_user_selection: result?.pending_user_selection ?? null,
        selection_cards: result?.selection_cards ?? null,
        prompt_text: result?.prompt_text ?? null,
        weather_interrupt: result?.weather_interrupt ?? null,
        weather_prompt_message: result?.weather_prompt_message ?? null,
        weather_prompt_options: result?.weather_prompt_options ?? null,
        step_results: result?.step_results ?? null,
        image_results: result?.image_search_results ?? null,
        image_validation_message: result?.image_validation_message ?? null,
      },
    });
    session.updatedAt = new Date();
  }

  // ============================================================================
  // PLANNING-MODE HITL RESUME (chat-scoped)
  // ============================================================================
  // The AI Engine's LangGraph thread_id IS the chat sessionId, so resuming a
  // paused graph from a chat session uses the same id. We also write the
  // user's choice + the resulting AI response into the chat as new messages
  // so the conversation stays linear when reloaded from history.

  private mapAIResponseToReturn(session: SessionRecord, ai: any) {
    const aiResponseText: string =
      ai?.response || ai?.final_response || 'Plan updated.';
    const camel = {
      itinerary: ai?.itinerary ?? null,
      constraints: ai?.constraints ?? null,
      clarificationQuestion: ai?.clarification_question ?? null,
      culturalTips: ai?.cultural_tips ?? null,
      finalItinerary: ai?.final_itinerary ?? ai?.map_ready_itinerary ?? null,
      pendingUserSelection: ai?.pending_user_selection ?? null,
      selectionCards: ai?.selection_cards ?? null,
      promptText: ai?.prompt_text ?? null,
      weatherInterrupt: ai?.weather_interrupt ?? null,
      weatherPromptMessage: ai?.weather_prompt_message ?? null,
      weatherPromptOptions: ai?.weather_prompt_options ?? null,
      stepResults: ai?.step_results ?? null,
    };

    const assistantMsg: StoredMessage = {
      id: makeMessageId(),
      role: 'assistant',
      content: aiResponseText,
      timestamp: new Date().toISOString(),
      metadata: {
        intent: ai?.intent ?? null,
        ...ai?.metadata,
        ...{
          itinerary: camel.itinerary,
          constraints: camel.constraints,
          clarification_question: camel.clarificationQuestion,
          cultural_tips: camel.culturalTips,
          final_itinerary: camel.finalItinerary,
          pending_user_selection: camel.pendingUserSelection,
          selection_cards: camel.selectionCards,
          prompt_text: camel.promptText,
          weather_interrupt: camel.weatherInterrupt,
          weather_prompt_message: camel.weatherPromptMessage,
          weather_prompt_options: camel.weatherPromptOptions,
          step_results: camel.stepResults,
        },
      },
    };
    session.messages.push(assistantMsg);
    session.updatedAt = new Date();

    return {
      session: sessionSummary(session),
      response: aiResponseText,
      intent: ai?.intent ?? null,
      metadata: ai?.metadata ?? {},
      imageResults: null,
      imageValidationMessage: null,
      userImageUrl: null,
      ...camel,
    };
  }

  async resumeSelection(
    sessionId: string,
    userId: string,
    selectedCandidateId: string,
    userVisibleLabel?: string
  ): Promise<any> {
    const session = sessionStore.get(sessionId);
    if (!session || session.userId !== userId) {
      throw new Error(`Chat session ${sessionId} not found for user`);
    }

    // Push a synthetic user message for the picked candidate so the chat
    // history reads naturally on reload.
    session.messages.push({
      id: makeMessageId(),
      role: 'user',
      content: userVisibleLabel
        ? `Selected: ${userVisibleLabel}`
        : `Selected option: ${selectedCandidateId}`,
      timestamp: new Date().toISOString(),
      metadata: { selection_id: selectedCandidateId, action: 'resume_selection' },
    });

    const ai = await aiEngineService.resumeSelection(sessionId, selectedCandidateId, userId);
    return this.mapAIResponseToReturn(session, ai);
  }

  async resumeWeather(
    sessionId: string,
    userId: string,
    choice: 'switch_indoor' | 'reschedule' | 'keep'
  ): Promise<any> {
    const session = sessionStore.get(sessionId);
    if (!session || session.userId !== userId) {
      throw new Error(`Chat session ${sessionId} not found for user`);
    }

    const labels: Record<string, string> = {
      switch_indoor: 'Switch to indoor activities',
      reschedule: 'Reschedule the affected stops',
      keep: 'Keep the original plan',
    };
    session.messages.push({
      id: makeMessageId(),
      role: 'user',
      content: labels[choice] || choice,
      timestamp: new Date().toISOString(),
      metadata: { weather_choice: choice, action: 'resume_weather' },
    });

    const ai = await aiEngineService.resumeWeather(sessionId, choice, userId);
    return this.mapAIResponseToReturn(session, ai);
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
        imageUrl: m.imageUrl || null,
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
