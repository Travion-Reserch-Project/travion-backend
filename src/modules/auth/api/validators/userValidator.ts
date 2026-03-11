import Joi from 'joi';

export const updateUserSchema = Joi.object({
  email: Joi.string().email().messages({
    'string.email': 'Please provide a valid email address',
  }),
  firstName: Joi.string(),
  lastName: Joi.string(),
  gender: Joi.string().valid('Male', 'Female', 'Other').messages({
    'any.only': 'Gender must be Male, Female, or Other',
  }),
  dob: Joi.date().iso().messages({
    'date.format': 'Date of birth must be a valid ISO date',
  }),
  country: Joi.string().trim(),
  preferredLanguage: Joi.string().trim(),
  profileStatus: Joi.string().valid('Incomplete', 'Complete').messages({
    'any.only': 'Profile status must be Incomplete or Complete',
  }),
  name: Joi.string().trim(),
  userName: Joi.string().trim(),
});

export const userIdSchema = Joi.object({
  userId: Joi.string().hex().length(24).required().messages({
    'string.hex': 'Invalid user ID format',
    'string.length': 'Invalid user ID format',
    'any.required': 'User ID is required',
  }),
});

export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
});
