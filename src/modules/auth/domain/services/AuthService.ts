import { UserRepository } from '../repositories/UserRepository';
import { IUser } from '../models/User';
import { AppError } from '../../../../shared/middleware/errorHandler';
import { TokenService, TokenResponse } from './TokenService';

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
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
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

    const tokens = TokenService.generateTokens(String(user._id));

    return { user, tokens };
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

    const tokens = TokenService.generateTokens(String(user._id));

    return { user, tokens };
  }

  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    try {
      const decoded = TokenService.verifyToken(refreshToken, true) as {
        userId: string;
        email?: string;
      };

      const user = await this.userRepository.findById(decoded.userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      return TokenService.generateTokens(String(user._id));
    } catch (error) {
      throw new AppError('Invalid refresh token', 401);
    }
  }
}
