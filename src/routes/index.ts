import { Router } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import authRoutes from './authRoutes';
import userRoutes from './userRoutes';
import aiEngineRoutes from './aiEngineRoutes';
import userPreferencesRoutes from './userPreferencesRoutes';
import savedTripRoutes from './savedTripRoutes';
import chatSessionRoutes from './chatSessionRoutes';
import locationRoutes from './locationRoutes';
import tourPlanRoutes from './tourPlanRoutes';

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
router.use('/ai', aiEngineRoutes);
router.use('/preferences', userPreferencesRoutes);
router.use('/trips', savedTripRoutes);
router.use('/chat', chatSessionRoutes);
router.use('/locations', locationRoutes);
router.use('/tour-plan', tourPlanRoutes);

export default router;
