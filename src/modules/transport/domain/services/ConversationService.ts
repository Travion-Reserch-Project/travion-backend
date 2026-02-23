import { ConversationRepository } from '../repositories/ConversationRepository';
import { MessageRepository } from '../repositories/MessageRepository';
import { IConversation } from '../models/Conversation';
import { IMessage } from '../models/Message';
import { logger } from '../../../../shared/config/logger';

export interface CreateConversationDTO {
  user_id: string;
  title?: string;
  initial_message?: string;
}

export interface AddMessageDTO {
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  message_type?: IMessage['message_type'];
  metadata?: IMessage['metadata'];
}

export class ConversationService {
  private conversationRepo: ConversationRepository;
  private messageRepo: MessageRepository;

  constructor() {
    this.conversationRepo = new ConversationRepository();
    this.messageRepo = new MessageRepository();
  }

  /**
   * Create a new conversation
   */
  async createConversation(dto: CreateConversationDTO): Promise<IConversation> {
    try {
      const conversation = await this.conversationRepo.create({
        user_id: dto.user_id as any,
        title: dto.title || 'New Conversation',
        status: 'active',
        metadata: {
          message_count: 0,
          total_queries: 0,
          last_message_at: new Date(),
        },
      });

      if (dto.initial_message) {
        await this.addMessage({
          conversation_id: String(conversation._id),
          user_id: dto.user_id,
          role: 'user',
          content: dto.initial_message,
        });
      }

      return conversation;
    } catch (error) {
      logger.error('Error creating conversation:', error);
      throw error;
    }
  }

  /**
   * Add a message to a conversation
   */
  async addMessage(dto: AddMessageDTO): Promise<IMessage> {
    try {
      const message = await this.messageRepo.create({
        conversation_id: dto.conversation_id as any,
        user_id: dto.user_id as any,
        role: dto.role,
        content: dto.content,
        message_type: dto.message_type || 'text',
        metadata: dto.metadata,
        is_error: false,
      });

      // Update conversation metadata
      await this.conversationRepo.incrementMessageCount(dto.conversation_id);

      return message;
    } catch (error) {
      logger.error('Error adding message:', error);
      throw error;
    }
  }

  /**
   * Get conversation by ID with messages
   */
  async getConversation(
    conversationId: string
  ): Promise<{ conversation: IConversation; messages: IMessage[] } | null> {
    try {
      const conversation = await this.conversationRepo.findById(conversationId);
      if (!conversation) return null;

      const messages = await this.messageRepo.findByConversationId(conversationId);

      return { conversation, messages };
    } catch (error) {
      logger.error('Error getting conversation:', error);
      throw error;
    }
  }

  /**
   * Get recent messages from a conversation
   */
  async getRecentMessages(conversationId: string, limit: number = 10): Promise<IMessage[]> {
    return this.messageRepo.findRecentByConversationId(conversationId, limit);
  }

  /**
   * Get active conversation for a user
   */
  async getActiveConversation(userId: string): Promise<IConversation | null> {
    return this.conversationRepo.findActiveByUserId(userId);
  }

  /**
   * Get or create active conversation
   */
  async getOrCreateActiveConversation(userId: string): Promise<IConversation> {
    let conversation = await this.conversationRepo.findActiveByUserId(userId);

    if (!conversation) {
      conversation = await this.createConversation({
        user_id: userId,
        title: 'Transport Query',
      });
    }

    return conversation;
  }

  /**
   * Get user's conversation history
   */
  async getUserConversations(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ conversations: IConversation[]; total: number }> {
    try {
      const skip = (page - 1) * limit;
      const conversations = await this.conversationRepo.findByUserId(
        userId,
        undefined,
        limit,
        skip
      );
      const total = await this.conversationRepo.countByUserId(userId);

      return { conversations, total };
    } catch (error) {
      logger.error('Error getting user conversations:', error);
      throw error;
    }
  }

  /**
   * Update conversation context
   */
  async updateContext(
    conversationId: string,
    context: Partial<IConversation['context']>
  ): Promise<IConversation | null> {
    return this.conversationRepo.updateContext(conversationId, context);
  }

  /**
   * End a conversation
   */
  async endConversation(conversationId: string): Promise<IConversation | null> {
    return this.conversationRepo.endConversation(conversationId);
  }

  /**
   * Archive a conversation
   */
  async archiveConversation(conversationId: string): Promise<IConversation | null> {
    return this.conversationRepo.archiveConversation(conversationId);
  }

  /**
   * Delete a conversation and all its messages
   */
  async deleteConversation(conversationId: string): Promise<void> {
    try {
      await this.messageRepo.deleteByConversationId(conversationId);
      await this.conversationRepo.delete(conversationId);
    } catch (error) {
      logger.error('Error deleting conversation:', error);
      throw error;
    }
  }

  /**
   * Get conversation statistics
   */
  async getConversationStats(conversationId: string): Promise<{
    total_messages: number;
    user_messages: number;
    assistant_messages: number;
    average_response_time?: number;
  }> {
    try {
      const messages = await this.messageRepo.findByConversationId(conversationId);

      const userMessages = messages.filter((m) => m.role === 'user');
      const assistantMessages = messages.filter((m) => m.role === 'assistant');

      return {
        total_messages: messages.length,
        user_messages: userMessages.length,
        assistant_messages: assistantMessages.length,
        average_response_time: this.calculateAverageResponseTime(messages),
      };
    } catch (error) {
      logger.error('Error getting conversation stats:', error);
      throw error;
    }
  }

  /**
   * Calculate average response time
   */
  private calculateAverageResponseTime(messages: IMessage[]): number | undefined {
    let totalTime = 0;
    let count = 0;

    for (let i = 1; i < messages.length; i++) {
      if (messages[i].role === 'assistant' && messages[i - 1].role === 'user') {
        const timeDiff =
          new Date(messages[i].createdAt).getTime() - new Date(messages[i - 1].createdAt).getTime();
        totalTime += timeDiff;
        count++;
      }
    }

    return count > 0 ? totalTime / count : undefined;
  }
}
