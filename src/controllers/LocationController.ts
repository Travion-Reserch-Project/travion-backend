/**
 * Location Controller
 * Handles HTTP requests for location data and images
 */

import { Request, Response, NextFunction } from 'express';
import { LocationService } from '../services/LocationService';

export class LocationController {
  /**
   * Get location images by name
   * GET /api/v1/locations/:name/images
   */
  getLocationImages = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { name } = req.params;

      const result = await LocationService.getLocationImages(name);

      res.status(200).json({
        success: true,
        message: 'Location images retrieved',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get multiple locations images
   * POST /api/v1/locations/images/bulk
   */
  getMultipleLocationImages = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { location_names } = req.body;

      if (!Array.isArray(location_names) || location_names.length === 0) {
        res.status(400).json({
          success: false,
          message: 'location_names array is required',
        });
        return;
      }

      const results = await LocationService.getMultipleLocationImages(location_names);

      // Convert Map to object for JSON response
      const data: Record<string, any> = {};
      results.forEach((value, key) => {
        data[key] = value;
      });

      res.status(200).json({
        success: true,
        message: 'Location images retrieved',
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get location by name
   * GET /api/v1/locations/:name
   */
  getLocationByName = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { name } = req.params;

      const result = await LocationService.getLocationByName(name);

      if (!result) {
        res.status(404).json({
          success: false,
          message: `Location not found: ${name}`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Location retrieved',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Search locations
   * GET /api/v1/locations/search?q=query&limit=10
   */
  searchLocations = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { q, limit } = req.query;

      if (!q || typeof q !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Search query (q) is required',
        });
        return;
      }

      const results = await LocationService.searchLocations(
        q,
        limit ? parseInt(limit as string, 10) : 10
      );

      res.status(200).json({
        success: true,
        message: 'Locations found',
        data: results,
        total: results.length,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get all locations (paginated)
   * GET /api/v1/locations?page=1&limit=20
   */
  getAllLocations = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { page, limit } = req.query;

      const result = await LocationService.getAllLocations(
        page ? parseInt(page as string, 10) : 1,
        limit ? parseInt(limit as string, 10) : 20
      );

      res.status(200).json({
        success: true,
        message: 'Locations retrieved',
        data: result.locations,
        pagination: {
          page: page ? parseInt(page as string, 10) : 1,
          limit: limit ? parseInt(limit as string, 10) : 20,
          total: result.total,
          pages: result.pages,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

export const locationController = new LocationController();
export default locationController;
