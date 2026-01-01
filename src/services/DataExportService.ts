import { ChatRepository } from '../repositories/ChatRepository';
import { IChatQuery } from '../models/ChatQuery';
import { IChatSession } from '../models/ChatSession';
import { logger } from '../config/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface TrainingDataExportOptions {
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  queryTypes?: string[];
  includeRatedOnly?: boolean;
  minRating?: number;
  format: 'json' | 'csv' | 'jsonl';
  includePersonalData?: boolean;
}

export interface ExportedTrainingData {
  queries: Array<{
    queryId: string;
    queryText: string;
    queryType: string;
    userLocation?: {
      latitude: number;
      longitude: number;
      address?: string;
    };
    mlServiceResponse?: Record<string, unknown>;
    formattedResponse: string;
    userRating?: number;
    userFeedback?: string;
    wasHelpful?: boolean;
    responseTime: number;
    mlServiceLatency: number;
    timestamp: Date;
    sessionId: string;
    userId?: string; // Only if includePersonalData is true
  }>;
  sessions: Array<{
    sessionId: string;
    totalQueries: number;
    avgResponseTime: number;
    userSatisfactionScore?: number;
    startTime: Date;
    endTime?: Date;
    userId?: string; // Only if includePersonalData is true
  }>;
  metadata: {
    exportDate: Date;
    totalQueries: number;
    totalSessions: number;
    dateRange: {
      start?: Date;
      end?: Date;
    };
    filters: TrainingDataExportOptions;
  };
}

export class DataExportService {
  private chatRepository: ChatRepository;

  constructor() {
    this.chatRepository = new ChatRepository();
  }

  /**
   * Export training data based on specified options
   */
  async exportTrainingData(options: TrainingDataExportOptions): Promise<string> {
    try {
      const data = await this.gatherTrainingData(options);
      const exportPath = await this.writeDataToFile(data, options.format);
      return exportPath;
    } catch (error) {
      logger.error('Error exporting training data:', error);
      throw new Error('Failed to export training data');
    }
  }

  /**
   * Get training data statistics without exporting
   */
  async getTrainingDataStats(options: Partial<TrainingDataExportOptions>): Promise<{
    totalQueries: number;
    totalSessions: number;
    queryTypeDistribution: Record<string, number>;
    ratingDistribution: Record<string, number>;
    avgResponseTime: number;
    avgUserSatisfaction: number;
  }> {
    const filter = this.buildQueryFilter(options);

    const [queryStats, queryTypes] = await Promise.all([
      this.chatRepository.getQueryAnalytics(filter),
      this.chatRepository.getQueryTypeDistribution(filter),
    ]);

    const sessionFilter = this.buildSessionFilter(options);
    const sessionStats = await this.chatRepository.getSessionAnalytics(sessionFilter);

    const stats = queryStats[0] || {};
    const sessionData = sessionStats[0] || {};

    // Build rating distribution
    const ratingDistribution: Record<string, number> = {};
    for (let i = 1; i <= 5; i++) {
      // const ratedQueries = await this.chatRepository.countQueriesByUserId(''); // This needs to be updated for proper rating count
      ratingDistribution[i.toString()] = 0; // Placeholder - would need proper aggregation
    }

    return {
      totalQueries: stats.totalQueries || 0,
      totalSessions: sessionData.totalSessions || 0,
      queryTypeDistribution: queryTypes.reduce(
        (acc, item) => {
          acc[item._id] = item.count;
          return acc;
        },
        {} as Record<string, number>
      ),
      ratingDistribution,
      avgResponseTime: stats.averageResponseTime || 0,
      avgUserSatisfaction: sessionData.averageSatisfactionScore || 0,
    };
  }

  /**
   * Export data for model optimization
   */
  async exportForModelTraining(options: Partial<TrainingDataExportOptions> = {}): Promise<string> {
    const defaultOptions: TrainingDataExportOptions = {
      format: 'jsonl',
      includeRatedOnly: true,
      minRating: 3, // Only include queries rated 3 or higher
      includePersonalData: false,
      ...options,
    };

    return this.exportTrainingData(defaultOptions);
  }

  /**
   * Export failed queries for error analysis
   */
  async exportFailedQueries(options: Partial<TrainingDataExportOptions> = {}): Promise<string> {
    // const filter = {
    //   ...this.buildQueryFilter(options),
    //   mlServiceStatus: { $ne: 'success' },
    // };

    const queries = await this.chatRepository.findQueriesByUserId(''); // This needs proper implementation

    const failedData = {
      queries: queries.map((query) => ({
        queryId: query.queryId,
        queryText: query.queryText,
        queryType: query.queryType,
        mlServiceStatus: query.mlServiceStatus,
        errorDetails: query.errorDetails,
        responseTime: query.responseTime,
        mlServiceLatency: query.mlServiceLatency,
        timestamp: query.timestamp,
      })),
      metadata: {
        exportDate: new Date(),
        totalFailedQueries: queries.length,
        filters: options,
      },
    };

    const filename = `failed-queries-${new Date().toISOString().split('T')[0]}.json`;
    const exportPath = path.join(process.cwd(), 'exports', filename);

    await fs.mkdir(path.dirname(exportPath), { recursive: true });
    await fs.writeFile(exportPath, JSON.stringify(failedData, null, 2));

    return exportPath;
  }

  /**
   * Gather training data based on options
   */
  private async gatherTrainingData(
    options: TrainingDataExportOptions
  ): Promise<ExportedTrainingData> {
    // const queryFilter = this.buildQueryFilter(options);
    // const sessionFilter = this.buildSessionFilter(options);

    // This is a simplified implementation - in practice, you'd need proper aggregation queries
    const queries: IChatQuery[] = [];
    const sessions: IChatSession[] = [];

    const processedQueries = queries.map((query) => ({
      queryId: query.queryId,
      queryText: query.queryText,
      queryType: query.queryType,
      userLocation: query.userLocation,
      mlServiceResponse: query.mlServiceResponse,
      formattedResponse: query.formattedResponse,
      userRating: query.userRating,
      userFeedback: query.userFeedback,
      wasHelpful: query.wasHelpful,
      responseTime: query.responseTime,
      mlServiceLatency: query.mlServiceLatency,
      timestamp: query.timestamp,
      sessionId: query.sessionId?.toString(),
      ...(options.includePersonalData && { userId: query.userId?.toString() }),
    }));

    const processedSessions = sessions.map((session) => ({
      sessionId: session._id?.toString() || '',
      totalQueries: session.totalQueries,
      avgResponseTime: session.avgResponseTime,
      userSatisfactionScore: session.userSatisfactionScore,
      startTime: session.startTime,
      endTime: session.endTime,
      ...(options.includePersonalData && { userId: session.userId?.toString() }),
    }));

    return {
      queries: processedQueries,
      sessions: processedSessions,
      metadata: {
        exportDate: new Date(),
        totalQueries: processedQueries.length,
        totalSessions: processedSessions.length,
        dateRange: {
          start: options.startDate,
          end: options.endDate,
        },
        filters: options,
      },
    };
  }

  /**
   * Write data to file in specified format
   */
  private async writeDataToFile(
    data: ExportedTrainingData,
    format: 'json' | 'csv' | 'jsonl'
  ): Promise<string> {
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `training-data-${timestamp}.${format}`;
    const exportPath = path.join(process.cwd(), 'exports', filename);

    await fs.mkdir(path.dirname(exportPath), { recursive: true });

    switch (format) {
      case 'json':
        await fs.writeFile(exportPath, JSON.stringify(data, null, 2));
        break;

      case 'jsonl': {
        const jsonlData = data.queries.map((query) => JSON.stringify(query)).join('\n');
        await fs.writeFile(exportPath, jsonlData);
        break;
      }

      case 'csv': {
        const csvData = this.convertToCSV(data.queries);
        await fs.writeFile(exportPath, csvData);
        break;
      }

      default:
        throw new Error('Unsupported export format');
    }

    return exportPath;
  }

  /**
   * Convert data to CSV format
   */
  private convertToCSV(queries: Array<Record<string, unknown>>): string {
    if (queries.length === 0) return '';

    const headers = Object.keys(queries[0]).join(',');
    const rows = queries.map((query) =>
      Object.values(query)
        .map((value) => {
          if (typeof value === 'object' && value !== null) {
            return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
          }
          return `"${String(value).replace(/"/g, '""')}"`;
        })
        .join(',')
    );

    return [headers, ...rows].join('\n');
  }

  /**
   * Build query filter based on options
   */
  private buildQueryFilter(options: Partial<TrainingDataExportOptions>): Record<string, unknown> {
    const filter: Record<string, unknown> = {};

    if (options.startDate || options.endDate) {
      const timestamp: Record<string, Date> = {};
      if (options.startDate) timestamp.$gte = options.startDate;
      if (options.endDate) timestamp.$lte = options.endDate;
      filter.timestamp = timestamp;
    }

    if (options.userId) {
      filter.userId = options.userId;
    }

    if (options.queryTypes && options.queryTypes.length > 0) {
      filter.queryType = { $in: options.queryTypes };
    }

    if (options.includeRatedOnly) {
      filter.userRating = { $exists: true, $ne: null };
    }

    if (options.minRating) {
      filter.userRating = { $gte: options.minRating };
    }

    return filter;
  }

  /**
   * Build session filter based on options
   */
  private buildSessionFilter(options: Partial<TrainingDataExportOptions>): Record<string, unknown> {
    const filter: Record<string, unknown> = {};

    if (options.startDate || options.endDate) {
      const startTime: Record<string, Date> = {};
      if (options.startDate) startTime.$gte = options.startDate;
      if (options.endDate) startTime.$lte = options.endDate;
      filter.startTime = startTime;
    }

    if (options.userId) {
      filter.userId = options.userId;
    }

    return filter;
  }
}
