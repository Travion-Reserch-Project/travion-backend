import express from 'express';
import {
  createHealthProfile,
  getHealthProfileByUserId,
  updateHealthProfile,
  updateSkinTypeWithHistory,
  deleteHealthProfile,
} from '../controllers/HealthProfileController';

const router = express.Router();

// CREATE
router.post('/', createHealthProfile);

// READ
router.get('/:userId', getHealthProfileByUserId);

// UPDATE (general)
router.put('/:userId', updateHealthProfile);

// UPDATE skin type + history
router.patch('/:userId/skin-type', updateSkinTypeWithHistory);

// DELETE
router.delete('/:userId', deleteHealthProfile);

export default router;
