/**
 * Auth Module
 * Handles user authentication, authorization, and user management
 */

// Export routes
export { default as authRoutes } from './api/routes/authRoutes';
export { default as userRoutes } from './api/routes/userRoutes';

// Export controllers
export { AuthController } from './api/controllers/AuthController';
export { GoogleAuthController } from './api/controllers/GoogleAuthController';
export { UserController } from './api/controllers/UserController';

// Export services
export { AuthService } from './domain/services/AuthService';
export { TokenService } from './domain/services/TokenService';
export { UserService } from './domain/services/UserService';

// Export models
export { User, IUser } from './domain/models/User';

// Export repositories
export { UserRepository } from './domain/repositories/UserRepository';
