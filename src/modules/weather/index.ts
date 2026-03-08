/**
 * Weather Module
 * Handles weather information, health profiles, and weather-based recommendations
 */

// Export routes
export { default as weatherRoutes } from './api/routes/weatherRoutes';
export { default as healthProfileRoutes } from './api/routes/HealthProfileRoutes';

// Export controllers (function exports)
export { getWeatherData } from './api/controllers/WeatherController';
export {
  createHealthProfile,
  getHealthProfileByUserId,
  updateHealthProfile,
  updateSkinTypeWithHistory,
  deleteHealthProfile,
} from './api/controllers/HealthProfileController';

// Export models
export { default as HealthProfile } from './domain/models/HealthProfile';
