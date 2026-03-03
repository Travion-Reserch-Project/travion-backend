import { Router } from 'express';
import { getWeatherData, predictSunRisk } from '../controllers/WeatherController';
import { authenticate } from '../../../../shared/middleware';

const router = Router();

// GET /api/v1/weather?lat=LAT&lon=LON
router.get('/', getWeatherData);

// POST /api/v1/weather/predict
router.post('/predict', authenticate, predictSunRisk);
export default router;
