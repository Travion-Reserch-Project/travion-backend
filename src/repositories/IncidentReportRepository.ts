import IncidentReport, { IIncidentReport } from '../models/IncidentReport';

export class IncidentReportRepository {
  /**
   * Create a new incident report
   */
  async create(reportData: Partial<IIncidentReport>): Promise<IIncidentReport> {
    const report = new IncidentReport(reportData);
    return await report.save();
  }

  /**
   * Find incident report by ID
   */
  async findById(reportId: string): Promise<IIncidentReport | null> {
    return await IncidentReport.findById(reportId).populate('userId', 'name email');
  }

  /**
   * Find incident reports by user ID
   */
  async findByUserId(userId: string, limit = 10, skip = 0): Promise<IIncidentReport[]> {
    return await IncidentReport.find({ userId }).sort({ incidentTime: -1 }).limit(limit).skip(skip);
  }

  /**
   * Find recent incidents near a location
   */
  async findRecentByLocation(
    latitude: number,
    longitude: number,
    radiusInKm = 5,
    limit = 10
  ): Promise<IIncidentReport[]> {
    // Simple radius search
    const latDelta = radiusInKm / 111; // 1 degree ≈ 111 km
    const lonDelta = radiusInKm / (111 * Math.cos((latitude * Math.PI) / 180));

    return await IncidentReport.find({
      'location.latitude': {
        $gte: latitude - latDelta,
        $lte: latitude + latDelta,
      },
      'location.longitude': {
        $gte: longitude - lonDelta,
        $lte: longitude + lonDelta,
      },
      status: { $ne: 'rejected' }, // Exclude rejected reports
      incidentTime: {
        $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      },
    })
      .sort({ incidentTime: -1 })
      .limit(limit);
  }

  /**
   * Find all incident reports with filters
   */
  async findAll(
    filter: Record<string, unknown> = {},
    limit = 10,
    skip = 0
  ): Promise<IIncidentReport[]> {
    return await IncidentReport.find(filter)
      .sort({ incidentTime: -1 })
      .limit(limit)
      .skip(skip)
      .populate('userId', 'name email');
  }

  /**
   * Find reports by incident type
   */
  async findByIncidentType(incidentType: string, limit = 10, skip = 0): Promise<IIncidentReport[]> {
    return await IncidentReport.find({ incidentType, status: { $ne: 'rejected' } })
      .sort({ incidentTime: -1 })
      .limit(limit)
      .skip(skip);
  }

  /**
   * Delete a report
   */
  async delete(reportId: string): Promise<IIncidentReport | null> {
    return await IncidentReport.findByIdAndDelete(reportId);
  }

  /**
   * Get statistics by incident type
   */
  async getStatsByIncidentType(): Promise<any[]> {
    return await IncidentReport.aggregate([
      {
        $match: { status: { $ne: 'rejected' } },
      },
      {
        $group: {
          _id: '$incidentType',
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);
  }

  /**
   * Get total count
   */
  async count(filter: Record<string, unknown> = {}): Promise<number> {
    return await IncidentReport.countDocuments(filter);
  }
}
