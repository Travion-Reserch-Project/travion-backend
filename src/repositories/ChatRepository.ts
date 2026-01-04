import { ChatSession, IChatSession } from '../models/ChatSession';
import { ChatQuery, IChatQuery } from '../models/ChatQuery';

export class ChatRepository {
  // Chat Session methods
  async createSession(sessionData: Partial<IChatSession>): Promise<IChatSession> {
    const session = new ChatSession(sessionData);
    return await session.save();
  }

  async findSessionById(sessionId: string): Promise<IChatSession | null> {
    return await ChatSession.findOne({ $or: [{ _id: sessionId }, { sessionId }] });
  }

  async findSessionsByUserId(
    userId: string,
    limit?: number,
    skip?: number
  ): Promise<IChatSession[]> {
    let query = ChatSession.find({ userId }).sort({ startTime: -1 });

    if (skip !== undefined) {
      query = query.skip(skip);
    }

    if (limit !== undefined) {
      query = query.limit(limit);
    }

    return await query;
  }

  async findActiveSessionByUserId(userId: string): Promise<IChatSession | null> {
    return await ChatSession.findOne({ userId, sessionStatus: 'active' }).sort({ startTime: -1 });
  }

  async updateSession(
    sessionId: string,
    updateData: Partial<IChatSession>
  ): Promise<IChatSession | null> {
    return await ChatSession.findOneAndUpdate(
      { $or: [{ _id: sessionId }, { sessionId }] },
      { $set: updateData },
      { new: true }
    );
  }

  async countSessionsByUserId(userId: string): Promise<number> {
    return await ChatSession.countDocuments({ userId });
  }

  async endSession(sessionId: string): Promise<IChatSession | null> {
    return await ChatSession.findOneAndUpdate(
      { $or: [{ _id: sessionId }, { sessionId }] },
      {
        $set: {
          sessionStatus: 'ended',
          endTime: new Date(),
        },
      },
      { new: true }
    );
  }

  // Chat Query methods
  async createQuery(queryData: Partial<IChatQuery>): Promise<IChatQuery> {
    const query = new ChatQuery(queryData);
    return await query.save();
  }

  async findQueryById(queryId: string): Promise<IChatQuery | null> {
    return await ChatQuery.findOne({ queryId });
  }

  async findQueriesBySessionId(sessionId: string): Promise<IChatQuery[]> {
    return await ChatQuery.find({ sessionId }).sort({ timestamp: 1 });
  }

  async findQueriesByUserId(userId: string, limit?: number, skip?: number): Promise<IChatQuery[]> {
    let query = ChatQuery.find({ userId }).sort({ timestamp: -1 });

    if (skip !== undefined) {
      query = query.skip(skip);
    }

    if (limit !== undefined) {
      query = query.limit(limit);
    }

    return await query;
  }

  async updateQueryFeedback(
    queryId: string,
    feedbackData: {
      userRating?: number;
      userFeedback?: string;
      wasHelpful?: boolean;
    }
  ): Promise<IChatQuery | null> {
    return await ChatQuery.findOneAndUpdate({ queryId }, { $set: feedbackData }, { new: true });
  }

  async countQueriesByUserId(userId: string): Promise<number> {
    return await ChatQuery.countDocuments({ userId });
  }

  // Analytics methods
  async getQueryAnalytics(filter: any = {}): Promise<any> {
    return await ChatQuery.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalQueries: { $sum: 1 },
          averageResponseTime: { $avg: '$responseTime' },
          averageLatency: { $avg: '$mlServiceLatency' },
          successCount: {
            $sum: { $cond: [{ $eq: ['$mlServiceStatus', 'success'] }, 1, 0] },
          },
          errorCount: {
            $sum: { $cond: [{ $ne: ['$mlServiceStatus', 'success'] }, 1, 0] },
          },
          averageRating: { $avg: '$userRating' },
          helpfulCount: {
            $sum: { $cond: [{ $eq: ['$wasHelpful', true] }, 1, 0] },
          },
          ratedCount: {
            $sum: { $cond: [{ $ne: ['$userRating', null] }, 1, 0] },
          },
          feedbackCount: {
            $sum: { $cond: [{ $ne: ['$userFeedback', null] }, 1, 0] },
          },
        },
      },
    ]);
  }

  async getQueryTypeDistribution(filter: any = {}): Promise<any[]> {
    return await ChatQuery.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$queryType',
          count: { $sum: 1 },
          averageResponseTime: { $avg: '$responseTime' },
          successRate: {
            $avg: { $cond: [{ $eq: ['$mlServiceStatus', 'success'] }, 1, 0] },
          },
        },
      },
      { $sort: { count: -1 } },
    ]);
  }

  async getSessionAnalytics(filter: any = {}): Promise<any> {
    return await ChatSession.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          averageSessionQueries: { $avg: '$totalQueries' },
          averageSessionResponseTime: { $avg: '$avgResponseTime' },
          averageSatisfactionScore: { $avg: '$userSatisfactionScore' },
          activeSessions: {
            $sum: { $cond: [{ $eq: ['$sessionStatus', 'active'] }, 1, 0] },
          },
          endedSessions: {
            $sum: { $cond: [{ $eq: ['$sessionStatus', 'ended'] }, 1, 0] },
          },
          abandonedSessions: {
            $sum: { $cond: [{ $eq: ['$sessionStatus', 'abandoned'] }, 1, 0] },
          },
        },
      },
    ]);
  }

  async getMostActiveUsers(limit: number = 10): Promise<any[]> {
    return await ChatQuery.aggregate([
      {
        $group: {
          _id: '$userId',
          totalQueries: { $sum: 1 },
          averageResponseTime: { $avg: '$responseTime' },
          lastQuery: { $max: '$timestamp' },
          averageRating: { $avg: '$userRating' },
        },
      },
      { $sort: { totalQueries: -1 } },
      { $limit: limit },
    ]);
  }

  async getPopularQueryPatterns(limit: number = 20): Promise<any[]> {
    return await ChatQuery.aggregate([
      {
        $group: {
          _id: {
            queryType: '$queryType',
            firstWords: { $substr: ['$queryText', 0, 50] },
          },
          count: { $sum: 1 },
          averageRating: { $avg: '$userRating' },
          successRate: {
            $avg: { $cond: [{ $eq: ['$mlServiceStatus', 'success'] }, 1, 0] },
          },
        },
      },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);
  }

  async getErrorAnalytics(filter: any = {}): Promise<any[]> {
    const errorFilter = {
      ...filter,
      mlServiceStatus: { $ne: 'success' },
    };

    return await ChatQuery.aggregate([
      { $match: errorFilter },
      {
        $group: {
          _id: {
            status: '$mlServiceStatus',
            errorCode: '$errorDetails.code',
          },
          count: { $sum: 1 },
          averageLatency: { $avg: '$mlServiceLatency' },
          examples: {
            $push: {
              queryId: '$queryId',
              queryText: { $substr: ['$queryText', 0, 100] },
              timestamp: '$timestamp',
              errorMessage: '$errorDetails.message',
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          count: 1,
          averageLatency: 1,
          examples: { $slice: ['$examples', 5] }, // Limit to 5 examples
        },
      },
      { $sort: { count: -1 } },
    ]);
  }
}
