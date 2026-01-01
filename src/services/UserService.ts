import { UserRepository } from '../repositories/UserRepository';
import { IUser } from '../models/User';
import { ChatPreferencesRepository } from '../repositories/ChatPreferencesRepository';
import { AppError } from '../middleware/errorHandler';

export interface UpdateUserDTO {
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface UpdateChatPreferencesDTO {
  language?: string;
  enableNotifications?: boolean;
}

export class UserService {
  private userRepository: UserRepository;
  private chatPreferencesRepository: ChatPreferencesRepository;

  constructor() {
    this.userRepository = new UserRepository();
    this.chatPreferencesRepository = new ChatPreferencesRepository();
  }

  async getUserById(userId: string): Promise<IUser> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }
    return user;
  }

  async getAllUsers(
    page = 1,
    limit = 10
  ): Promise<{ users: IUser[]; total: number; page: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      this.userRepository.findAll({}, limit, skip),
      this.userRepository.count(),
    ]);

    return {
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateUser(userId: string, data: UpdateUserDTO): Promise<IUser> {
    if (data.email) {
      const existingUser = await this.userRepository.findByEmail(data.email);
      if (existingUser && String(existingUser._id) !== userId) {
        throw new AppError('Email is already in use', 409);
      }
    }

    const user = await this.userRepository.update(userId, data);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    return user;
  }

  async deleteUser(userId: string): Promise<void> {
    const user = await this.userRepository.delete(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }
  }

  async deactivateUser(userId: string): Promise<IUser> {
    const user = await this.userRepository.update(userId, { isActive: false });
    if (!user) {
      throw new AppError('User not found', 404);
    }
    return user;
  }

  async activateUser(userId: string): Promise<IUser> {
    const user = await this.userRepository.update(userId, { isActive: true });
    if (!user) {
      throw new AppError('User not found', 404);
    }
    return user;
  }

  async updateChatPreferences(
    userId: string,
    preferences: UpdateChatPreferencesDTO
  ): Promise<IUser> {
    // Verify user exists
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Find or create ChatPreferences for this user
    const existingPrefs = await this.chatPreferencesRepository.findByUserId(userId);

    if (!existingPrefs) {
      // Create new ChatPreferences if it doesn't exist
      await this.chatPreferencesRepository.create({
        userId: user._id as any,
        language: preferences.language || 'en',
        enableNotifications:
          preferences.enableNotifications !== undefined ? preferences.enableNotifications : true,
      });
    } else {
      // Update existing preferences
      const updateData: any = {};
      if (preferences.language !== undefined) {
        updateData.language = preferences.language;
      }
      if (preferences.enableNotifications !== undefined) {
        updateData.enableNotifications = preferences.enableNotifications;
      }

      await this.chatPreferencesRepository.update(userId, updateData);
    }

    return user;
  }
}
