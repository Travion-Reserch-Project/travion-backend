import { RoadIncident, IRoadIncident } from '../models/RoadIncident';
import { Types } from 'mongoose';

export class IncidentRepository {
  /**
   * Create a new incident report
   */
  async create(incidentData: Partial<IRoadIncident>): Promise<IRoadIncident> {
    const incident = new RoadIncident(incidentData);
    return incident.save();
  }

  /**
   * Find incident by ID
   */
  async findById(incidentId: string): Promise<IRoadIncident | null> {
    return RoadIncident.findById(incidentId);
  }

  /**
   * Find all active incidents
   */
  async findActive(limit: number = 100, skip: number = 0): Promise<IRoadIncident[]> {
    return RoadIncident.find({ status: 'active', is_resolved: false })
      .sort({ severity: -1, createdAt: -1 })
      .limit(limit)
      .skip(skip);
  }

  /**
   * Find incidents by status
   */
  async findByStatus(
    status: 'active' | 'resolved' | 'archived',
    limit: number = 50,
    skip: number = 0
  ): Promise<IRoadIncident[]> {
    return RoadIncident.find({ status }).sort({ createdAt: -1 }).limit(limit).skip(skip);
  }

  /**
   * Find incidents within a geographic radius (in km)
   */
  async findByLocation(
    latitude: number,
    longitude: number,
    radiusKm: number = 5
  ): Promise<IRoadIncident[]> {
    const radiusRad = radiusKm / 6371; // Convert km to radians (Earth's radius = 6371 km)
    return RoadIncident.find({
      'location.latitude': {
        $gte: latitude - radiusRad,
        $lte: latitude + radiusRad,
      },
      'location.longitude': {
        $gte: longitude - radiusRad,
        $lte: longitude + radiusRad,
      },
      status: 'active',
      is_resolved: false,
    }).sort({ createdAt: -1 });
  }

  /**
   * Find incidents by type
   */
  async findByType(
    incidentType: string,
    limit: number = 50,
    skip: number = 0
  ): Promise<IRoadIncident[]> {
    return RoadIncident.find({ incident_type: incidentType, status: 'active' })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);
  }

  /**
   * Find incidents affecting routes between two coordinates
   * This finds incidents where affected routes pass through or near the path
   */
  async findByRouteCoordinates(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
    radiusKm: number = 10
  ): Promise<IRoadIncident[]> {
    // Calculate bounding box for the route corridor
    const minLat = Math.min(originLat, destLat) - radiusKm / 111; // ~111km per degree
    const maxLat = Math.max(originLat, destLat) + radiusKm / 111;
    const minLng = Math.min(originLng, destLng) - radiusKm / 111;
    const maxLng = Math.max(originLng, destLng) + radiusKm / 111;

    return RoadIncident.find({
      $or: [
        // Incidents within the route corridor
        {
          'location.latitude': { $gte: minLat, $lte: maxLat },
          'location.longitude': { $gte: minLng, $lte: maxLng },
        },
        // Incidents with affected routes that intersect
        {
          'affected_routes.coordinates.start.latitude': { $gte: minLat, $lte: maxLat },
          'affected_routes.coordinates.start.longitude': { $gte: minLng, $lte: maxLng },
        },
        {
          'affected_routes.coordinates.end.latitude': { $gte: minLat, $lte: maxLat },
          'affected_routes.coordinates.end.longitude': { $gte: minLng, $lte: maxLng },
        },
      ],
      status: 'active',
      is_resolved: false,
    }).sort({ severity: -1, createdAt: -1 });
  }

  /**
   * Find incidents by route name (e.g., "A1 Highway", "Colombo-Kandy Road")
   */
  async findByRouteName(routeName: string): Promise<IRoadIncident[]> {
    return RoadIncident.find({
      'affected_routes.route_name': { $regex: routeName, $options: 'i' },
      status: 'active',
      is_resolved: false,
    }).sort({ severity: -1, createdAt: -1 });
  }

  /**
   * Find incidents reported by a user
   */
  async findByReporterId(
    reporterId: string,
    limit: number = 50,
    skip: number = 0
  ): Promise<IRoadIncident[]> {
    return RoadIncident.find({ reporter_id: new Types.ObjectId(reporterId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);
  }

  /**
   * Find incidents by severity
   */
  async findBySeverity(
    severity: 'low' | 'medium' | 'high' | 'critical',
    limit: number = 50
  ): Promise<IRoadIncident[]> {
    return RoadIncident.find({ severity, status: 'active', is_resolved: false })
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  /**
   * Confirm/verify an incident by user
   */
  async confirmIncident(incidentId: string, userId: string): Promise<IRoadIncident | null> {
    return RoadIncident.findByIdAndUpdate(
      incidentId,
      {
        $addToSet: { 'verification.confirmed_by_users': new Types.ObjectId(userId) },
        $inc: { 'verification.count': 1 },
        'verification.last_confirmed_at': new Date(),
      },
      { new: true }
    );
  }

  /**
   * Update incident
   */
  async update(
    incidentId: string,
    updateData: Partial<IRoadIncident>
  ): Promise<IRoadIncident | null> {
    return RoadIncident.findByIdAndUpdate(incidentId, updateData, { new: true });
  }

  /**
   * Resolve incident
   */
  async resolve(
    incidentId: string,
    resolvedBy: string,
    resolutionNotes?: string
  ): Promise<IRoadIncident | null> {
    return RoadIncident.findByIdAndUpdate(
      incidentId,
      {
        is_resolved: true,
        status: 'resolved',
        resolved_by: new Types.ObjectId(resolvedBy),
        resolved_at: new Date(),
        resolution_notes: resolutionNotes,
      },
      { new: true }
    );
  }

  /**
   * Archive incident
   */
  async archive(incidentId: string): Promise<IRoadIncident | null> {
    return RoadIncident.findByIdAndUpdate(incidentId, { status: 'archived' }, { new: true });
  }

  /**
   * Delete incident
   */
  async delete(incidentId: string): Promise<IRoadIncident | null> {
    return RoadIncident.findByIdAndDelete(incidentId);
  }

  /**
   * Count active incidents
   */
  async countActive(): Promise<number> {
    return RoadIncident.countDocuments({ status: 'active', is_resolved: false });
  }

  /**
   * Find high-priority incidents (critical or high severity)
   */
  async findHighPriority(limit: number = 10): Promise<IRoadIncident[]> {
    return RoadIncident.find({
      severity: { $in: ['critical', 'high'] },
      status: 'active',
      is_resolved: false,
    })
      .sort({ severity: -1, createdAt: -1 })
      .limit(limit);
  }

  /**
   * Find incidents in district
   */
  async findByDistrict(district: string, limit: number = 50): Promise<IRoadIncident[]> {
    return RoadIncident.find({
      'location.district': district,
      status: 'active',
      is_resolved: false,
    })
      .sort({ severity: -1, createdAt: -1 })
      .limit(limit);
  }

  /**
   * Get statistics for incidents
   */
  async getStatistics(): Promise<{
    total_active: number;
    by_severity: Record<string, number>;
    by_type: Record<string, number>;
  }> {
    const activeCount = await RoadIncident.countDocuments({ status: 'active', is_resolved: false });

    const bySeverity = await RoadIncident.aggregate([
      { $match: { status: 'active', is_resolved: false } },
      { $group: { _id: '$severity', count: { $sum: 1 } } },
    ]);

    const byType = await RoadIncident.aggregate([
      { $match: { status: 'active', is_resolved: false } },
      { $group: { _id: '$incident_type', count: { $sum: 1 } } },
    ]);

    return {
      total_active: activeCount,
      by_severity: Object.fromEntries(bySeverity.map((item: any) => [item._id, item.count])),
      by_type: Object.fromEntries(byType.map((item: any) => [item._id, item.count])),
    };
  }
}
