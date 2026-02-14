/**
 * Request Logger Middleware Tests
 */

const requestLogger = require('../backend/middleware/requestLogger');
const logger = require('../backend/utils/logger');

describe('Request Logger Middleware', () => {
  let mockReq;
  let mockRes;
  let nextFn;
  let httpSpy;

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      url: '/api/test',
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'test-agent'
      },
    };

    mockRes = {
      statusCode: 200,
      on: jest.fn((event, callback) => {
        if (event === 'finish') {
          // Simulate immediate finish
          setImmediate(callback);
        }
      }),
    };

    nextFn = jest.fn();
    
    // Spy on logger.http
    httpSpy = jest.spyOn(logger, 'http').mockImplementation(() => {});
  });

  afterEach(() => {
    httpSpy.mockRestore();
  });

  describe('Basic Logging', () => {
    it('should call next() to continue request', () => {
      requestLogger(mockReq, mockRes, nextFn);
      
      expect(nextFn).toHaveBeenCalled();
    });

    it('should attach to response finish event', () => {
      requestLogger(mockReq, mockRes, nextFn);
      
      expect(mockRes.on).toHaveBeenCalledWith('finish', expect.any(Function));
    });

    it('should log request on finish', (done) => {
      requestLogger(mockReq, mockRes, nextFn);
      
      setImmediate(() => {
        expect(httpSpy).toHaveBeenCalled();
        done();
      });
    });

    it('should log with request object', (done) => {
      requestLogger(mockReq, mockRes, nextFn);
      
      setImmediate(() => {
        expect(httpSpy).toHaveBeenCalledWith(mockReq, mockRes, expect.any(Number));
        done();
      });
    });

    it('should log with duration', (done) => {
      requestLogger(mockReq, mockRes, nextFn);
      
      setImmediate(() => {
        const duration = httpSpy.mock.calls[0][2];
        expect(typeof duration).toBe('number');
        expect(duration).toBeGreaterThanOrEqual(0);
        done();
      });
    });
  });

  describe('Different HTTP Methods', () => {
    it('should log GET requests', (done) => {
      mockReq.method = 'GET';
      
      requestLogger(mockReq, mockRes, nextFn);
      
      setImmediate(() => {
        expect(httpSpy).toHaveBeenCalled();
        done();
      });
    });

    it('should log POST requests', (done) => {
      mockReq.method = 'POST';
      
      requestLogger(mockReq, mockRes, nextFn);
      
      setImmediate(() => {
        expect(httpSpy).toHaveBeenCalled();
        done();
      });
    });

    it('should log PUT requests', (done) => {
      mockReq.method = 'PUT';
      
      requestLogger(mockReq, mockRes, nextFn);
      
      setImmediate(() => {
        expect(httpSpy).toHaveBeenCalled();
        done();
      });
    });

    it('should log DELETE requests', (done) => {
      mockReq.method = 'DELETE';
      
      requestLogger(mockReq, mockRes, nextFn);
      
      setImmediate(() => {
        expect(httpSpy).toHaveBeenCalled();
        done();
      });
    });

    it('should log PATCH requests', (done) => {
      mockReq.method = 'PATCH';
      
      requestLogger(mockReq, mockRes, nextFn);
      
      setImmediate(() => {
        expect(httpSpy).toHaveBeenCalled();
        done();
      });
    });
  });

  describe('Different Status Codes', () => {
    it('should log 200 status', (done) => {
      mockRes.statusCode = 200;
      
      requestLogger(mockReq, mockRes, nextFn);
      
      setImmediate(() => {
        expect(httpSpy).toHaveBeenCalledWith(mockReq, mockRes, expect.any(Number));
        done();
      });
    });

    it('should log 201 status', (done) => {
      mockRes.statusCode = 201;
      
      requestLogger(mockReq, mockRes, nextFn);
      
      setImmediate(() => {
        expect(httpSpy).toHaveBeenCalled();
        done();
      });
    });

    it('should log 301 status', (done) => {
      mockRes.statusCode = 301;
      
      requestLogger(mockReq, mockRes, nextFn);
      
      setImmediate(() => {
        expect(httpSpy).toHaveBeenCalled();
        done();
      });
    });

    it('should log 404 status', (done) => {
      mockRes.statusCode = 404;
      
      requestLogger(mockReq, mockRes, nextFn);
      
      setImmediate(() => {
        expect(httpSpy).toHaveBeenCalled();
        done();
      });
    });

    it('should log 500 status', (done) => {
      mockRes.statusCode = 500;
      
      requestLogger(mockReq, mockRes, nextFn);
      
      setImmediate(() => {
        expect(httpSpy).toHaveBeenCalled();
        done();
      });
    });
  });

  describe('Different URLs', () => {
    it('should log API requests', (done) => {
      mockReq.url = '/api/users';
      
      requestLogger(mockReq, mockRes, nextFn);
      
      setImmediate(() => {
        expect(httpSpy).toHaveBeenCalled();
        done();
      });
    });

    it('should log nested paths', (done) => {
      mockReq.url = '/api/rooms/123/messages/456';
      
      requestLogger(mockReq, mockRes, nextFn);
      
      setImmediate(() => {
        expect(httpSpy).toHaveBeenCalled();
        done();
      });
    });

    it('should log with query params', (done) => {
      mockReq.url = '/api/search?q=test&page=1';
      
      requestLogger(mockReq, mockRes, nextFn);
      
      setImmediate(() => {
        expect(httpSpy).toHaveBeenCalled();
        done();
      });
    });

    it('should log root path', (done) => {
      mockReq.url = '/';
      
      requestLogger(mockReq, mockRes, nextFn);
      
      setImmediate(() => {
        expect(httpSpy).toHaveBeenCalled();
        done();
      });
    });
  });

  describe('Client Information', () => {
    it('should log with IP address', (done) => {
      mockReq.ip = '192.168.1.1';
      
      requestLogger(mockReq, mockRes, nextFn);
      
      setImmediate(() => {
        expect(httpSpy).toHaveBeenCalled();
        done();
      });
    });

    it('should log with IPv6 address', (done) => {
      mockReq.ip = '::1';
      
      requestLogger(mockReq, mockRes, nextFn);
      
      setImmediate(() => {
        expect(httpSpy).toHaveBeenCalled();
        done();
      });
    });

    it('should handle missing IP', (done) => {
      delete mockReq.ip;
      
      requestLogger(mockReq, mockRes, nextFn);
      
      setImmediate(() => {
        expect(httpSpy).toHaveBeenCalled();
        done();
      });
    });

    it('should handle missing headers', (done) => {
      delete mockReq.headers;
      
      requestLogger(mockReq, mockRes, nextFn);
      
      setImmediate(() => {
        expect(httpSpy).toHaveBeenCalled();
        done();
      });
    });
  });

  describe('Response Time', () => {
    it('should measure response time', (done) => {
      requestLogger(mockReq, mockRes, nextFn);
      
      setImmediate(() => {
        const duration = httpSpy.mock.calls[0][2];
        expect(duration).toBeGreaterThanOrEqual(0);
        // Should be very small since we're using setImmediate
        expect(duration).toBeLessThan(100);
        done();
      });
    });

    it('should increase with delay', (done) => {
      mockRes.on = jest.fn((event, callback) => {
        if (event === 'finish') {
          setTimeout(callback, 50);
        }
      });
      
      requestLogger(mockReq, mockRes, nextFn);
      
      setTimeout(() => {
        const duration = httpSpy.mock.calls[0][2];
        expect(duration).toBeGreaterThanOrEqual(50);
        done();
      }, 100);
    });
  });

  describe('Error Handling', () => {
    it('should still call next if logger fails', () => {
      httpSpy.mockImplementation(() => {
        throw new Error('Logger error');
      });
      
      expect(() => requestLogger(mockReq, mockRes, nextFn)).not.toThrow();
      expect(nextFn).toHaveBeenCalled();
    });

    it('should handle response without finish event', () => {
      mockRes.on = jest.fn(); // No finish callback registered
      
      expect(() => requestLogger(mockReq, mockRes, nextFn)).not.toThrow();
      expect(nextFn).toHaveBeenCalled();
    });

    it('should handle null request properties', (done) => {
      mockReq.method = null;
      mockReq.url = null;
      
      requestLogger(mockReq, mockRes, nextFn);
      
      setImmediate(() => {
        expect(httpSpy).toHaveBeenCalled();
        done();
      });
    });
  });

  describe('Multiple Requests', () => {
    it('should handle multiple sequential requests', (done) => {
      const durations = [];
      httpSpy.mockImplementation((req, res, duration) => {
        durations.push(duration);
      });
      
      requestLogger(mockReq, mockRes, nextFn);
      requestLogger(mockReq, mockRes, nextFn);
      requestLogger(mockReq, mockRes, nextFn);
      
      setImmediate(() => {
        expect(durations).toHaveLength(3);
        durations.forEach(d => {
          expect(typeof d).toBe('number');
          expect(d).toBeGreaterThanOrEqual(0);
        });
        done();
      });
    });
  });
});
