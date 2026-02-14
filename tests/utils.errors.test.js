/**
 * Custom Error Classes Tests
 */

const {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
} = require('../backend/utils/errors');

describe('Error Classes', () => {
  describe('AppError (Base Class)', () => {
    it('should create error with default values', () => {
      const error = new AppError('Something went wrong');

      expect(error.message).toBe('Something went wrong');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.isOperational).toBe(true);
      expect(error.stack).toBeDefined();
    });

    it('should create error with custom status code', () => {
      const error = new AppError('Bad request', 400);

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('INTERNAL_ERROR');
    });

    it('should create error with custom code', () => {
      const error = new AppError('Custom error', 418, 'TEAPOT_ERROR');

      expect(error.statusCode).toBe(418);
      expect(error.code).toBe('TEAPOT_ERROR');
    });

    it('should be instance of Error', () => {
      const error = new AppError('Test');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });

    it('should capture stack trace', () => {
      const error = new AppError('Test error');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('errors.test.js');
    });

    it('should be instance of Error', () => {
      const error = new AppError('Test');

      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('ValidationError', () => {
    it('should create validation error with default message', () => {
      const error = new ValidationError('Invalid input');

      expect(error.message).toBe('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error).toBeInstanceOf(AppError);
    });

    it('should include validation details', () => {
      const details = ['Email is required', 'Password is too short'];
      const error = new ValidationError('Validation failed', details);

      expect(error.details).toEqual(details);
    });

    it('should have null details when not provided', () => {
      const error = new ValidationError('Validation failed');

      expect(error.details).toBeNull();
    });

    it('should be instance of ValidationError', () => {
      const error = new ValidationError('Test');

      expect(error).toBeInstanceOf(ValidationError);
    });
  });

  describe('AuthenticationError', () => {
    it('should create auth error with default message', () => {
      const error = new AuthenticationError();

      expect(error.message).toBe('Authentication required');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('should create auth error with custom message', () => {
      const error = new AuthenticationError('Token expired');

      expect(error.message).toBe('Token expired');
    });

    it('should be instance of AuthenticationError', () => {
      const error = new AuthenticationError();

      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error).toBeInstanceOf(AppError);
    });
  });

  describe('AuthorizationError', () => {
    it('should create authorization error with default message', () => {
      const error = new AuthorizationError();

      expect(error.message).toBe('Access denied');
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('should create authorization error with custom message', () => {
      const error = new AuthorizationError('Admin access required');

      expect(error.message).toBe('Admin access required');
    });

    it('should be instance of AuthorizationError', () => {
      const error = new AuthorizationError();

      expect(error).toBeInstanceOf(AuthorizationError);
    });
  });

  describe('NotFoundError', () => {
    it('should create not found error with default resource', () => {
      const error = new NotFoundError();

      expect(error.message).toBe('Resource not found');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
    });

    it('should create not found error with custom resource', () => {
      const error = new NotFoundError('User');

      expect(error.message).toBe('User not found');
    });

    it('should create not found error for rooms', () => {
      const error = new NotFoundError('Room');

      expect(error.message).toBe('Room not found');
    });

    it('should be instance of NotFoundError', () => {
      const error = new NotFoundError();

      expect(error).toBeInstanceOf(NotFoundError);
    });
  });

  describe('ConflictError', () => {
    it('should create conflict error with default message', () => {
      const error = new ConflictError();

      expect(error.message).toBe('Resource already exists');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
    });

    it('should create conflict error with custom message', () => {
      const error = new ConflictError('Email already registered');

      expect(error.message).toBe('Email already registered');
    });

    it('should be instance of ConflictError', () => {
      const error = new ConflictError();

      expect(error).toBeInstanceOf(ConflictError);
    });
  });

  describe('RateLimitError', () => {
    it('should create rate limit error with default message', () => {
      const error = new RateLimitError();

      expect(error.message).toBe('Too many requests, please try again later');
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should create rate limit error with custom message', () => {
      const error = new RateLimitError('Rate limit: 5 requests per minute');

      expect(error.message).toBe('Rate limit: 5 requests per minute');
    });

    it('should be instance of RateLimitError', () => {
      const error = new RateLimitError();

      expect(error).toBeInstanceOf(RateLimitError);
    });
  });

  describe('Error Hierarchy', () => {
    it('all errors should extend AppError', () => {
      const errors = [
        new ValidationError('test'),
        new AuthenticationError(),
        new AuthorizationError(),
        new NotFoundError(),
        new ConflictError(),
        new RateLimitError(),
      ];

      errors.forEach(error => {
        expect(error).toBeInstanceOf(AppError);
        expect(error.isOperational).toBe(true);
      });
    });

    it('all errors should have isOperational flag', () => {
      const error = new ValidationError('test');

      expect(error.isOperational).toBe(true);
    });
  });

  describe('Error Properties', () => {
    it('should be throwable and catchable', () => {
      expect(() => {
        throw new AppError('Test error');
      }).toThrow('Test error');
    });

    it('should preserve error type when caught', () => {
      try {
        throw new ValidationError('Invalid', ['detail']);
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect(err.details).toEqual(['detail']);
      }
    });

    it('should work with async/await', async () => {
      const asyncFunction = async () => {
        throw new NotFoundError('User');
      };

      await expect(asyncFunction()).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
