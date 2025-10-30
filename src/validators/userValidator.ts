import Joi from 'joi';

export const updateUserSchema = Joi.object({
  email: Joi.string().email().messages({
    'string.email': 'Please provide a valid email address',
  }),
  firstName: Joi.string(),
  lastName: Joi.string(),
});

export const userIdSchema = Joi.object({
  id: Joi.string().hex().length(24).required().messages({
    'string.hex': 'Invalid user ID format',
    'string.length': 'Invalid user ID format',
    'any.required': 'User ID is required',
  }),
});

export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
});
