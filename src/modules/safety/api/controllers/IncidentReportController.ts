import { Response, NextFunction } from 'express';
import { IncidentReportService } from '../../domain/services/IncidentReportService';
import { AuthRequest } from '../../../../shared/middleware/auth';
import { validationResult } from 'express-validator';

export class IncidentReportController {
  private incidentReportService: IncidentReportService;

  constructor() {
    this.incidentReportService = new IncidentReportService();
  }

  /**
   * Create a new incident report
   * Public endpoint - authentication optional (supports anonymous reports)
   */
  createReport = async (req: AuthRequest, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid request data',
            details: errors.array(),
          },
        });
        return;
      }

      // userId is optional - undefined for anonymous reports
      const userId = req.user?.userId || undefined;
      const {
        incidentType,
        location,
        incidentTime,
        description,
        photoUrl,
        isAnonymous,
        reporterDeviceToken,
      } = req.body;

      console.log('[IncidentReportController] Received report data:', {
        userId,
        incidentType,
        location,
        incidentTime,
        description: description?.substring(0, 50),
        photoUrl,
        isAnonymous,
        reporterDeviceToken: reporterDeviceToken ? '***' : undefined,
      });

      const result = await this.incidentReportService.createReport({
        userId,
        incidentType,
        location,
        incidentTime: new Date(incidentTime),
        description,
        photoUrl,
        isAnonymous: isAnonymous || !userId,
        reporterDeviceToken,
      });

      console.log('[IncidentReportController] Service result:', {
        success: result.success,
        hasData: !!result.data,
      });

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.status(201).json(result);
    } catch (error) {
      console.error('[IncidentReportController] Error creating report:', error);
      res.status(500).json({
        success: false,
        error: {
          message: (error as Error).message || 'Failed to create incident report',
        },
      });
    }
  };

  /**
   * Get incident report by ID
   */
  getReportById = async (req: AuthRequest, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const { reportId } = req.params;

      const report = await this.incidentReportService.getReportById(reportId);

      if (!report) {
        res.status(404).json({
          success: false,
          error: { message: 'Report not found' },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: report,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { message: (error as Error).message || 'Failed to get report' },
      });
    }
  };

  /**
   * Get user's incident reports (requires authentication)
   */
  getUserReports = async (req: AuthRequest, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { message: 'Authentication required' },
        });
        return;
      }

      const limit = parseInt(req.query.limit as string) || 10;
      const skip = parseInt(req.query.skip as string) || 0;

      const reports = await this.incidentReportService.getUserReports(userId, limit, skip);

      res.status(200).json({
        success: true,
        data: reports,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { message: (error as Error).message || 'Failed to get user reports' },
      });
    }
  };

  /**
   * Get nearby incident reports
   */
  getNearbyReports = async (
    req: AuthRequest,
    res: Response,
    _next: NextFunction
  ): Promise<void> => {
    try {
      const { latitude, longitude, radius, limit } = req.query;

      if (!latitude || !longitude) {
        res.status(400).json({
          success: false,
          error: { message: 'Latitude and longitude are required' },
        });
        return;
      }

      const reports = await this.incidentReportService.getNearbyReports(
        parseFloat(latitude as string),
        parseFloat(longitude as string),
        parseFloat((radius as string) || '5'),
        parseInt((limit as string) || '10')
      );

      res.status(200).json({
        success: true,
        data: reports,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { message: (error as Error).message || 'Failed to get nearby reports' },
      });
    }
  };

  /**
   * Get reports by incident type
   */
  getReportsByType = async (
    req: AuthRequest,
    res: Response,
    _next: NextFunction
  ): Promise<void> => {
    try {
      const { incidentType } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = parseInt(req.query.skip as string) || 0;

      const reports = await this.incidentReportService.getReportsByType(incidentType, limit, skip);

      res.status(200).json({
        success: true,
        data: reports,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { message: (error as Error).message || 'Failed to get reports by type' },
      });
    }
  };

  /**
   * Get statistics by incident type
   */
  getStatistics = async (_req: AuthRequest, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const stats = await this.incidentReportService.getStatsByIncidentType();

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { message: (error as Error).message || 'Failed to get statistics' },
      });
    }
  };

  /**
   * Get all reports with pagination (for admin)
   */
  getAllReports = async (_req: AuthRequest, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const userId = _req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { message: 'Authentication required' },
        });
        return;
      }

      const limit = parseInt(_req.query.limit as string) || 10;
      const skip = parseInt(_req.query.skip as string) || 0;
      const filter: Record<string, unknown> = {};

      // Optional filters
      if (_req.query.status) {
        filter.status = _req.query.status;
      }
      if (_req.query.incidentType) {
        filter.incidentType = _req.query.incidentType;
      }

      const result = await this.incidentReportService.getAllReports(filter, limit, skip);

      res.status(200).json({
        success: true,
        data: result.reports,
        pagination: {
          total: result.total,
          limit,
          skip,
          hasMore: result.total > skip + limit,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { message: (error as Error).message || 'Failed to get all reports' },
      });
    }
  };
}
