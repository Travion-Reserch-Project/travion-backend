import { Router } from 'express';
import authRoutes from './authRoutes';
import userRoutes from './userRoutes';

const router = Router();

// Root API endpoint
router.get('/', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Travion Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/api/1/health',
      auth: '/api/1/auth',
      users: '/api/1/users',
    },
    timestamp: new Date().toISOString(),
  });
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

export default router;
