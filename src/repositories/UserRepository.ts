import { User, IUser } from '../models/User';

export class UserRepository {
  async create(userData: Partial<IUser>): Promise<IUser> {
    const user = new User(userData);
    return await user.save();
  }

  async findById(id: string): Promise<IUser | null> {
    return await User.findById(id);
  }

  async findByEmail(email: string): Promise<IUser | null> {
    return await User.findOne({ email }).select('+password');
  }

  async findAll(filter: Record<string, unknown> = {}, limit = 10, skip = 0): Promise<IUser[]> {
    return await User.find(filter).limit(limit).skip(skip).sort({ createdAt: -1 });
  }

  async update(id: string, userData: Partial<IUser>): Promise<IUser | null> {
    return await User.findByIdAndUpdate(id, userData, {
      new: true,
      runValidators: true,
    });
  }

  async delete(id: string): Promise<IUser | null> {
    return await User.findByIdAndDelete(id);
  }

  async count(filter: Record<string, unknown> = {}): Promise<number> {
    return await User.countDocuments(filter);
  }

  async exists(email: string): Promise<boolean> {
    const user = await User.findOne({ email });
    return !!user;
  }
}
