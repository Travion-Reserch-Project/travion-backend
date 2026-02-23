import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { validationResult } from 'express-validator';
import { AppError } from './errorHandler';

export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessage = error.details.map((detail) => detail.message).join(', ');
      next(new AppError(errorMessage, 400));
    } else {
      next();
    }
  };
};

export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessage = error.details.map((detail) => detail.message).join(', ');
      next(new AppError(errorMessage, 400));
    } else {
      next();
    }
  };
};

export const validateParams = (schema: Joi.ObjectSchema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessage = error.details.map((detail) => detail.message).join(', ');
      next(new AppError(errorMessage, 400));
    } else {
      next();
    }
  };
};

/**
 * Middleware to validate request using express-validator results
 * Used for routes that use express-validator chain validators
 */
export const validateRequest = (req: Request, _res: Response, next: NextFunction): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((error) => error.msg);
    const errorMessage = errorMessages.join(', ');

    next(new AppError(errorMessage, 400));
    return;
  }

  next();
};
