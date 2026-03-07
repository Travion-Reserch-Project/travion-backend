import { IncidentRepository } from '../repositories/IncidentRepository';
import { IRoadIncident, ILocation } from '../models/RoadIncident';
import { logger } from '../../../../shared/config/logger';

export interface ReportIncidentRequest {
  reporter_id: string;
  incident_type:
    | 'accident'
    | 'road_block'
    | 'traffic_jam'
    | 'pothole'
    | 'flooding'
    | 'landslide'
    | 'construction'
    | 'other';
  title: string;
  description: string;
  location: ILocation;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  affected_routes?: any[];
  attachments?: {
    image_urls?: string[];
    video_urls?: string[];
  };
}

export interface IncidentResponse {
  id: string;
  incident_type: string;
  title: string;
  description: string;
  location: ILocation;
  severity: string;
  status: string;
  verification_count: number;
  reported_at: Date;
  distance_from_user_km?: number;
  estimated_delay_min?: number;
}

export class IncidentService {
  private incidentRepository: IncidentRepository;

  constructor() {
    this.incidentRepository = new IncidentRepository();
  }

  /**
   * Report a new road incident
   */
  async reportIncident(request: ReportIncidentRequest): Promise<IncidentResponse> {
    try {
      const incident = await this.incidentRepository.create({
        reporter_id: request.reporter_id,
        incident_type: request.incident_type,
        title: request.title,
        description: request.description,
        location: request.location,
        severity: request.severity || 'medium',
        affected_routes: request.affected_routes || [],
        verification: {
          confirmed_by_users: [request.reporter_id],
          count: 1,
          last_confirmed_at: new Date(),
        },
        attachments: request.attachments,
      } as any);

      logger.info(`Incident reported: ${incident._id} by user ${request.reporter_id}`);
      return this.formatIncidentResponse(incident);
    } catch (error) {
      logger.error('Error reporting incident:', error);
      throw error;
    }
  }

  /**
   * Fetch incidents near user's current location
   */
  async getIncidentsNearLocation(
    latitude: number,
    longitude: number,
    radiusKm: number = 5
  ): Promise<IncidentResponse[]> {
    try {
      const incidents = await this.incidentRepository.findByLocation(latitude, longitude, radiusKm);
      return incidents.map((incident) => ({
        ...this.formatIncidentResponse(incident),
        distance_from_user_km: this.calculateDistance(
          latitude,
          longitude,
          incident.location.latitude,
          incident.location.longitude
        ),
      }));
    } catch (error) {
      logger.error('Error fetching incidents near location:', error);
      throw error;
    }
  }

  /**
   * Fetch incidents affecting a specific route by coordinates
   */
  async getIncidentsForRoute(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
    radiusKm: number = 10
  ): Promise<IncidentResponse[]> {
    try {
      const incidents = await this.incidentRepository.findByRouteCoordinates(
        originLat,
        originLng,
        destLat,
        destLng,
        radiusKm
      );

      return incidents
        .map((incident) => ({
          ...this.formatIncidentResponse(incident),
          distance_from_user_km: this.calculateDistance(
            originLat,
            originLng,
            incident.location.latitude,
            incident.location.longitude
          ),
        }))
        .sort((a, b) => {
          // Sort by severity first, then by distance
          const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
          const severityDiff =
            severityOrder[a.severity as keyof typeof severityOrder] -
            severityOrder[b.severity as keyof typeof severityOrder];
          if (severityDiff !== 0) return severityDiff;
          return (a.distance_from_user_km || 0) - (b.distance_from_user_km || 0);
        });
    } catch (error) {
      logger.error('Error fetching incidents for route:', error);
      throw error;
    }
  }

  /**
   * Fetch incidents by route name (e.g., "A1 Highway")
   */
  async getIncidentsByRouteName(routeName: string): Promise<IncidentResponse[]> {
    try {
      const incidents = await this.incidentRepository.findByRouteName(routeName);
      return incidents.map((incident) => this.formatIncidentResponse(incident));
    } catch (error) {
      logger.error('Error fetching incidents by route name:', error);
      throw error;
    }
  }

  /**
   * Get active incidents in a district
   */
  async getIncidentsByDistrict(district: string): Promise<IncidentResponse[]> {
    try {
      const incidents = await this.incidentRepository.findByDistrict(district);
      return incidents.map((incident) => this.formatIncidentResponse(incident));
    } catch (error) {
      logger.error('Error fetching incidents by district:', error);
      throw error;
    }
  }

  /**
   * Confirm/verify an incident
   */
  async confirmIncident(incidentId: string, userId: string): Promise<IncidentResponse> {
    try {
      const incident = await this.incidentRepository.confirmIncident(incidentId, userId);
      if (!incident) {
        throw new Error('Incident not found');
      }
      logger.info(`Incident ${incidentId} confirmed by user ${userId}`);
      return this.formatIncidentResponse(incident);
    } catch (error) {
      logger.error('Error confirming incident:', error);
      throw error;
    }
  }

  /**
   * Resolve an incident
   */
  async resolveIncident(
    incidentId: string,
    resolvedBy: string,
    notes?: string
  ): Promise<IncidentResponse> {
    try {
      const incident = await this.incidentRepository.resolve(incidentId, resolvedBy, notes);
      if (!incident) {
        throw new Error('Incident not found');
      }
      logger.info(`Incident ${incidentId} resolved by user ${resolvedBy}`);
      return this.formatIncidentResponse(incident);
    } catch (error) {
      logger.error('Error resolving incident:', error);
      throw error;
    }
  }

  /**
   * Get high-priority incidents
   */
  async getHighPriorityIncidents(limit: number = 10): Promise<IncidentResponse[]> {
    try {
      const incidents = await this.incidentRepository.findHighPriority(limit);
      return incidents.map((incident) => this.formatIncidentResponse(incident));
    } catch (error) {
      logger.error('Error fetching high-priority incidents:', error);
      throw error;
    }
  }

  /**
   * Get incident statistics
   */
  async getIncidentStatistics(): Promise<any> {
    try {
      const stats = await this.incidentRepository.getStatistics();
      return stats;
    } catch (error) {
      logger.error('Error fetching incident statistics:', error);
      throw error;
    }
  }

  /**
   * Get user's reported incidents
   */
  async getUserReportedIncidents(userId: string, limit: number = 50): Promise<IncidentResponse[]> {
    try {
      const incidents = await this.incidentRepository.findByReporterId(userId, limit);
      return incidents.map((incident) => this.formatIncidentResponse(incident));
    } catch (error) {
      logger.error('Error fetching user incidents:', error);
      throw error;
    }
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Format incident for response
   */
  private formatIncidentResponse(incident: IRoadIncident): IncidentResponse {
    return {
      id: (incident._id as any).toString(),
      incident_type: incident.incident_type,
      title: incident.title,
      description: incident.description,
      location: incident.location,
      severity: incident.severity,
      status: incident.status,
      verification_count: incident.verification.count,
      reported_at: incident.createdAt,
      estimated_delay_min: incident.impact_estimate?.estimated_delay_minutes,
    };
  }
}
