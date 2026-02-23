import { Message, IMessage } from '../models/Message';
import { Types } from 'mongoose';

export class MessageRepository {
  async create(messageData: Partial<IMessage>): Promise<IMessage> {
    const message = new Message(messageData);
    return message.save();
  }

  async findById(messageId: string): Promise<IMessage | null> {
    return Message.findById(messageId);
  }

  async findByConversationId(
    conversationId: string,
    limit: number = 50,
    skip: number = 0
  ): Promise<IMessage[]> {
    return Message.find({ conversation_id: new Types.ObjectId(conversationId) })
      .sort({ createdAt: 1 })
      .limit(limit)
      .skip(skip);
  }

  async findByUserId(userId: string, limit: number = 50, skip: number = 0): Promise<IMessage[]> {
    return Message.find({ user_id: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);
  }

  async findRecentByConversationId(
    conversationId: string,
    limit: number = 10
  ): Promise<IMessage[]> {
    return Message.find({ conversation_id: new Types.ObjectId(conversationId) })
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  async update(messageId: string, updateData: Partial<IMessage>): Promise<IMessage | null> {
    return Message.findByIdAndUpdate(messageId, updateData, { new: true });
  }

  async delete(messageId: string): Promise<IMessage | null> {
    return Message.findByIdAndDelete(messageId);
  }

  async deleteByConversationId(conversationId: string): Promise<number> {
    const result = await Message.deleteMany({
      conversation_id: new Types.ObjectId(conversationId),
    });
    return result.deletedCount || 0;
  }

  async countByConversationId(conversationId: string): Promise<number> {
    return Message.countDocuments({ conversation_id: new Types.ObjectId(conversationId) });
  }

  async findByMessageType(
    conversationId: string,
    messageType: IMessage['message_type']
  ): Promise<IMessage[]> {
    return Message.find({
      conversation_id: new Types.ObjectId(conversationId),
      message_type: messageType,
    }).sort({ createdAt: -1 });
  }
}
