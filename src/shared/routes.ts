import { Router } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import authRoutes from '../modules/auth/api/routes/authRoutes';
import userRoutes from '../modules/auth/api/routes/userRoutes';
import { chatbotRoutes } from '../modules/transport/api/routes/chatbotRoutes';
import { safetyRoutes } from '../modules/safety/api/routes/safetyRoutes';
import { incidentReportRoutes } from '../modules/safety/api/routes/incidentReportRoutes';
import weatherRoutes from '../modules/weather/api/routes/weatherRoutes';
import healthRoutes from '../modules/weather/api/routes/HealthProfileRoutes';

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
router.use('/safety', safetyRoutes);
router.use('/incidents', incidentReportRoutes);
router.use('/healthProfile', healthRoutes);
router.use('/weather', weatherRoutes);

export default router;
