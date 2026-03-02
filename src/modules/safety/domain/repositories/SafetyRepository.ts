import { SafetyAlert, ISafetyAlert } from '../models/SafetyAlert';

export class SafetyRepository {
  async create(alertData: Partial<ISafetyAlert>): Promise<ISafetyAlert> {
    const alert = new SafetyAlert(alertData);
    return await alert.save();
  }

  async findById(alertId: string): Promise<ISafetyAlert | null> {
    return await SafetyAlert.findById(alertId);
  }

  async findByUserId(userId: string, limit = 10, skip = 0): Promise<ISafetyAlert[]> {
    return await SafetyAlert.find({ userId }).sort({ timestamp: -1 }).limit(limit).skip(skip);
  }

  async findRecentByLocation(
    latitude: number,
    longitude: number,
    radiusInKm = 5,
    limit = 10
  ): Promise<ISafetyAlert[]> {
    // Simple radius search (for more accurate use geospatial queries)
    const latDelta = radiusInKm / 111; // 1 degree ≈ 111 km
    const lonDelta = radiusInKm / (111 * Math.cos((latitude * Math.PI) / 180));

    return await SafetyAlert.find({
      'location.latitude': {
        $gte: latitude - latDelta,
        $lte: latitude + latDelta,
      },
      'location.longitude': {
        $gte: longitude - lonDelta,
        $lte: longitude + lonDelta,
      },
      timestamp: {
        $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      },
    })
      .sort({ timestamp: -1 })
      .limit(limit);
  }

  async findAll(
    filter: Record<string, unknown> = {},
    limit = 10,
    skip = 0
  ): Promise<ISafetyAlert[]> {
    return await SafetyAlert.find(filter).sort({ timestamp: -1 }).limit(limit).skip(skip);
  }

  async update(alertId: string, updateData: Partial<ISafetyAlert>): Promise<ISafetyAlert | null> {
    return await SafetyAlert.findByIdAndUpdate(alertId, updateData, {
      new: true,
      runValidators: true,
    });
  }

  async delete(alertId: string): Promise<ISafetyAlert | null> {
    return await SafetyAlert.findByIdAndDelete(alertId);
  }

  async count(filter: Record<string, unknown> = {}): Promise<number> {
    return await SafetyAlert.countDocuments(filter);
  }

  async getHighRiskAlertsForUser(userId: string, limit = 5): Promise<ISafetyAlert[]> {
    return await SafetyAlert.find({
      userId,
      'predictions.riskLevel': 'high',
    })
      .sort({ timestamp: -1 })
      .limit(limit);
  }
}
