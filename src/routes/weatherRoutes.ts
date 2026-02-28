import { Router } from 'express';
import { getWeatherData } from '../controllers/WeatherController';

const router = Router();

// GET /api/v1/weather?lat=LAT&lon=LON
router.get('/', getWeatherData);

export default router;
