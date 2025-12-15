import { ChatPreferences, IChatPreferences } from '../models/ChatPreferences';

export class ChatPreferencesRepository {
  async create(preferencesData: Partial<IChatPreferences>): Promise<IChatPreferences> {
    const preferences = new ChatPreferences(preferencesData);
    return await preferences.save();
  }

  async findByUserId(userId: string): Promise<IChatPreferences | null> {
    return await ChatPreferences.findOne({ userId });
  }

  async update(
    userId: string,
    updateData: Partial<IChatPreferences>
  ): Promise<IChatPreferences | null> {
    return await ChatPreferences.findOneAndUpdate({ userId }, { $set: updateData }, { new: true });
  }

  async delete(userId: string): Promise<IChatPreferences | null> {
    return await ChatPreferences.findOneAndDelete({ userId });
  }

  async exists(userId: string): Promise<boolean> {
    const preferences = await ChatPreferences.findOne({ userId });
    return !!preferences;
  }
}
