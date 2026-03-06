import { Router } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import authRoutes from '../modules/auth/api/routes/authRoutes';
import userRoutes from '../modules/auth/api/routes/userRoutes';
import { chatbotRoutes } from '../modules/transport/api/routes/chatbotRoutes';
import { incidentRoutes } from '../modules/transport/api/routes/incidentRoutes';
import { safetyRoutes } from '../modules/safety/api/routes/safetyRoutes';
import { incidentReportRoutes } from '../modules/safety/api/routes/incidentReportRoutes';
import { pushNotificationRoutes } from '../modules/safety/api/routes/pushNotificationRoutes';
import weatherRoutes from '../modules/weather/api/routes/weatherRoutes';
import healthRoutes from '../modules/weather/api/routes/HealthProfileRoutes';
import aiEngineRoutes from '../modules/tour-agent/api/routes/aiEngineRoutes';
import userPreferencesRoutes from '../modules/tour-agent/api/routes/userPreferencesRoutes';
import savedTripRoutes from '../modules/tour-agent/api/routes/savedTripRoutes';
import chatSessionRoutes from '../modules/tour-agent/api/routes/chatSessionRoutes';
import locationRoutes from '../modules/tour-agent/api/routes/locationRoutes';
import tourPlanRoutes from '../modules/tour-agent/api/routes/tourPlanRoutes';

const router = Router();

// Load HTML template
const apiLandingTemplate = readFileSync(join(__dirname, '../templates/apiLanding.html'), 'utf-8');

// Root API endpoint with beautiful HTML template
router.get('/', (_req, res) => {
  const html = apiLandingTemplate.replace('{{TIMESTAMP}}', new Date().toISOString());
  res.status(200).send(html);
});

// Health check endpoint
router.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

// API routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/chatbot', chatbotRoutes);
router.use('/incidents', incidentRoutes);
router.use('/safety', safetyRoutes);
router.use('/incidents', incidentReportRoutes);
router.use('/push-notifications', pushNotificationRoutes);
router.use('/healthProfile', healthRoutes);
router.use('/weather', weatherRoutes);
router.use('/ai', aiEngineRoutes);
router.use('/preferences', userPreferencesRoutes);
router.use('/trips', savedTripRoutes);
router.use('/chat', chatSessionRoutes);
router.use('/locations', locationRoutes);
router.use('/tour-plan', tourPlanRoutes);

export default router;
