/**
 * Error Handler Middleware Tests
 */

const { errorHandler, notFoundHandler } = require('../backend/middleware/errorHandler');
const { AppError, ValidationError, AuthenticationError, NotFoundError } = require('../backend/utils/errors');
const logger = require('../backend/utils/logger');

// Mock logger
jest.mock('../backend/utils/logger', () => ({
  error: jest.fn(),
}));

describe('Error Handler Middleware', () => {
  let mockReq;
  let mockRes;
  let nextFn;

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      originalUrl: '/api/test',
      user: { userId: 'user-123' },
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    nextFn = jest.fn();
    
    // Clear mock calls
    logger.error.mockClear();
  });

  describe('notFoundHandler', () => {
    it('should return 404 status', () => {
      notFoundHandler(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should return error message with method and URL', () => {
      notFoundHandler(mockReq, mockRes, nextFn);

      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Not Found',
        message: 'Cannot GET /api/test',
      });
    });

    it('should handle different HTTP methods', () => {
      mockReq.method = 'POST';
      mockReq.originalUrl = '/api/users';

      notFoundHandler(mockReq, mockRes, nextFn);

      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Not Found',
        message: 'Cannot POST /api/users',
      });
    });

    it('should handle root path', () => {
      mockReq.method = 'GET';
      mockReq.originalUrl = '/';

      notFoundHandler(mockReq, mockRes, nextFn);

      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Not Found',
        message: 'Cannot GET /',
      });
    });
  });

  describe('errorHandler - AppError', () => {
    it('should handle AppError with status code', () => {
      const error = new AppError('Custom error', 418, 'TEAPOT');

      errorHandler(error, mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(418);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'TEAPOT',
        message: 'Custom error',
      });
    });

    it('should handle ValidationError with details', () => {
      const details = ['Field 1 is required', 'Field 2 is invalid'];
      const error = new ValidationError('Validation failed', details);

      errorHandler(error, mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: details,
      });
    });

    it('should handle AuthenticationError', () => {
      const error = new AuthenticationError('Token expired');

      errorHandler(error, mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'AUTHENTICATION_ERROR',
        message: 'Token expired',
      });
    });

    it('should handle NotFoundError', () => {
      const error = new NotFoundError('User');

      errorHandler(error, mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'NOT_FOUND',
        message: 'User not found',
      });
    });

    it('should handle request without user', () => {
      delete mockReq.user;
      const error = new AppError('Test error', 500);

      // Should not throw
      expect(() => errorHandler(error, mockReq, mockRes, nextFn)).not.toThrow();
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('errorHandler - Multer Errors', () => {
    it('should handle LIMIT_FILE_SIZE error', () => {
      const error = new Error('File too large');
      error.code = 'LIMIT_FILE_SIZE';

      errorHandler(error, mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'FILE_TOO_LARGE',
      }));
    });

    it('should handle LIMIT_UNEXPECTED_FILE error', () => {
      const error = new Error('Unexpected field');
      error.code = 'LIMIT_UNEXPECTED_FILE';

      errorHandler(error, mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'INVALID_FIELD',
        message: 'Unexpected file field',
      });
    });
  });

  describe('errorHandler - JWT Errors', () => {
    it('should handle JsonWebTokenError', () => {
      const error = new Error('invalid token');
      error.name = 'JsonWebTokenError';

      errorHandler(error, mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'INVALID_TOKEN',
        message: 'Invalid token',
      });
    });

    it('should handle TokenExpiredError', () => {
      const error = new Error('jwt expired');
      error.name = 'TokenExpiredError';

      errorHandler(error, mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'TOKEN_EXPIRED',
        message: 'Token has expired',
      });
    });
  });

  describe('errorHandler - Mongoose Validation Error', () => {
    it('should handle ValidationError from mongoose', () => {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';

      errorHandler(error, mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'VALIDATION_ERROR',
        message: 'Validation failed',
      });
    });
  });

  describe('errorHandler - Unknown Errors', () => {
    it('should handle generic errors with 500 status', () => {
      const error = new Error('Something went wrong');

      errorHandler(error, mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'INTERNAL_ERROR',
      }));
    });

    it('should include error message in non-production', () => {
      const config = require('../backend/config');
      const originalEnv = config.isProduction;
      config.isProduction = false;

      const error = new Error('Detailed error message');

      errorHandler(error, mockReq, mockRes, nextFn);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Detailed error message',
        stack: expect.any(String),
      }));

      config.isProduction = originalEnv;
    });

    it('should hide error details in production', () => {
      const config = require('../backend/config');
      const originalEnv = config.isProduction;
      config.isProduction = true;

      const error = new Error('Sensitive error details');

      errorHandler(error, mockReq, mockRes, nextFn);

      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'INTERNAL_ERROR',
        message: 'Internal server error',
      });

      config.isProduction = originalEnv;
    });

    it('should use error statusCode if available', () => {
      const error = new Error('Bad request');
      error.statusCode = 400;

      errorHandler(error, mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should handle errors without message', () => {
      const error = new Error();

      errorHandler(error, mockReq, mockRes, nextFn);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'INTERNAL_ERROR',
      }));
    });
  });

  describe('errorHandler - Edge Cases', () => {
    it('should handle error with numeric code', () => {
      const error = new Error('Error with code');
      error.code = 123;

      errorHandler(error, mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it('should handle error without stack', () => {
      const error = { message: 'No stack error' };

      errorHandler(error, mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it('should handle error with statusCode only', () => {
      const error = { statusCode: 400 };

      errorHandler(error, mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });
});
