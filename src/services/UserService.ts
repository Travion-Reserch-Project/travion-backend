import { UserRepository } from '../repositories/UserRepository';
import { IUser } from '../models/User';
import { AppError } from '../middleware/errorHandler';

export interface UpdateUserDTO {
  firstName?: string;
  lastName?: string;
  email?: string;
}

export class UserService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  async getUserById(id: string): Promise<IUser> {
    const user = await this.userRepository.findById(id);
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

  async updateUser(id: string, data: UpdateUserDTO): Promise<IUser> {
    if (data.email) {
      const existingUser = await this.userRepository.findByEmail(data.email);
      if (
        existingUser &&
        (existingUser as unknown as { _id: { toString: () => string } })._id.toString() !== id
      ) {
        throw new AppError('Email is already in use', 409);
      }
    }

    const user = await this.userRepository.update(id, data);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    return user;
  }

  async deleteUser(id: string): Promise<void> {
    const user = await this.userRepository.delete(id);
    if (!user) {
      throw new AppError('User not found', 404);
    }
  }

  async deactivateUser(id: string): Promise<IUser> {
    const user = await this.userRepository.update(id, { isActive: false });
    if (!user) {
      throw new AppError('User not found', 404);
    }
    return user;
  }

  async activateUser(id: string): Promise<IUser> {
    const user = await this.userRepository.update(id, { isActive: true });
    if (!user) {
      throw new AppError('User not found', 404);
    }
    return user;
  }
}
