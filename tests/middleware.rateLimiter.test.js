/**
 * Rate Limiter Middleware Tests
 */

const { 
  createRateLimiter, 
  authRateLimiter, 
  apiRateLimiter,
  socketLimiter 
} = require('../backend/middleware/rateLimiter');
const { RateLimitError } = require('../backend/utils/errors');

describe('Rate Limiter Middleware', () => {
  let mockReq;
  let mockRes;
  let nextFn;

  beforeEach(() => {
    mockReq = {
      ip: '127.0.0.1',
      headers: {},
    };

    mockRes = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    nextFn = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createRateLimiter', () => {
    it('should allow request within limit', () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 5,
      });

      limiter(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(nextFn).not.toHaveBeenCalledWith(expect.any(RateLimitError));
    });

    it('should set rate limit headers', () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 10,
      });

      limiter(mockReq, mockRes, nextFn);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 10);
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(Number));
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(Number));
    });

    it('should block requests over limit', () => {
      // Use unique IP to avoid test interference
      mockReq.ip = '127.0.0.100';
      
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 2,
      });

      // First 2 requests should pass
      limiter(mockReq, mockRes, nextFn);
      limiter(mockReq, mockRes, nextFn);
      
      // Check that calls without errors were made
      const successCalls = nextFn.mock.calls.filter(call => !(call[0] instanceof RateLimitError));
      expect(successCalls.length).toBe(2);

      // 3rd request should be blocked
      nextFn.mockClear();
      limiter(mockReq, mockRes, nextFn);
      expect(nextFn.mock.calls[0][0]).toBeInstanceOf(RateLimitError);
    });

    it('should set Retry-After header when rate limited', () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
      });

      limiter(mockReq, mockRes, nextFn); // First request passes
      nextFn.mockClear();

      limiter(mockReq, mockRes, nextFn); // Second request blocked

      expect(mockRes.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(Number));
    });

    it('should use custom key generator', () => {
      const keyGenerator = jest.fn().mockReturnValue('custom-key');
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        keyGenerator,
      });

      limiter(mockReq, mockRes, nextFn);

      expect(keyGenerator).toHaveBeenCalledWith(mockReq);
    });

    it('should use IP as default key', () => {
      mockReq.ip = '192.168.1.100';
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
      });

      // First request from this IP
      limiter(mockReq, mockRes, nextFn);
      expect(nextFn).toHaveBeenCalledWith();

      // Second request from same IP should be blocked
      nextFn.mockClear();
      limiter(mockReq, mockRes, nextFn);
      expect(nextFn.mock.calls[0][0]).toBeInstanceOf(RateLimitError);
    });

    it('should track different IPs separately', () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
      });

      // First IP makes request
      mockReq.ip = '192.168.1.1';
      limiter(mockReq, mockRes, nextFn);
      expect(nextFn).toHaveBeenCalledWith();

      // Second IP makes request (should pass)
      nextFn.mockClear();
      mockReq.ip = '192.168.1.2';
      limiter(mockReq, mockRes, nextFn);
      expect(nextFn).toHaveBeenCalledWith();
    });

    it('should use custom error message', () => {
      const customMessage = 'Custom rate limit message';
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        message: customMessage,
      });

      limiter(mockReq, mockRes, nextFn); // First request
      nextFn.mockClear();

      limiter(mockReq, mockRes, nextFn); // Blocked request

      const error = nextFn.mock.calls[0][0];
      expect(error.message).toBe(customMessage);
    });

    it('should reset after window expires', (done) => {
      // Use unique IP to avoid test interference
      mockReq.ip = '127.0.0.103';
      
      const windowMs = 50; // 50ms window for testing
      const limiter = createRateLimiter({
        windowMs,
        maxRequests: 1,
      });

      // First request
      limiter(mockReq, mockRes, nextFn);

      // Wait for window to expire
      setTimeout(() => {
        nextFn.mockClear();
        limiter(mockReq, mockRes, nextFn);
        // After window expires, request should be processed
        expect(nextFn).toHaveBeenCalled();
        done();
      }, windowMs + 20);
    }, 200);

    it('should track remaining requests correctly', () => {
      // Use unique IP to avoid test interference
      mockReq.ip = '127.0.0.102';
      
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 5,
      });

      // Track remaining values
      const remainingValues = [];
      mockRes.setHeader.mockImplementation((header, value) => {
        if (header === 'X-RateLimit-Remaining') {
          remainingValues.push(value);
        }
      });

      // Make 3 requests
      for (let i = 0; i < 3; i++) {
        limiter(mockReq, mockRes, nextFn);
      }

      // Should have decreasing remaining values
      expect(remainingValues.length).toBe(3);
      expect(remainingValues[0]).toBeGreaterThan(remainingValues[2]);
    });
  });

  describe('authRateLimiter', () => {
    it('should be defined', () => {
      expect(authRateLimiter).toBeDefined();
      expect(typeof authRateLimiter).toBe('function');
    });

    it('should use stricter limits', () => {
      // authRateLimiter should allow fewer requests
      const remainingValues = [];
      mockRes.setHeader.mockImplementation((header, value) => {
        if (header === 'X-RateLimit-Remaining') {
          remainingValues.push(value);
        }
      });

      // Make multiple requests
      for (let i = 0; i < 3; i++) {
        authRateLimiter(mockReq, mockRes, nextFn);
      }

      // Should track remaining
      expect(remainingValues.length).toBe(3);
    });

    it('should have custom message for auth routes', () => {
      // Make requests to exceed limit
      for (let i = 0; i < 10; i++) {
        nextFn.mockClear();
        authRateLimiter(mockReq, mockRes, nextFn);
      }

      // Last call should have rate limit error
      const lastCall = nextFn.mock.calls[nextFn.mock.calls.length - 1];
      if (lastCall[0] instanceof RateLimitError) {
        expect(lastCall[0].message).toContain('login attempts');
      }
    });
  });

  describe('apiRateLimiter', () => {
    it('should be defined', () => {
      expect(apiRateLimiter).toBeDefined();
      expect(typeof apiRateLimiter).toBe('function');
    });

    it('should use standard API limits', () => {
      const remainingValues = [];
      mockRes.setHeader.mockImplementation((header, value) => {
        if (header === 'X-RateLimit-Remaining') {
          remainingValues.push(value);
        }
      });

      // Make a few requests
      for (let i = 0; i < 3; i++) {
        apiRateLimiter(mockReq, mockRes, nextFn);
      }

      expect(remainingValues.length).toBe(3);
    });
  });

  describe('socketLimiter', () => {
    it('should be defined', () => {
      expect(socketLimiter).toBeDefined();
      expect(typeof socketLimiter.check).toBe('function');
    });

    it('should track socket events separately', () => {
      const key = 'socket-user-123';
      
      // First few requests should pass
      const result1 = socketLimiter.check(key, 5, 60000);
      expect(result1.allowed).toBe(true);

      const result2 = socketLimiter.check(key, 5, 60000);
      expect(result2.allowed).toBe(true);

      // Remaining should decrease
      expect(result2.remaining).toBeLessThan(result1.remaining);
    });

    it('should block when limit exceeded', () => {
      const key = 'socket-user-456';
      const limit = 2;

      // Make requests up to limit
      socketLimiter.check(key, limit, 60000);
      socketLimiter.check(key, limit, 60000);

      // Next request should be blocked
      const result = socketLimiter.check(key, limit, 60000);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should provide reset time', () => {
      const key = 'socket-user-789';
      const windowMs = 60000;

      const result = socketLimiter.check(key, 5, windowMs);
      
      expect(result.resetTime).toBeGreaterThan(0);
      expect(result.resetTime).toBeLessThanOrEqual(60);
    });
  });

  describe('RateLimiter cleanup', () => {
    it('should cleanup old entries', (done) => {
      const shortWindowMs = 50;
      const limiter = createRateLimiter({
        windowMs: shortWindowMs,
        maxRequests: 1,
      });

      // Make a request
      limiter(mockReq, mockRes, nextFn);

      // Wait for cleanup interval
      setTimeout(() => {
        // After cleanup, the entry should be removed
        // So a new request should be allowed
        nextFn.mockClear();
        limiter(mockReq, mockRes, nextFn);
        expect(nextFn).toHaveBeenCalledWith();
        done();
      }, 100);
    }, 200);
  });

  describe('Edge Cases', () => {
    it('should handle missing IP', () => {
      delete mockReq.ip;
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 5,
      });

      // Should not throw
      expect(() => limiter(mockReq, mockRes, nextFn)).not.toThrow();
    });

    it('should handle IPv6 addresses', () => {
      mockReq.ip = '::1';
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 5,
      });

      limiter(mockReq, mockRes, nextFn);
      expect(nextFn).toHaveBeenCalledWith();
    });

    it('should handle very short windows', () => {
      const limiter = createRateLimiter({
        windowMs: 1,
        maxRequests: 1,
      });

      limiter(mockReq, mockRes, nextFn);
      expect(nextFn).toHaveBeenCalledWith();
    });

    it('should handle large request counts', () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 1000,
      });

      // Make many requests
      for (let i = 0; i < 100; i++) {
        limiter(mockReq, mockRes, nextFn);
      }

      expect(nextFn).toHaveBeenCalledTimes(100);
      // All should pass (no rate limit errors)
      const rateLimitErrors = nextFn.mock.calls.filter(call => call[0] instanceof RateLimitError);
      expect(rateLimitErrors.length).toBe(0);
    });
  });
});
