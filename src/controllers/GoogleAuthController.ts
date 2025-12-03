import { Request, Response } from 'express';
import { User } from '../models/User';
import config from '../config/config';
import { logger } from '../config/logger';
import { OAuth2Client } from 'google-auth-library';
import { TokenService } from '../services/TokenService';

export class GoogleAuthController {
  private client = new OAuth2Client(config.google?.clientId);

  //Get current authenticated user info
  public getProfile = async (req: any, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
        return;
      }
      const user = await User.findById(userId);

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        user: {
          id: String(user._id),
          email: user.email,
          name: `${user.firstName} ${user.lastName}`.trim(),
          picture: user.profilePicture,
          verified: true,
        },
      });
    } catch (error) {
      logger.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user profile',
      });
    }
  };

  // Google mobile authentication with ID token
  public googleMobileAuth = async (req: Request, res: Response): Promise<void> => {
    try {
      const { idToken, user: frontendUser } = req.body;

      if (!idToken) {
        res.status(400).json({
          success: false,
          message: 'Google ID token is required',
        });
        return;
      }

      // Verify the Google ID token
      const ticket = await this.client.verifyIdToken({
        idToken: idToken,
        audience: config.google?.clientId,
      });

      const payload = ticket.getPayload();

      if (!payload) {
        res.status(400).json({
          success: false,
          message: 'Invalid Google ID token',
        });
        return;
      }

      const {
        sub: googleId,
        email,
        given_name: firstName,
        family_name: lastName,
        picture: profilePicture,
        email_verified,
      } = payload;

      if (!email) {
        res.status(400).json({
          success: false,
          message: 'Email not provided by Google',
        });
        return;
      }

      // Use frontend user data if available, fallback to token payload
      const userData = {
        googleId,
        email: frontendUser?.email || email,
        name: frontendUser?.name || `${firstName || ''} ${lastName || ''}`.trim(),
        firstName: firstName || frontendUser?.name?.split(' ')[0] || '',
        lastName: lastName || frontendUser?.name?.split(' ').slice(1).join(' ') || '',
        picture: frontendUser?.picture || profilePicture,
        verified: frontendUser?.verified ?? email_verified ?? false,
      };

      // Check if user exists
      let user = await User.findOne({
        $or: [{ email: userData.email }, { googleId }],
      });

      if (user) {
        // If user exists but doesn't have googleId, link the Google account
        if (!user.googleId && user.provider === 'local') {
          user.googleId = googleId;
          user.provider = 'google';
          user.profilePicture = userData.picture || user.profilePicture;
          user.firstName = userData.firstName || user.firstName;
          user.lastName = userData.lastName || user.lastName;
          await user.save();
          logger.info(`Linked Google account for existing user: ${userData.email}`);
        } else if (user.googleId === googleId) {
          // Update user info if changed
          let updated = false;
          if (userData.picture && user.profilePicture !== userData.picture) {
            user.profilePicture = userData.picture;
            updated = true;
          }
          if (userData.firstName && user.firstName !== userData.firstName) {
            user.firstName = userData.firstName;
            updated = true;
          }
          if (userData.lastName && user.lastName !== userData.lastName) {
            user.lastName = userData.lastName;
            updated = true;
          }
          if (updated) {
            await user.save();
          }
        }
      } else {
        // Create new user
        user = new User({
          googleId,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profilePicture: userData.picture,
          provider: 'google',
        });

        await user.save();
        logger.info(`Created new user from Google: ${userData.email}`);
      }

      // Generate tokens
      const { accessToken, refreshToken, expiresIn } = TokenService.generateTokens(
        String(user._id)
      );

      res.status(200).json({
        success: true,
        tokens: {
          accessToken,
          refreshToken,
          expiresIn,
        },
        user: {
          id: String(user._id),
          email: user.email,
          name: userData.name,
          picture: user.profilePicture || userData.picture,
          verified: userData.verified,
        },
      });
    } catch (error) {
      logger.error('Google mobile auth error:', error);
      res.status(500).json({
        success: false,
        message: 'Authentication failed',
      });
    }
  };
}
