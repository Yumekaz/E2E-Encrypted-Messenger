/**
 * URL Signer Utility Tests
 */

const urlSigner = require('../backend/utils/urlSigner');

describe('URL Signer Utility', () => {
  beforeAll(() => {
    // Ensure URL_SIGNING_SECRET is set
    if (!process.env.URL_SIGNING_SECRET) {
      process.env.URL_SIGNING_SECRET = 'test-url-signing-secret-for-unit-tests';
    }
  });

  describe('sign()', () => {
    it('should sign a URL with expiration', () => {
      const path = '/api/files/123';
      
      const signedUrl = urlSigner.sign(path, 3600);
      
      expect(signedUrl).toContain('sig=');
      expect(signedUrl).toContain('exp=');
      expect(signedUrl).toContain(path);
    });

    it('should generate unique signatures for same path', () => {
      const path = '/api/files/123';
      
      const signed1 = urlSigner.sign(path, 3600);
      const signed2 = urlSigner.sign(path, 3600);
      
      // Both should be valid signed URLs with same structure
      expect(signed1).toContain('sig=');
      expect(signed1).toContain('exp=');
      expect(signed2).toContain('sig=');
      expect(signed2).toContain('exp=');
      
      // Both should have the same path
      expect(signed1).toContain(path);
      expect(signed2).toContain(path);
      
      // Both should verify successfully
      const params1 = urlSigner.extractParams(signed1);
      const params2 = urlSigner.extractParams(signed2);
      
      expect(urlSigner.verify(params1.path, params1.signature, params1.expiration)).toBe(true);
      expect(urlSigner.verify(params2.path, params2.signature, params2.expiration)).toBe(true);
    });

    it('should include correct expiration timestamp', () => {
      const path = '/api/files/123';
      const expiresIn = 3600;
      const beforeSign = Math.floor(Date.now() / 1000);
      
      const signedUrl = urlSigner.sign(path, expiresIn);
      const afterSign = Math.floor(Date.now() / 1000);
      
      const expMatch = signedUrl.match(/exp=(\d+)/);
      expect(expMatch).toBeTruthy();
      
      const exp = parseInt(expMatch[1], 10);
      expect(exp).toBeGreaterThanOrEqual(beforeSign + expiresIn - 1);
      expect(exp).toBeLessThanOrEqual(afterSign + expiresIn + 1);
    });

    it('should use default expiry when not specified', () => {
      const path = '/api/files/123';
      const beforeSign = Math.floor(Date.now() / 1000);
      
      const signedUrl = urlSigner.sign(path);
      const afterSign = Math.floor(Date.now() / 1000);
      
      const expMatch = signedUrl.match(/exp=(\d+)/);
      expect(expMatch).toBeTruthy();
      
      const exp = parseInt(expMatch[1], 10);
      // Default is 3600 seconds (1 hour)
      expect(exp).toBeGreaterThanOrEqual(beforeSign + 3600 - 1);
      expect(exp).toBeLessThanOrEqual(afterSign + 3600 + 1);
    });
  });

  describe('verify()', () => {
    it('should verify valid signed URL', () => {
      const path = '/api/files/123';
      const signedUrl = urlSigner.sign(path, 3600);
      const params = urlSigner.extractParams(signedUrl);
      
      const result = urlSigner.verify(params.path, params.signature, params.expiration);
      
      expect(result).toBe(true);
    });

    it('should reject expired URL', () => {
      const path = '/api/files/123';
      const expiredTimestamp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      
      // Create a signature for the expired timestamp
      const crypto = require('crypto');
      const secret = process.env.URL_SIGNING_SECRET || 'fallback-secret-change-in-production';
      const data = `${path}:${expiredTimestamp}`;
      const signature = crypto
        .createHmac('sha256', secret)
        .update(data)
        .digest('hex');
      
      const result = urlSigner.verify(path, signature, expiredTimestamp);
      
      expect(result).toBe(false);
    });

    it('should reject invalid signature', () => {
      const path = '/api/files/123';
      const expiration = Math.floor(Date.now() / 1000) + 3600;
      
      const result = urlSigner.verify(path, 'invalid-signature', expiration);
      
      expect(result).toBe(false);
    });

    it('should reject tampered signature', () => {
      const path = '/api/files/123';
      const signedUrl = urlSigner.sign(path, 3600);
      const params = urlSigner.extractParams(signedUrl);
      
      // Tamper with signature
      const tamperedSig = params.signature.slice(0, -4) + 'abcd';
      
      const result = urlSigner.verify(params.path, tamperedSig, params.expiration);
      
      expect(result).toBe(false);
    });

    it('should reject signature for different path', () => {
      const path1 = '/api/files/123';
      const path2 = '/api/files/456';
      const signedUrl = urlSigner.sign(path1, 3600);
      const params = urlSigner.extractParams(signedUrl);
      
      // Try to use signature for different path
      const result = urlSigner.verify(path2, params.signature, params.expiration);
      
      expect(result).toBe(false);
    });
  });

  describe('extractParams()', () => {
    it('should extract signature and expiration', () => {
      const path = '/api/files/123';
      const signedUrl = urlSigner.sign(path, 3600);
      
      const params = urlSigner.extractParams(signedUrl);
      
      expect(params).toHaveProperty('path', path);
      expect(params).toHaveProperty('signature');
      expect(params.signature).toBeTruthy();
      expect(params).toHaveProperty('expiration');
      expect(typeof params.expiration).toBe('number');
    });

    it('should return null for URL without signature', () => {
      const url = '/api/files/123?exp=1234567890';
      
      const params = urlSigner.extractParams(url);
      
      expect(params).toBeNull();
    });

    it('should return null for URL without expiration', () => {
      const url = '/api/files/123?sig=abc123';
      
      const params = urlSigner.extractParams(url);
      
      expect(params).toBeNull();
    });

    it('should handle full URL with domain', () => {
      const path = '/api/files/123';
      const signedUrl = 'http://localhost:3000' + urlSigner.sign(path, 3600);
      
      const params = urlSigner.extractParams(signedUrl);
      
      expect(params).toHaveProperty('path', path);
      expect(params).toHaveProperty('signature');
      expect(params).toHaveProperty('expiration');
    });

    it('should handle URL with other query params', () => {
      const path = '/api/files/123';
      const signedUrl = urlSigner.sign(path, 3600) + '&download=true';
      
      const params = urlSigner.extractParams(signedUrl);
      
      expect(params).toHaveProperty('path', path);
      expect(params).toHaveProperty('signature');
      expect(params).toHaveProperty('expiration');
    });
  });

  describe('End-to-End Sign and Verify', () => {
    it('should sign and verify successfully', () => {
      const path = '/api/files/123';
      
      // Sign
      const signedUrl = urlSigner.sign(path, 3600);
      
      // Extract params
      const params = urlSigner.extractParams(signedUrl);
      expect(params).not.toBeNull();
      
      // Verify
      const valid = urlSigner.verify(params.path, params.signature, params.expiration);
      expect(valid).toBe(true);
    });

    it('should handle multiple files', () => {
      const files = [
        '/api/files/1',
        '/api/files/2',
        '/api/files/3',
      ];
      
      files.forEach(path => {
        const signedUrl = urlSigner.sign(path, 3600);
        const params = urlSigner.extractParams(signedUrl);
        const valid = urlSigner.verify(params.path, params.signature, params.expiration);
        expect(valid).toBe(true);
      });
    });

    it('should reject cross-file signature use', () => {
      const signedUrl1 = urlSigner.sign('/api/files/1', 3600);
      const signedUrl2 = urlSigner.sign('/api/files/2', 3600);
      
      const params1 = urlSigner.extractParams(signedUrl1);
      const params2 = urlSigner.extractParams(signedUrl2);
      
      // Try to use file 1's signature for file 2
      const valid = urlSigner.verify(params2.path, params1.signature, params1.expiration);
      expect(valid).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle paths with special characters', () => {
      const path = '/api/files/test-file_name.txt';
      
      const signedUrl = urlSigner.sign(path, 3600);
      const params = urlSigner.extractParams(signedUrl);
      const valid = urlSigner.verify(params.path, params.signature, params.expiration);
      
      expect(valid).toBe(true);
    });

    it('should handle very short expiration', () => {
      const path = '/api/files/123';
      
      const signedUrl = urlSigner.sign(path, 1); // 1 second
      const params = urlSigner.extractParams(signedUrl);
      
      // Should be valid immediately
      const valid = urlSigner.verify(params.path, params.signature, params.expiration);
      expect(valid).toBe(true);
    });

    it('should handle very long expiration', () => {
      const path = '/api/files/123';
      
      const signedUrl = urlSigner.sign(path, 86400 * 365); // 1 year
      const params = urlSigner.extractParams(signedUrl);
      const valid = urlSigner.verify(params.path, params.signature, params.expiration);
      
      expect(valid).toBe(true);
    });

    it('should handle unicode in path', () => {
      // URL-encode unicode characters for consistent handling
      const path = '/api/files/' + encodeURIComponent('文档.pdf');
      
      const signedUrl = urlSigner.sign(path, 3600);
      const params = urlSigner.extractParams(signedUrl);
      const valid = urlSigner.verify(params.path, params.signature, params.expiration);
      
      expect(valid).toBe(true);
    });
  });
});
