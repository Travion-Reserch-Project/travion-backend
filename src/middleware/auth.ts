import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';
import { TokenService } from '../services/TokenService';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email?: string;
  };
}

export const authenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token = req.cookies?.accessToken;

    if (!token) {
      // Fall back to Authorization header
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AppError('No token provided', 401);
      }

      token = authHeader.split(' ')[1];
    }

    // Verify token
    const decoded = TokenService.verifyToken(token) as {
      userId: string;
      email?: string;
    };

    // Attach user to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError('Invalid token', 401));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new AppError('Token expired', 401));
    } else {
      next(error);
    }
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token = req.cookies?.accessToken;

    if (!token) {
      const authHeader = req.headers.authorization;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    if (token) {
      const decoded = TokenService.verifyToken(token) as {
        userId: string;
        email?: string;
      };

      req.user = {
        userId: decoded.userId,
        email: decoded.email,
      };
    }
    next();
  } catch (error) {
    // Ignore authentication errors for optional auth
    next();
  }
};

// Export auth as an alias for authenticate
export const auth = authenticate;
