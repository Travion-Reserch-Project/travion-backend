import { Router } from 'express';
import { ChatController } from '../controllers/ChatController';
import { TimetableController } from '../controllers/TimetableController';
import { authenticate } from '../middleware/auth';
import { chatLimiter, feedbackLimiter } from '../config/rateLimiter';
import { logger } from '../config/logger';
import {
  chatQueryValidator,
  chatFeedbackValidator,
  sessionFeedbackValidator,
  endSessionValidator,
  chatHistoryValidator,
  analyticsValidator,
  travelRecommendationValidator,
  timetableQueryValidator,
} from '../validators/chatValidator';

const router = Router();
const chatController = new ChatController();
const timetableController = new TimetableController();

// Get timetable data for a service (PUBLIC - no auth required)
router.get(
  '/timetable',
  (req: any, _res: any, next: any) => {
    logger.info('timetable route: before validation', {
      query: req.query,
      queryKeys: Object.keys(req.query),
    });
    next();
  },
  timetableQueryValidator,
  (req: any, _res: any, next: any) => {
    logger.info('timetable route: after validation', { query: req.query });
    next();
  },
  timetableController.getTimetable
);

// Apply authentication middleware to all other chat routes
router.use(authenticate as any);

// Main chat query endpoint
router.post('/query', chatLimiter, chatQueryValidator, chatController.processQuery);

// Travel recommendation via LLM extraction
router.post(
  '/recommend',
  chatLimiter,
  travelRecommendationValidator,
  chatController.getTravelRecommendation
);

// Submit feedback for a specific query
router.post('/feedback', feedbackLimiter, chatFeedbackValidator, chatController.submitFeedback);

// Submit feedback for a session
router.post(
  '/session/feedback',
  feedbackLimiter,
  sessionFeedbackValidator,
  chatController.submitSessionFeedback
);

// End a chat session
router.post('/session/end', endSessionValidator, chatController.endSession);

// Get chat history
router.get('/history', chatHistoryValidator, chatController.getChatHistory);

// Get chat analytics
router.get('/analytics', analyticsValidator, chatController.getAnalytics);

// Health check for ML service
router.get('/health', chatController.healthCheck);

// Data export endpoints (consider adding admin role check)
router.get('/export/training-data', chatController.exportTrainingData);

router.get('/export/stats', chatController.getTrainingDataStats);

export { router as chatRoutes };
