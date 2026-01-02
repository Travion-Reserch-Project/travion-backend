/**
 * Location Routes
 * Routes for location data and images - Public access (no auth required)
 */

import { Router } from 'express';
import { locationController } from '../controllers/LocationController';

const router = Router();

/**
 * @route   GET /api/v1/locations/search
 * @desc    Search locations by name
 * @access  Public
 * @query   q - Search query (required)
 * @query   limit - Max results (default: 10)
 */
router.get('/search', locationController.searchLocations);

/**
 * @route   POST /api/v1/locations/images/bulk
 * @desc    Get images for multiple locations
 * @access  Public
 * @body    { location_names: string[] }
 */
router.post('/images/bulk', locationController.getMultipleLocationImages);

/**
 * @route   GET /api/v1/locations/:name/images
 * @desc    Get images for a specific location
 * @access  Public
 */
router.get('/:name/images', locationController.getLocationImages);

/**
 * @route   GET /api/v1/locations/:name
 * @desc    Get location details by name
 * @access  Public
 */
router.get('/:name', locationController.getLocationByName);

/**
 * @route   GET /api/v1/locations
 * @desc    Get all locations (paginated)
 * @access  Public
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 20)
 */
router.get('/', locationController.getAllLocations);

export default router;
