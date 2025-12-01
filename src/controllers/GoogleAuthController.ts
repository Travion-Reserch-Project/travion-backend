import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { IUser } from '../models/User';
import config from '../config/config';
import { logger } from '../config/logger';

export class GoogleAuthController {
  //Generate JWT tokens for user
  private generateTokens(userId: string): { accessToken: string; refreshToken: string } {
    const accessToken = jwt.sign({ userId }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as jwt.SignOptions);

    const refreshToken = jwt.sign({ userId }, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn,
    } as jwt.SignOptions);

    return { accessToken, refreshToken };
  }

  //Google OAuth success callback
  public googleCallback = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user as IUser;
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

      if (!user) {
        res.redirect(`${clientUrl}/auth/error?message=Authentication failed`);
        return;
      }

      const { accessToken, refreshToken } = this.generateTokens(String(user._id));

      res.cookie('accessToken', accessToken, {
        httpOnly: config.cookies.httpOnly,
        secure: config.cookies.secure,
        sameSite: config.cookies.sameSite,
        maxAge: config.cookies.maxAge,
      });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: config.cookies.httpOnly,
        secure: config.cookies.secure,
        sameSite: config.cookies.sameSite,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      // For testing without frontend, redirect to a simple success message
      if (clientUrl === 'http://localhost:3000') {
        res.send(`
          <html>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
              <h1>✅ Google OAuth Success!</h1>
              <p>User: ${user.email}</p>
              <p>Cookies set successfully</p>
              <p>You can now test authenticated endpoints in Postman</p>
              <p><strong>AccessToken cookie:</strong> ${accessToken.substring(0, 20)}...</p>
            </body>
          </html>
        `);
        return;
      }

      res.redirect(`${clientUrl}/auth/success`);
    } catch (error) {
      logger.error('Google auth callback error:', error);
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
      res.redirect(`${clientUrl}/auth/error?message=Authentication failed`);
    }
  };

  //Get current authenticated user info
  public getProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user as IUser;

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            profilePicture: user.profilePicture,
            provider: user.provider,
          },
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get user profile',
      });
    }
  };
}
