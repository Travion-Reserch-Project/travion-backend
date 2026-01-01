import { Response, NextFunction } from 'express';
import { UserService } from '../services/UserService';
import { ChatPreferencesRepository } from '../repositories/ChatPreferencesRepository';
import { AuthRequest } from '../middleware/auth';

export class UserController {
  private userService: UserService;
  private chatPreferencesRepository: ChatPreferencesRepository;

  constructor() {
    this.userService = new UserService();
    this.chatPreferencesRepository = new ChatPreferencesRepository();
  }

  getProfile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new Error('User ID not found');
      }

      const user = await this.userService.getUserById(userId);
      const chatPreferences = await this.chatPreferencesRepository.findByUserId(userId);

      res.status(200).json({
        success: true,
        user: {
          userId: String(user._id),
          email: user.email,
          userName: user.userName,
          firstName: user.firstName,
          lastName: user.lastName,
          gender: user.gender,
          dob: user.dob,
          profilePicture: user.profilePicture,
          isActive: user.isActive,
          profileStatus: user.profileStatus,
          provider: user.provider,
          chatPreferences: chatPreferences
            ? {
                language: chatPreferences.language,
                enableNotifications: chatPreferences.enableNotifications,
              }
            : null,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  getUserById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.params;
      const user = await this.userService.getUserById(userId);
      const chatPreferences = await this.chatPreferencesRepository.findByUserId(userId);

      res.status(200).json({
        success: true,
        user: {
          userId: String(user._id),
          email: user.email,
          userName: user.userName,
          firstName: user.firstName,
          lastName: user.lastName,
          gender: user.gender,
          dob: user.dob,
          profilePicture: user.profilePicture,
          isActive: user.isActive,
          profileStatus: user.profileStatus,
          provider: user.provider,
          chatPreferences: chatPreferences
            ? {
                language: chatPreferences.language,
                enableNotifications: chatPreferences.enableNotifications,
              }
            : null,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  getAllUsers = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const result = await this.userService.getAllUsers(page, limit);

      // Transform users array to use userId instead of _id and fetch chat preferences
      const transformedUsers = await Promise.all(
        result.users.map(async (user) => {
          const chatPreferences = await this.chatPreferencesRepository.findByUserId(
            String(user._id)
          );
          return {
            user: {
              userId: String(user._id),
              email: user.email,
              userName: user.userName,
              firstName: user.firstName,
              lastName: user.lastName,
              gender: user.gender,
              dob: user.dob,
              profilePicture: user.profilePicture,
              isActive: user.isActive,
              profileStatus: user.profileStatus,
              provider: user.provider,
              chatPreferences: chatPreferences
                ? {
                    language: chatPreferences.language,
                    enableNotifications: chatPreferences.enableNotifications,
                  }
                : null,
              createdAt: user.createdAt,
              updatedAt: user.updatedAt,
            },
          };
        })
      );

      res.status(200).json({
        success: true,
        users: transformedUsers,
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      });
    } catch (error) {
      next(error);
    }
  };

  updateProfile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new Error('User ID not found');
      }

      const user = await this.userService.updateUser(userId, req.body);
      const chatPreferences = await this.chatPreferencesRepository.findByUserId(userId);

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        user: {
          userId: String(user._id),
          email: user.email,
          userName: user.userName,
          firstName: user.firstName,
          lastName: user.lastName,
          gender: user.gender,
          dob: user.dob,
          profilePicture: user.profilePicture,
          isActive: user.isActive,
          profileStatus: user.profileStatus,
          provider: user.provider,
          chatPreferences: chatPreferences
            ? {
                language: chatPreferences.language,
                enableNotifications: chatPreferences.enableNotifications,
              }
            : null,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  updateUser = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.params;
      const user = await this.userService.updateUser(userId, req.body);
      const chatPreferences = await this.chatPreferencesRepository.findByUserId(userId);

      res.status(200).json({
        success: true,
        message: 'User updated successfully',
        user: {
          userId: String(user._id),
          email: user.email,
          userName: user.userName,
          firstName: user.firstName,
          lastName: user.lastName,
          gender: user.gender,
          dob: user.dob,
          profilePicture: user.profilePicture,
          isActive: user.isActive,
          profileStatus: user.profileStatus,
          provider: user.provider,
          chatPreferences: chatPreferences
            ? {
                language: chatPreferences.language,
                enableNotifications: chatPreferences.enableNotifications,
              }
            : null,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  deleteUser = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.params;
      await this.userService.deleteUser(userId);
      res.status(200).json({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  updateChatPreferences = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new Error('User ID not found');
      }

      const user = await this.userService.updateChatPreferences(userId, req.body);
      const chatPreferences = await this.chatPreferencesRepository.findByUserId(userId);

      res.status(200).json({
        success: true,
        message: 'Chat preferences updated successfully',
        user: {
          userId: String(user._id),
          email: user.email,
          userName: user.userName,
          firstName: user.firstName,
          lastName: user.lastName,
          gender: user.gender,
          dob: user.dob,
          profilePicture: user.profilePicture,
          isActive: user.isActive,
          profileStatus: user.profileStatus,
          provider: user.provider,
          chatPreferences: chatPreferences
            ? {
                language: chatPreferences.language,
                enableNotifications: chatPreferences.enableNotifications,
              }
            : null,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
