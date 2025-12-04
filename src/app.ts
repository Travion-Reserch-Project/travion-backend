import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import 'express-async-errors';
import config from './config/config';
import { connectDatabase } from './config/database';
import { logger, stream } from './config/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger, responseLogger } from './middleware/logger';
import routes from './routes';
import { apiLimiter, authLimiter } from './config/rateLimiter';
import {
  helmetConfig,
  corsConfig,
  bodyParserConfig,
  mongoSanitizeConfig,
  hppWhitelist,
} from './config/security';

class App {
  public app: Application;

  constructor() {
    this.app = express();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    // Trust proxy
    this.app.set('trust proxy', 1);

    // Security middleware
    this.app.use(helmet(helmetConfig));

    // CORS configuration
    this.app.use(
      cors({
        origin: config.cors.origin,
        credentials: corsConfig.credentials,
        methods: corsConfig.methods,
        allowedHeaders: corsConfig.allowedHeaders,
        exposedHeaders: corsConfig.exposedHeaders,
        maxAge: corsConfig.maxAge,
      })
    );

    // Body parser with size limits - MOVED BEFORE rate limiting
    this.app.use(express.json({ limit: bodyParserConfig.jsonLimit }));
    this.app.use(
      express.urlencoded({
        extended: true,
        limit: bodyParserConfig.urlEncodedLimit,
      })
    );

    // Rate limiting for all API routes
    this.app.use('/api/', apiLimiter);

    // Stricter rate limiting for auth routes - Fixed pattern
    this.app.use('/api/v1/auth', authLimiter);

    // Cookie parser
    this.app.use(cookieParser());

    // Data sanitization against NoSQL injection
    this.app.use(mongoSanitize(mongoSanitizeConfig));

    // Prevent HTTP parameter pollution
    this.app.use(
      hpp({
        whitelist: hppWhitelist,
      })
    );

    // Compression middleware - compress responses
    this.app.use(
      compression({
        filter: (req, res) => {
          if (req.headers['x-no-compression']) {
            return false;
          }
          return compression.filter(req, res);
        },
        level: 6, // Compression level (0-9)
      })
    );

    // HTTP request logger - Morgan
    if (config.env === 'development') {
      this.app.use(morgan('dev'));
    } else {
      // Use Winston for production logging
      this.app.use(morgan('combined', { stream }));
    }

    // Custom logging middleware
    this.app.use(requestLogger);
    this.app.use(responseLogger);
  }

  private initializeRoutes(): void {
    // API routes
    this.app.use(`/api/${config.apiVersion}`, routes);
  }

  private initializeErrorHandling(): void {
    // 404 handler
    this.app.use(notFoundHandler);

    // Global error handler
    this.app.use(errorHandler);
  }

  public async start(): Promise<void> {
    try {
      // Connect to database
      await connectDatabase();

      // Start server
      this.app.listen(config.port, () => {
        logger.info(`Server is running on port ${config.port} in ${config.env} mode`);
        logger.info(`API endpoint: http://localhost:${config.port}/api/${config.apiVersion}`);
      });
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

export default App;
//dummy commit
//dummy commit
