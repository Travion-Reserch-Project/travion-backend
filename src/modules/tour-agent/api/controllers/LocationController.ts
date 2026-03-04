/**
 * Location Controller
 * Handles HTTP requests for location data and images
 */

import { Request, Response, NextFunction } from 'express';
import { LocationService } from '../../domain/services/LocationService';

// Browser-like User-Agent for Wikimedia image fetching
// Wikimedia blocks non-browser User-Agents (returns 403)
const WIKIMEDIA_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

export class LocationController {
  /**
   * Get location images by name
   * GET /api/v1/locations/:name/images
   */
  getLocationImages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
      results.forEach((value: any, key: string) => {
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
  getLocationByName = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
  searchLocations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

      console.log(`Search query: "${q}", Results found: ${results.length}`);
      console.log('Sample search results:', results);

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
   * Proxy an image from Wikimedia (or any external URL)
   * GET /api/v1/locations/image-proxy?url=<encoded_url>
   *
   * This endpoint fetches external images (primarily Wikimedia) with
   * a browser-like User-Agent and streams them to the client.
   * Wikimedia blocks non-browser User-Agents with 403 Forbidden,
   * so this proxy ensures images always load in mobile apps.
   */
  imageProxy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { url } = req.query;

      if (!url || typeof url !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Image URL (url) query parameter is required',
        });
        return;
      }

      // Only allow proxying from trusted domains
      const allowedDomains = [
        'upload.wikimedia.org',
        'commons.wikimedia.org',
        'en.wikipedia.org',
        'images.unsplash.com',
      ];

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch {
        res.status(400).json({
          success: false,
          message: 'Invalid URL provided',
        });
        return;
      }

      if (!allowedDomains.some((domain) => parsedUrl.hostname.endsWith(domain))) {
        res.status(403).json({
          success: false,
          message: 'Domain not allowed for proxying',
        });
        return;
      }

      // Fetch image from the external URL with browser-like User-Agent
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(url, {
        headers: {
          'User-Agent': WIKIMEDIA_USER_AGENT,
          Accept: 'image/*,*/*;q=0.8',
        },
        redirect: 'follow',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        res.status(response.status).json({
          success: false,
          message: `Failed to fetch image: ${response.statusText}`,
        });
        return;
      }

      // Forward content type and cache headers
      const contentType = response.headers.get('content-type');
      if (contentType) {
        res.setHeader('Content-Type', contentType);
      }

      // Cache images for 24 hours
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');

      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }

      // Stream the response body
      if (response.body) {
        const reader = response.body.getReader();
        const pump = async (): Promise<void> => {
          const { done, value } = await reader.read();
          if (done) {
            res.end();
            return;
          }
          res.write(Buffer.from(value));
          return pump();
        };
        await pump();
      } else {
        // Fallback for environments without ReadableStream
        const arrayBuffer = await response.arrayBuffer();
        res.send(Buffer.from(arrayBuffer));
      }
    } catch (error) {
      console.error('Image proxy error:', error);
      next(error);
    }
  };

  /**
   * Get all locations (paginated)
   * GET /api/v1/locations?page=1&limit=20
   */
  getAllLocations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
