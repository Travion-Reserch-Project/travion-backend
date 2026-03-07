import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../domain/services/AuthService';
import config from '../../../../shared/config/config';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.authService.register(req.body);

      // Set HTTP-only cookies
      res.cookie('accessToken', result.tokens.accessToken, {
        httpOnly: config.cookies.httpOnly,
        secure: config.cookies.secure,
        sameSite: config.cookies.sameSite,
        maxAge: config.cookies.maxAge,
      });

      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: config.cookies.httpOnly,
        secure: config.cookies.secure,
        sameSite: config.cookies.sameSite,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        tokens: result.tokens,
        user: {
          userId: String(result.user._id),
          email: result.user.email,
          userName: result.user.userName,
          name: `${result.user.firstName} ${result.user.lastName}`.trim(),
          picture: result.user.profilePicture,
          profileStatus: result.user.profileStatus,
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
      res.cookie('accessToken', result.tokens.accessToken, {
        httpOnly: config.cookies.httpOnly,
        secure: config.cookies.secure,
        sameSite: config.cookies.sameSite,
        maxAge: config.cookies.maxAge,
      });

      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: config.cookies.httpOnly,
        secure: config.cookies.secure,
        sameSite: config.cookies.sameSite,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      res.status(200).json({
        success: true,
        message: 'Login successful',
        tokens: result.tokens,
        user: {
          userId: String(result.user._id),
          email: result.user.email,
          userName: result.user.userName,
          name: `${result.user.firstName} ${result.user.lastName}`.trim(),
          picture: result.user.profilePicture,
          profileStatus: result.user.profileStatus,
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

      const tokens = await this.authService.refreshToken(refreshToken);

      // Set new cookies
      res.cookie('accessToken', tokens.accessToken, {
        httpOnly: config.cookies.httpOnly,
        secure: config.cookies.secure,
        sameSite: config.cookies.sameSite,
        maxAge: config.cookies.maxAge,
      });

      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: config.cookies.httpOnly,
        secure: config.cookies.secure,
        sameSite: config.cookies.sameSite,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        tokens,
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
