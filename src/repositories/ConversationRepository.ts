import { Conversation, IConversation } from '../models/Conversation';
import { Types } from 'mongoose';

export class ConversationRepository {
  async create(conversationData: Partial<IConversation>): Promise<IConversation> {
    const conversation = new Conversation(conversationData);
    return conversation.save();
  }

  async findById(conversationId: string): Promise<IConversation | null> {
    return Conversation.findById(conversationId);
  }

  async findByUserId(
    userId: string,
    status?: 'active' | 'ended' | 'archived',
    limit: number = 20,
    skip: number = 0
  ): Promise<IConversation[]> {
    const query: Record<string, unknown> = { user_id: new Types.ObjectId(userId) };
    if (status) {
      query.status = status;
    }
    return Conversation.find(query).sort({ updatedAt: -1 }).limit(limit).skip(skip);
  }

  async findActiveByUserId(userId: string): Promise<IConversation | null> {
    return Conversation.findOne({
      user_id: new Types.ObjectId(userId),
      status: 'active',
    }).sort({ updatedAt: -1 });
  }

  async update(
    conversationId: string,
    updateData: Partial<IConversation>
  ): Promise<IConversation | null> {
    return Conversation.findByIdAndUpdate(conversationId, updateData, { new: true });
  }

  async updateContext(
    conversationId: string,
    context: Partial<IConversation['context']>
  ): Promise<IConversation | null> {
    return Conversation.findByIdAndUpdate(conversationId, { $set: { context } }, { new: true });
  }

  async incrementMessageCount(conversationId: string): Promise<IConversation | null> {
    return Conversation.findByIdAndUpdate(
      conversationId,
      {
        $inc: { 'metadata.message_count': 1, 'metadata.total_queries': 1 },
        $set: { 'metadata.last_message_at': new Date() },
      },
      { new: true }
    );
  }

  async endConversation(conversationId: string): Promise<IConversation | null> {
    return Conversation.findByIdAndUpdate(conversationId, { status: 'ended' }, { new: true });
  }

  async archiveConversation(conversationId: string): Promise<IConversation | null> {
    return Conversation.findByIdAndUpdate(conversationId, { status: 'archived' }, { new: true });
  }

  async delete(conversationId: string): Promise<IConversation | null> {
    return Conversation.findByIdAndDelete(conversationId);
  }

  async countByUserId(userId: string, status?: 'active' | 'ended' | 'archived'): Promise<number> {
    const query: Record<string, unknown> = { user_id: new Types.ObjectId(userId) };
    if (status) {
      query.status = status;
    }
    return Conversation.countDocuments(query);
  }
}
