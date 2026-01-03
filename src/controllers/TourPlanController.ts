/**
 * Tour Plan Controller
 * Handles AI-powered tour plan generation requests
 */

import { Request, Response, NextFunction } from 'express';
import { AIEngineService } from '../services/AIEngineService';
import { SavedTripService } from '../services/SavedTripService';
import { logger } from '../config/logger';
import { AppError } from '../middleware/errorHandler';
import type { SelectedLocation } from '../types/aiEngine';

const aiEngineService = new AIEngineService();
const savedTripService = new SavedTripService();

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email?: string;
  };
}

export class TourPlanController {
  /**
   * Generate an AI-powered tour plan
   * POST /tour-plan/generate
   */
  generatePlan = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }

      const { selectedLocations, startDate, endDate, preferences, message } = req.body;

      logger.info(`User ${userId} generating tour plan for ${selectedLocations.length} locations`);

      // Transform locations to AI Engine format
      const locations: SelectedLocation[] = selectedLocations.map((loc: {
        name: string;
        latitude: number;
        longitude: number;
        imageUrl?: string;
        distance_km?: number;
      }) => ({
        name: loc.name,
        latitude: loc.latitude,
        longitude: loc.longitude,
        image_url: loc.imageUrl,
        distance_km: loc.distance_km,
      }));

      // Call AI Engine to generate plan
      const response = await aiEngineService.generateTourPlan(
        locations,
        startDate,
        endDate,
        undefined, // threadId will be generated
        preferences,
        message
      );

      logger.info(`Tour plan generated successfully with thread ${response.thread_id}`);

      res.status(200).json({
        success: true,
        data: {
          threadId: response.thread_id,
          response: response.response,
          itinerary: response.itinerary,
          metadata: response.metadata,
          constraints: response.constraints,
          warnings: response.warnings,
          tips: response.tips,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Refine an existing tour plan
   * POST /tour-plan/refine
   */
  refinePlan = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }

      const { threadId, message, selectedLocations, startDate, endDate, preferences } = req.body;

      logger.info(`User ${userId} refining tour plan with thread ${threadId}`);

      // Transform locations to AI Engine format
      const locations: SelectedLocation[] = selectedLocations.map((loc: {
        name: string;
        latitude: number;
        longitude: number;
        imageUrl?: string;
        distance_km?: number;
      }) => ({
        name: loc.name,
        latitude: loc.latitude,
        longitude: loc.longitude,
        image_url: loc.imageUrl,
        distance_km: loc.distance_km,
      }));

      // Call AI Engine to refine plan
      const response = await aiEngineService.refineTourPlan(
        threadId,
        message,
        locations,
        startDate,
        endDate,
        preferences
      );

      logger.info(`Tour plan refined successfully`);

      res.status(200).json({
        success: true,
        data: {
          threadId: response.thread_id,
          response: response.response,
          itinerary: response.itinerary,
          metadata: response.metadata,
          constraints: response.constraints,
          warnings: response.warnings,
          tips: response.tips,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Accept and save a generated tour plan
   * POST /tour-plan/accept
   */
  acceptPlan = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }

      const { threadId, title, description, itinerary, metadata } = req.body;

      logger.info(`User ${userId} accepting tour plan from thread ${threadId}`);

      // Extract unique destinations from itinerary
      const locationSet = new Set<string>();
      itinerary.forEach((item: { location: string }) => locationSet.add(item.location));
      const destinations: string[] = Array.from(locationSet);

      // Extract date range from itinerary
      const days = itinerary.map((item: { day?: number }) => item.day || 1);
      const minDay = Math.min(...days);
      const maxDay = Math.max(...days);
      
      // Calculate start and end dates
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + (maxDay - minDay));

      // Create saved trip from the plan
      const savedTrip = await savedTripService.createTrip({
        userId,
        title,
        description,
        destinations,
        startDate,
        endDate,
        itinerary: itinerary.map((item: {
          time: string;
          location: string;
          activity: string;
          duration_minutes: number;
          crowd_prediction?: number;
          lighting_quality?: string;
          notes?: string;
          day?: number;
          order?: number;
        }, index: number) => ({
          order: item.order ?? index,
          time: item.time,
          locationName: item.location,
          activity: item.activity,
          durationMinutes: item.duration_minutes,
          notes: item.notes,
          crowdPrediction: item.crowd_prediction,
          lightingQuality: item.lighting_quality,
        })),
        generatedBy: 'ai',
        aiMetadata: {
          sessionId: threadId,
          generatedAt: new Date(),
          ...metadata,
        },
      });

      logger.info(`Tour plan saved as trip ${savedTrip._id}`);

      res.status(201).json({
        success: true,
        data: {
          tripId: savedTrip._id,
          message: 'Tour plan saved successfully',
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get tour plan session details
   * GET /tour-plan/session/:threadId
   */
  getSession = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }

      const { threadId } = req.params;

      // For now, return a placeholder response
      // In the future, we could store session data in the database
      res.status(200).json({
        success: true,
        data: {
          threadId,
          status: 'active',
          message: 'Session is active. You can continue refining the plan.',
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
