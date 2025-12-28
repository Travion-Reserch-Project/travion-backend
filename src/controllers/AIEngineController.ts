/**
 * AI Engine Controller
 * Handles HTTP requests for AI Engine API endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { AIEngineService } from '../services/AIEngineService';
import { AuthRequest } from '../middleware/auth';

export class AIEngineController {
  private aiEngineService: AIEngineService;

  constructor() {
    this.aiEngineService = new AIEngineService();
  }

  // ============================================================================
  // CHAT API
  // ============================================================================

  /**
   * Send a message to the agentic chat system
   * POST /api/v1/ai/chat
   */
  chat = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { message, threadId, context } = req.body;

      const result = await this.aiEngineService.chat(message, threadId, context);

      res.status(200).json({
        success: true,
        message: 'Chat response generated',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // RECOMMENDATION API
  // ============================================================================

  /**
   * Get personalized location recommendations
   * POST /api/v1/ai/recommend
   */
  getRecommendations = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await this.aiEngineService.getRecommendations(req.body);

      res.status(200).json({
        success: true,
        message: 'Recommendations retrieved',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get explanation for a location
   * GET /api/v1/ai/explain/:location
   */
  getExplanation = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { location } = req.params;
      const { user_lat, user_lng } = req.query;

      const result = await this.aiEngineService.getExplanation(
        location,
        user_lat ? parseFloat(user_lat as string) : undefined,
        user_lng ? parseFloat(user_lng as string) : undefined
      );

      res.status(200).json({
        success: true,
        message: 'Location explanation retrieved',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get nearby locations
   * GET /api/v1/ai/locations/nearby
   */
  getNearbyLocations = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { lat, lng, top_k, max_distance_km } = req.query;

      const result = await this.aiEngineService.getNearbyLocations({
        lat: parseFloat(lat as string),
        lng: parseFloat(lng as string),
        top_k: top_k ? parseInt(top_k as string, 10) : undefined,
        max_distance_km: max_distance_km ? parseFloat(max_distance_km as string) : undefined,
      });

      res.status(200).json({
        success: true,
        message: 'Nearby locations retrieved',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // CROWDCAST API
  // ============================================================================

  /**
   * Get crowd prediction for a location
   * POST /api/v1/ai/crowd
   */
  getCrowdPrediction = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await this.aiEngineService.getCrowdPrediction(req.body);

      res.status(200).json({
        success: true,
        message: 'Crowd prediction retrieved',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // EVENT SENTINEL API
  // ============================================================================

  /**
   * Get event/holiday impact analysis
   * POST /api/v1/ai/events/impact
   */
  getEventImpact = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await this.aiEngineService.getEventImpact(req.body);

      res.status(200).json({
        success: true,
        message: 'Event impact analysis retrieved',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Check holiday status for a date
   * GET /api/v1/ai/events/check-holiday
   */
  checkHoliday = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { location_name, target_date } = req.query;

      const result = await this.aiEngineService.checkHoliday(
        location_name as string,
        target_date as string
      );

      res.status(200).json({
        success: true,
        message: 'Holiday check completed',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // GOLDEN HOUR / PHYSICS API
  // ============================================================================

  /**
   * Get golden hour calculation by coordinates
   * POST /api/v1/ai/physics/golden-hour
   */
  getGoldenHour = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await this.aiEngineService.getGoldenHour(req.body);

      res.status(200).json({
        success: true,
        message: 'Golden hour data retrieved',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get golden hour by location name
   * GET /api/v1/ai/physics/golden-hour/:location
   */
  getGoldenHourByLocation = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { location } = req.params;
      const { date, include_current_position } = req.query;

      const result = await this.aiEngineService.getGoldenHourByLocation(
        location,
        date as string | undefined,
        include_current_position === 'true'
      );

      res.status(200).json({
        success: true,
        message: 'Golden hour data retrieved',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get current sun position
   * GET /api/v1/ai/physics/sun-position
   */
  getSunPosition = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { latitude, longitude, elevation_m } = req.query;

      const result = await this.aiEngineService.getSunPosition({
        latitude: parseFloat(latitude as string),
        longitude: parseFloat(longitude as string),
        elevation_m: elevation_m ? parseFloat(elevation_m as string) : undefined,
      });

      res.status(200).json({
        success: true,
        message: 'Sun position retrieved',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get current light quality
   * GET /api/v1/ai/physics/light-quality
   */
  getCurrentLightQuality = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { latitude, longitude } = req.query;

      const result = await this.aiEngineService.getCurrentLightQuality(
        parseFloat(latitude as string),
        parseFloat(longitude as string)
      );

      res.status(200).json({
        success: true,
        message: 'Light quality retrieved',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // HEALTH CHECK API
  // ============================================================================

  /**
   * Check AI Engine health status
   * GET /api/v1/ai/health
   */
  checkHealth = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await this.aiEngineService.checkHealth();

      res.status(200).json({
        success: true,
        message: 'AI Engine health check completed',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get AI Engine graph visualization
   * GET /api/v1/ai/graph
   */
  getGraph = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await this.aiEngineService.getGraph();

      res.status(200).json({
        success: true,
        message: 'AI Engine graph retrieved',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Check if AI Engine is available
   * GET /api/v1/ai/status
   */
  checkAvailability = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const isAvailable = await this.aiEngineService.isAvailable();

      res.status(200).json({
        success: true,
        message: isAvailable ? 'AI Engine is available' : 'AI Engine is unavailable',
        data: { available: isAvailable },
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // CONVENIENCE METHODS
  // ============================================================================

  /**
   * Get comprehensive location info
   * GET /api/v1/ai/location-info/:location
   */
  getLocationInfo = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { location } = req.params;
      const { target_date, user_lat, user_lng } = req.query;

      const userLocation =
        user_lat && user_lng
          ? {
              latitude: parseFloat(user_lat as string),
              longitude: parseFloat(user_lng as string),
            }
          : undefined;

      const result = await this.aiEngineService.getLocationInfo(
        location,
        target_date as string | undefined,
        userLocation
      );

      res.status(200).json({
        success: true,
        message: 'Location info retrieved',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get optimal visit time for a location
   * GET /api/v1/ai/optimal-visit-time/:location
   */
  getOptimalVisitTime = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { location } = req.params;
      const { location_type, target_date } = req.query;

      const result = await this.aiEngineService.getOptimalVisitTime(
        location,
        location_type as string,
        target_date as string
      );

      res.status(200).json({
        success: true,
        message: 'Optimal visit time retrieved',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
