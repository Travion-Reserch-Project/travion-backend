import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import config from '../config/config';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.authService.register(req.body);

      // Set HTTP-only cookies
      res.cookie('accessToken', result.token, {
        httpOnly: config.cookies.httpOnly,
        secure: config.cookies.secure,
        sameSite: config.cookies.sameSite,
        maxAge: config.cookies.maxAge,
      });

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: config.cookies.httpOnly,
        secure: config.cookies.secure,
        sameSite: config.cookies.sameSite,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: result.user,
          // Still return tokens for clients that prefer header-based auth
          token: result.token,
          refreshToken: result.refreshToken,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.authService.login(req.body);

      // Set HTTP-only cookies
      res.cookie('accessToken', result.token, {
        httpOnly: config.cookies.httpOnly,
        secure: config.cookies.secure,
        sameSite: config.cookies.sameSite,
        maxAge: config.cookies.maxAge,
      });

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: config.cookies.httpOnly,
        secure: config.cookies.secure,
        sameSite: config.cookies.sameSite,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: result.user,
          token: result.token,
          refreshToken: result.refreshToken,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Get refresh token from cookie or body
      const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

      if (!refreshToken) {
        res.status(401).json({
          success: false,
          message: 'Refresh token not provided',
        });
        return;
      }

      const result = await this.authService.refreshToken(refreshToken);

      // Set new cookies
      res.cookie('accessToken', result.token, {
        httpOnly: config.cookies.httpOnly,
        secure: config.cookies.secure,
        sameSite: config.cookies.sameSite,
        maxAge: config.cookies.maxAge,
      });

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: config.cookies.httpOnly,
        secure: config.cookies.secure,
        sameSite: config.cookies.sameSite,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  logout = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Clear cookies
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');

      res.status(200).json({
        success: true,
        message: 'Logout successful',
      });
    } catch (error) {
      next(error);
    }
  };
}
