import jwt, { SignOptions } from 'jsonwebtoken';
import type { StringValue } from 'ms';
import { UserRepository } from '../repositories/UserRepository';
import { IUser } from '../models/User';
import { AppError } from '../middleware/errorHandler';
import config from '../config/config';

export interface RegisterDTO {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: IUser;
  token: string;
  refreshToken: string;
}

export class AuthService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  async register(data: RegisterDTO): Promise<AuthResponse> {
    const existingUser = await this.userRepository.findByEmail(data.email);
    if (existingUser) {
      throw new AppError('User with this email already exists', 409);
    }

    const user = await this.userRepository.create(data);

    const token = this.generateToken(user);
    const refreshToken = this.generateRefreshToken(user);

    return { user, token, refreshToken };
  }

  async login(data: LoginDTO): Promise<AuthResponse> {
    const user = await this.userRepository.findByEmail(data.email);
    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    if (!user.isActive) {
      throw new AppError('Account is deactivated', 403);
    }

    const isPasswordValid = await user.comparePassword(data.password);
    if (!isPasswordValid) {
      throw new AppError('Invalid credentials', 401);
    }

    const token = this.generateToken(user);
    const refreshToken = this.generateRefreshToken(user);

    return { user, token, refreshToken };
  }

  async refreshToken(refreshToken: string): Promise<{ token: string; refreshToken: string }> {
    try {
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as {
        id: string;
        email: string;
      };

      const user = await this.userRepository.findById(decoded.id);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      const newToken = this.generateToken(user);
      const newRefreshToken = this.generateRefreshToken(user);

      return { token: newToken, refreshToken: newRefreshToken };
    } catch (error) {
      throw new AppError('Invalid refresh token', 401);
    }
  }

  private generateToken(user: IUser): string {
    const payload = {
      id: (user as unknown as { _id: string })._id,
      email: user.email,
    };
    const options: SignOptions = {
      expiresIn: config.jwt.expiresIn as StringValue,
    };
    return jwt.sign(payload, config.jwt.secret, options);
  }

  private generateRefreshToken(user: IUser): string {
    const payload = {
      id: (user as unknown as { _id: string })._id,
      email: user.email,
    };
    const options: SignOptions = {
      expiresIn: config.jwt.refreshExpiresIn as StringValue,
    };
    return jwt.sign(payload, config.jwt.refreshSecret, options);
  }
}
