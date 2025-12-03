import App from './app';
import { logger } from './config/logger';
import { loadInfisicalSecrets } from './config/infisical';

async function startServer() {
  try {
    if (process.env.INFISICAL_CLIENT_ID && process.env.INFISICAL_CLIENT_SECRET) {
      logger.info('🔐 Loading secrets from Infisical...');

      await loadInfisicalSecrets(
        process.env.INFISICAL_PROJECT_ID!,
        process.env.INFISICAL_ENVIRONMENT || 'dev',
        process.env.INFISICAL_SECRET_PATH || '/'
      );

      logger.info('✅ Secrets loaded from Infisical successfully');
    } else {
      logger.info('📝 Using local .env file (Infisical not configured)');
    }

    const app = new App();
    app.start();
  } catch (error) {
    logger.error('❌ Failed to load secrets from Infisical, falling back to .env:', error);
    logger.info('📝 Using local .env file as fallback');

    const app = new App();
    app.start();
  }
}

// Start server
startServer();

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: Error) => {
  logger.error('Unhandled Rejection:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});
//dummy commit
