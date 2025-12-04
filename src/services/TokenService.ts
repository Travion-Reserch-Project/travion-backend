import jwt, { SignOptions } from 'jsonwebtoken';
import config from '../config/config';
import { IUser } from '../models/User';

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class TokenService {
  //Generate both access and refresh tokens for a user
  static generateTokens(userId: string): TokenResponse {
    const payload = {
      userId: userId,
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as SignOptions);

    const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn,
    } as SignOptions);

    const expiresIn = this.getExpirationInSeconds(config.jwt.expiresIn);

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  //Generate access token only
  static generateAccessToken(userId: string): string {
    const payload = {
      userId: userId,
    };

    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as SignOptions);
  }

  //Generate refresh token only
  static generateRefreshToken(userId: string): string {
    const payload = {
      userId: userId,
    };

    return jwt.sign(payload, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn,
    } as SignOptions);
  }

  //Generate tokens for IUser object
  static generateTokensForUser(user: IUser): {
    token: string;
    refreshToken: string;
  } {
    const userId = String(user._id);
    const tokens = this.generateTokens(userId);

    return {
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  //Verify and decode a token
  static verifyToken(token: string, isRefreshToken = false): any {
    const secret = isRefreshToken ? config.jwt.refreshSecret : config.jwt.secret;
    return jwt.verify(token, secret);
  }

  //Convert time string (like "7d", "24h") to seconds
  private static getExpirationInSeconds(timeString: string): number {
    const timeMap: { [key: string]: number } = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
      w: 604800,
      y: 31536000,
    };

    const match = timeString.match(/^(\d+)([smhdwy])$/);
    if (!match) {
      // Default to 7 days if parsing fails
      return 7 * 24 * 60 * 60;
    }

    const [, value, unit] = match;
    return parseInt(value) * (timeMap[unit] || 86400);
  }
}
