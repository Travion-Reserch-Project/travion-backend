import { Response, NextFunction } from 'express';
import { IncidentService } from '../../domain/services/IncidentService';
import { AuthRequest } from '../../../../shared/middleware/auth';
import { logger } from '../../../../shared/config/logger';

export class IncidentController {
  private incidentService: IncidentService;

  constructor() {
    this.incidentService = new IncidentService();
  }

  /**
   * Report a new road incident
   * @route POST /api/v1/incidents/report
   */
  reportIncident = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
        return;
      }

      const {
        incident_type,
        title,
        description,
        location,
        severity,
        affected_routes,
        attachments,
      } = req.body;

      const incident = await this.incidentService.reportIncident({
        reporter_id: userId,
        incident_type,
        title,
        description,
        location,
        severity,
        affected_routes,
        attachments,
      });

      res.status(201).json({
        success: true,
        message: 'Incident reported successfully',
        data: incident,
      });
    } catch (error) {
      logger.error('Error in reportIncident:', error);
      next(error);
    }
  };

  /**
   * Get incidents near user's location
   * @route GET /api/v1/incidents/near-location
   */
  getIncidentsNearLocation = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { latitude, longitude, radius_km } = req.query;

      if (!latitude || !longitude) {
        res.status(400).json({
          success: false,
          message: 'latitude and longitude are required',
        });
        return;
      }

      const lat = parseFloat(latitude as string);
      const lon = parseFloat(longitude as string);
      const radius = radius_km ? parseFloat(radius_km as string) : 5;

      const incidents = await this.incidentService.getIncidentsNearLocation(lat, lon, radius);

      res.status(200).json({
        success: true,
        data: {
          incidents,
          count: incidents.length,
          center: { latitude: lat, longitude: lon },
          radius_km: radius,
        },
      });
    } catch (error) {
      logger.error('Error in getIncidentsNearLocation:', error);
      next(error);
    }
  };

  /**
   * Get incidents affecting a route by coordinates
   * @route GET /api/v1/incidents/route
   */
  getIncidentsForRoute = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { origin_lat, origin_lng, dest_lat, dest_lng, radius_km } = req.query;

      if (!origin_lat || !origin_lng || !dest_lat || !dest_lng) {
        res.status(400).json({
          success: false,
          message: 'origin_lat, origin_lng, dest_lat, and dest_lng are required',
        });
        return;
      }

      const originLat = parseFloat(origin_lat as string);
      const originLng = parseFloat(origin_lng as string);
      const destLat = parseFloat(dest_lat as string);
      const destLng = parseFloat(dest_lng as string);
      const radius = radius_km ? parseFloat(radius_km as string) : 10;

      const incidents = await this.incidentService.getIncidentsForRoute(
        originLat,
        originLng,
        destLat,
        destLng,
        radius
      );

      res.status(200).json({
        success: true,
        data: {
          incidents,
          count: incidents.length,
          route: {
            origin: { latitude: originLat, longitude: originLng },
            destination: { latitude: destLat, longitude: destLng },
          },
        },
      });
    } catch (error) {
      logger.error('Error in getIncidentsForRoute:', error);
      next(error);
    }
  };

  /**
   * Get incidents by route name (e.g., "A1 Highway")
   * @route GET /api/v1/incidents/route-name/:routeName
   */
  getIncidentsByRouteName = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { routeName } = req.params;

      const incidents = await this.incidentService.getIncidentsByRouteName(routeName);

      res.status(200).json({
        success: true,
        data: {
          incidents,
          count: incidents.length,
          route_name: routeName,
        },
      });
    } catch (error) {
      logger.error('Error in getIncidentsByRouteName:', error);
      next(error);
    }
  };

  /**
   * Get incidents in a district
   * @route GET /api/v1/incidents/district/:district
   */
  getIncidentsByDistrict = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { district } = req.params;

      const incidents = await this.incidentService.getIncidentsByDistrict(district);

      res.status(200).json({
        success: true,
        data: {
          incidents,
          count: incidents.length,
          district,
        },
      });
    } catch (error) {
      logger.error('Error in getIncidentsByDistrict:', error);
      next(error);
    }
  };

  /**
   * Confirm/verify an incident
   * @route POST /api/v1/incidents/:incidentId/confirm
   */
  confirmIncident = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
        return;
      }

      const { incidentId } = req.params;

      const incident = await this.incidentService.confirmIncident(incidentId, userId);

      res.status(200).json({
        success: true,
        message: 'Incident confirmed successfully',
        data: incident,
      });
    } catch (error) {
      logger.error('Error in confirmIncident:', error);
      next(error);
    }
  };

  /**
   * Resolve an incident
   * @route POST /api/v1/incidents/:incidentId/resolve
   */
  resolveIncident = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
        return;
      }

      const { incidentId } = req.params;
      const { resolution_notes } = req.body;

      const incident = await this.incidentService.resolveIncident(
        incidentId,
        userId,
        resolution_notes
      );

      res.status(200).json({
        success: true,
        message: 'Incident resolved successfully',
        data: incident,
      });
    } catch (error) {
      logger.error('Error in resolveIncident:', error);
      next(error);
    }
  };

  /**
   * Get high-priority incidents
   * @route GET /api/v1/incidents/priority/high
   */
  getHighPriorityIncidents = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { limit } = req.query;
      const limitNum = limit ? parseInt(limit as string, 10) : 10;

      const incidents = await this.incidentService.getHighPriorityIncidents(limitNum);

      res.status(200).json({
        success: true,
        data: {
          incidents,
          count: incidents.length,
        },
      });
    } catch (error) {
      logger.error('Error in getHighPriorityIncidents:', error);
      next(error);
    }
  };

  /**
   * Get incident statistics
   * @route GET /api/v1/incidents/statistics
   */
  getIncidentStatistics = async (
    _req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const stats = await this.incidentService.getIncidentStatistics();

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Error in getIncidentStatistics:', error);
      next(error);
    }
  };

  /**
   * Get user's reported incidents
   * @route GET /api/v1/incidents/my-reports
   */
  getUserReportedIncidents = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
        return;
      }

      const { limit } = req.query;
      const limitNum = limit ? parseInt(limit as string, 10) : 50;

      const incidents = await this.incidentService.getUserReportedIncidents(userId, limitNum);

      res.status(200).json({
        success: true,
        data: {
          incidents,
          count: incidents.length,
        },
      });
    } catch (error) {
      logger.error('Error in getUserReportedIncidents:', error);
      next(error);
    }
  };
}
