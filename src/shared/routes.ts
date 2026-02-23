import { Router } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import authRoutes from '../modules/auth/api/routes/authRoutes';
import userRoutes from '../modules/auth/api/routes/userRoutes';
import { chatbotRoutes } from '../modules/transport/api/routes/chatbotRoutes';

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

export default router;
