/**
 * SavedTrip Controller
 * HTTP request handlers for trip management endpoints
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { SavedTripService } from '../services/SavedTripService';
import { AppError } from '../middleware/errorHandler';

export class SavedTripController {
  private tripService: SavedTripService;

  constructor() {
    this.tripService = new SavedTripService();
  }

  // ============================================================================
  // CORE TRIP OPERATIONS
  // ============================================================================

  /**
   * Create a new trip
   * POST /trips
   */
  createTrip = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw new AppError('Unauthorized', 401);
      }

      const trip = await this.tripService.createTrip({
        userId: req.user.userId,
        ...req.body,
      });

      res.status(201).json({
        success: true,
        message: 'Trip created successfully',
        data: { trip },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get all trips for authenticated user
   * GET /trips
   */
  getTrips = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw new AppError('Unauthorized', 401);
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const { status, isPublic, generatedBy, tags } = req.query;

      const filters: Record<string, unknown> = {};
      if (status) filters.status = status;
      if (isPublic !== undefined) filters.isPublic = isPublic === 'true';
      if (generatedBy) filters.generatedBy = generatedBy;
      if (tags) filters.tags = (tags as string).split(',');

      const result = await this.tripService.getUserTrips(
        req.user.userId,
        page,
        limit,
        filters
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get trip by ID
   * GET /trips/:tripId
   */
  getTripById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw new AppError('Unauthorized', 401);
      }

      const trip = await this.tripService.getTripById(
        req.params.tripId,
        req.user.userId
      );

      res.status(200).json({
        success: true,
        data: { trip },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update trip
   * PUT /trips/:tripId
   */
  updateTrip = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw new AppError('Unauthorized', 401);
      }

      const trip = await this.tripService.updateTrip(
        req.params.tripId,
        req.user.userId,
        req.body
      );

      res.status(200).json({
        success: true,
        message: 'Trip updated successfully',
        data: { trip },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete trip
   * DELETE /trips/:tripId
   */
  deleteTrip = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw new AppError('Unauthorized', 401);
      }

      await this.tripService.deleteTrip(req.params.tripId, req.user.userId);

      res.status(200).json({
        success: true,
        message: 'Trip deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // STATUS OPERATIONS
  // ============================================================================

  /**
   * Update trip status
   * PATCH /trips/:tripId/status
   */
  updateStatus = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw new AppError('Unauthorized', 401);
      }

      const { status } = req.body;
      const trip = await this.tripService.updateTripStatus(
        req.params.tripId,
        req.user.userId,
        status
      );

      res.status(200).json({
        success: true,
        message: `Trip status updated to ${status}`,
        data: { trip },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get upcoming trips
   * GET /trips/upcoming
   */
  getUpcomingTrips = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw new AppError('Unauthorized', 401);
      }

      const trips = await this.tripService.getUpcomingTrips(req.user.userId);

      res.status(200).json({
        success: true,
        data: { trips },
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // ITINERARY OPERATIONS
  // ============================================================================

  /**
   * Add itinerary item
   * POST /trips/:tripId/itinerary
   */
  addItineraryItem = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw new AppError('Unauthorized', 401);
      }

      const trip = await this.tripService.addItineraryItem(
        req.params.tripId,
        req.user.userId,
        req.body
      );

      res.status(201).json({
        success: true,
        message: 'Itinerary item added',
        data: { trip },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update itinerary item
   * PUT /trips/:tripId/itinerary/:itemIndex
   */
  updateItineraryItem = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw new AppError('Unauthorized', 401);
      }

      const itemIndex = parseInt(req.params.itemIndex);
      const trip = await this.tripService.updateItineraryItem(
        req.params.tripId,
        req.user.userId,
        itemIndex,
        req.body
      );

      res.status(200).json({
        success: true,
        message: 'Itinerary item updated',
        data: { trip },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Remove itinerary item
   * DELETE /trips/:tripId/itinerary/:itemIndex
   */
  removeItineraryItem = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw new AppError('Unauthorized', 401);
      }

      const itemIndex = parseInt(req.params.itemIndex);
      const trip = await this.tripService.removeItineraryItem(
        req.params.tripId,
        req.user.userId,
        itemIndex
      );

      res.status(200).json({
        success: true,
        message: 'Itinerary item removed',
        data: { trip },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Reorder itinerary
   * PATCH /trips/:tripId/itinerary/reorder
   */
  reorderItinerary = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw new AppError('Unauthorized', 401);
      }

      const { newOrder } = req.body;
      const trip = await this.tripService.reorderItinerary(
        req.params.tripId,
        req.user.userId,
        newOrder
      );

      res.status(200).json({
        success: true,
        message: 'Itinerary reordered',
        data: { trip },
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // PUBLIC TRIPS OPERATIONS
  // ============================================================================

  /**
   * Get public trips
   * GET /trips/public
   */
  getPublicTrips = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const tags = req.query.tags ? (req.query.tags as string).split(',') : undefined;

      const result = await this.tripService.getPublicTrips(page, limit, tags);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Toggle trip visibility
   * PATCH /trips/:tripId/visibility
   */
  toggleVisibility = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw new AppError('Unauthorized', 401);
      }

      const trip = await this.tripService.togglePublic(
        req.params.tripId,
        req.user.userId
      );

      res.status(200).json({
        success: true,
        message: trip.isPublic ? 'Trip is now public' : 'Trip is now private',
        data: { trip },
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // RATING & UTILITY OPERATIONS
  // ============================================================================

  /**
   * Add rating and review
   * POST /trips/:tripId/rating
   */
  addRating = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw new AppError('Unauthorized', 401);
      }

      const { rating, review } = req.body;
      const trip = await this.tripService.addRating(
        req.params.tripId,
        req.user.userId,
        rating,
        review
      );

      res.status(200).json({
        success: true,
        message: 'Rating added successfully',
        data: { trip },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Duplicate trip
   * POST /trips/:tripId/duplicate
   */
  duplicateTrip = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw new AppError('Unauthorized', 401);
      }

      const trip = await this.tripService.duplicateTrip(
        req.params.tripId,
        req.user.userId
      );

      res.status(201).json({
        success: true,
        message: 'Trip duplicated successfully',
        data: { trip },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Search trips
   * GET /trips/search
   */
  searchTrips = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw new AppError('Unauthorized', 401);
      }

      const { q, limit } = req.query;
      if (!q) {
        throw new AppError('Search query is required', 400);
      }

      const trips = await this.tripService.searchTrips(
        req.user.userId,
        q as string,
        parseInt(limit as string) || 10
      );

      res.status(200).json({
        success: true,
        data: { trips },
      });
    } catch (error) {
      next(error);
    }
  };
}
