import { IncidentReportRepository } from '../repositories/IncidentReportRepository';
import { IIncidentReport } from '../models/IncidentReport';
import mongoose from 'mongoose';
import { pushNotificationService } from './PushNotificationService';

export interface CreateIncidentReportInput {
  userId?: string; // Optional for anonymous reports
  incidentType:
    | 'Pickpocketing'
    | 'Bag Snatching'
    | 'Scam'
    | 'Money Theft'
    | 'Harassment'
    | 'Extortion'
    | 'Theft'
    | 'Other';
  location: {
    latitude?: number;
    longitude?: number;
    address: string;
  };
  incidentTime: Date;
  description: string;
  photoUrl?: string;
  isAnonymous?: boolean;
}

export interface IncidentReportResponse {
  success: boolean;
  data?: IIncidentReport;
  error?: string;
}

export class IncidentReportService {
  private readonly incidentReportRepository: IncidentReportRepository;

  constructor() {
    this.incidentReportRepository = new IncidentReportRepository();
  }

  /**
   * Create a new incident report
   */
  async createReport(reportData: CreateIncidentReportInput): Promise<IncidentReportResponse> {
    try {
      console.log('[IncidentReportService] Received report data:', reportData);

      // Validate description length
      if (reportData.description.length < 10) {
        return {
          success: false,
          error: 'Description must be at least 10 characters',
        };
      }

      if (reportData.description.length > 2000) {
        return {
          success: false,
          error: 'Description must not exceed 2000 characters',
        };
      }

      // Prepare report data
      const reportPayload: Partial<IIncidentReport> = {
        incidentType: reportData.incidentType,
        location: reportData.location,
        incidentTime: reportData.incidentTime,
        description: reportData.description,
        photoUrl: reportData.photoUrl,
        isAnonymous: reportData.isAnonymous || !reportData.userId,
        status: 'pending',
      };

      // Add userId only if provided (for authenticated reports)
      if (reportData.userId) {
        reportPayload.userId = new mongoose.Types.ObjectId(reportData.userId);
      }

      console.log('[IncidentReportService] Creating report with payload:', reportPayload);
      const report = await this.incidentReportRepository.create(reportPayload);
      console.log('[IncidentReportService] Report created successfully:', report._id);

      // Send push notifications to nearby users
      if (report.location.latitude && report.location.longitude) {
        // Calculate distance text for notification
        const distance = 'nearby'; // You can calculate actual distance if needed

        // Trigger push notification asynchronously (don't wait for it)
        pushNotificationService
          .sendIncidentAlertToNearby(
            report.location.latitude,
            report.location.longitude,
            5, // 5km radius
            {
              incidentType: report.incidentType,
              location: report.location.address,
              distance: distance,
              incidentId: (report._id as mongoose.Types.ObjectId).toString(),
            },
            reportData.userId ? new mongoose.Types.ObjectId(reportData.userId) : undefined,
          )
          .then(result => {
            console.log(
              `[IncidentReportService] Push notifications sent to ${result.notifiedCount} devices`,
            );
          })
          .catch(error => {
            console.error('[IncidentReportService] Failed to send push notifications:', error);
          });
      }

      return {
        success: true,
        data: report,
      };
    } catch (error) {
      console.error('[IncidentReportService] Error creating report:', error);
      return {
        success: false,
        error: (error as Error).message || 'Failed to create incident report',
      };
    }
  }

  /**
   * Get incident report by ID
   */
  async getReportById(reportId: string): Promise<IIncidentReport | null> {
    return await this.incidentReportRepository.findById(reportId);
  }

  /**
   * Get user's incident reports
   */
  async getUserReports(userId: string, limit = 10, skip = 0): Promise<IIncidentReport[]> {
    return await this.incidentReportRepository.findByUserId(userId, limit, skip);
  }

  /**
   * Get nearby incident reports
   */
  async getNearbyReports(
    latitude: number,
    longitude: number,
    radiusInKm = 5,
    limit = 10
  ): Promise<IIncidentReport[]> {
    return await this.incidentReportRepository.findRecentByLocation(
      latitude,
      longitude,
      radiusInKm,
      limit
    );
  }

  /**
   * Get reports by incident type
   */
  async getReportsByType(incidentType: string, limit = 10, skip = 0): Promise<IIncidentReport[]> {
    return await this.incidentReportRepository.findByIncidentType(incidentType, limit, skip);
  }

  /**
   * Delete a report (for admin)
   */
  async deleteReport(reportId: string): Promise<IIncidentReport | null> {
    return await this.incidentReportRepository.delete(reportId);
  }

  /**
   * Get statistics by incident type
   */
  async getStatsByIncidentType(): Promise<any[]> {
    return await this.incidentReportRepository.getStatsByIncidentType();
  }

  /**
   * Get all reports with pagination
   */
  async getAllReports(
    filter: Record<string, unknown> = {},
    limit = 10,
    skip = 0
  ): Promise<{ reports: IIncidentReport[]; total: number }> {
    const reports = await this.incidentReportRepository.findAll(filter, limit, skip);
    const total = await this.incidentReportRepository.count(filter);
    return { reports, total };
  }
}
