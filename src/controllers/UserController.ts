import { Response, NextFunction } from 'express';
import { UserService } from '../services/UserService';
import { AuthRequest } from '../middleware/auth';

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  getProfile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new Error('User ID not found');
      }

      const user = await this.userService.getUserById(userId);
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

      // Transform users array to use userId instead of _id
      const transformedUsers = result.users.map((user) => ({
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
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      }));

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
}
