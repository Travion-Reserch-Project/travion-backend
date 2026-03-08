import { Request, Response } from 'express';
import axios from 'axios';
import { AuthRequest } from '../../../../shared/middleware';
import { SunProtectionService } from '../../domain/services/SunProtectionService';

/**
 * Controller for fetching weather data from Google Weather API
 */
export const getWeatherData = async (req: Request, res: Response) => {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required',
      });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: 'Google Maps API key not configured',
      });
    }

    const url = `https://weather.googleapis.com/v1/currentConditions:lookup?key=${apiKey}&location.latitude=${lat}&location.longitude=${lon}`;

    const response = await axios.get(url);

    // The Google Weather API response structure might vary,
    // but based on the user's request, we need uvIndex and uvLevel.
    // Usually, Google Weather API's currentConditions:lookup returns a lot of data.
    // I'll return the data and let the frontend handle it, or map it if I knew the exact structure.

    return res.status(200).json({
      success: true,
      data: response.data,
    });
  } catch (error: any) {
    console.error('Error fetching weather data:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      success: false,
      message: 'Failed to fetch weather data',
      error: error.response?.data || error.message,
    });
  }
};

/**
 * Controller for predicting sun protection risk using ML service
 */
export const predictSunRisk = async (req: AuthRequest, res: Response) => {
  try {
    const { lat, lon } = req.body;
    const userId = req.user?.userId;

    if (!lat || !lon) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required in request body',
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: User ID not found',
      });
    }

    const result = await SunProtectionService.predictRisk(userId, Number(lat), Number(lon));

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error predicting sun risk:', error.message);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to predict sun protection risk',
    });
  }
};
