import { Request, Response } from 'express';
import UserHealthProfile from '../models/HealthProfile';

// CREATE health profile
export const createHealthProfile = async (req: Request, res: Response) => {
  try {
    const profile = await UserHealthProfile.create(req.body);
    res.status(201).json(profile);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

// GET health profile by userId
export const getHealthProfileByUserId = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const profile = await UserHealthProfile.findOne({ userId });

    if (!profile) {
      return res.status(404).json({ message: 'Health profile not found' });
    }

    res.status(200).json(profile);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE health profile
export const updateHealthProfile = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const profile = await UserHealthProfile.findOneAndUpdate({ userId }, req.body, { new: true });

    if (!profile) {
      return res.status(404).json({ message: 'Health profile not found' });
    }

    res.status(200).json(profile);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

// UPDATE skin type + save history
export const updateSkinTypeWithHistory = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { skinType, imageUrl } = req.body;

    const profile = await UserHealthProfile.findOne({ userId });

    if (!profile) {
      return res.status(404).json({ message: 'Health profile not found' });
    }

    // push previous state to history
    profile.history.push({
      skinType: profile.skinType,
      imageUrl: profile.imageUrl,
      timeStamp: new Date(),
    });

    // update current values
    profile.skinType = skinType;
    profile.imageUrl = imageUrl;

    await profile.save();

    res.status(200).json(profile);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

// DELETE health profile
export const deleteHealthProfile = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const profile = await UserHealthProfile.findOneAndDelete({ userId });

    if (!profile) {
      return res.status(404).json({ message: 'Health profile not found' });
    }

    res.status(200).json({ message: 'Health profile deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
