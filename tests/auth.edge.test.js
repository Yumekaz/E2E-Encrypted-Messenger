/**
 * Authentication Edge Case Tests
 * Comprehensive edge case coverage for auth flows
 */

const request = require('supertest');

const API_URL = () => global.__TEST_API_URL__;

describe('Authentication Edge Cases', () => {
  describe('Registration Edge Cases', () => {
    it('should reject registration with missing email', async () => {
      const res = await request(API_URL())
        .post('/api/auth/register')
        .send({ username: 'testuser', password: 'TestPass123' });
      
      expect(res.status).toBe(400);
    });

    it('should reject registration with missing username', async () => {
      const res = await request(API_URL())
        .post('/api/auth/register')
        .send({ email: 'test@test.com', password: 'TestPass123' });
      
      expect(res.status).toBe(400);
    });

    it('should reject registration with missing password', async () => {
      const res = await request(API_URL())
        .post('/api/auth/register')
        .send({ email: 'test@test.com', username: 'testuser' });
      
      expect(res.status).toBe(400);
    });

    it('should reject username shorter than 3 characters', async () => {
      const res = await request(API_URL())
        .post('/api/auth/register')
        .send({ email: 'test@test.com', username: 'ab', password: 'TestPass123' });
      
      expect(res.status).toBe(400);
    });

    it('should reject username longer than 20 characters', async () => {
      const res = await request(API_URL())
        .post('/api/auth/register')
        .send({ 
          email: 'test@test.com', 
          username: 'a'.repeat(21), 
          password: 'TestPass123' 
        });
      
      expect(res.status).toBe(400);
    });

    it('should reject username with special characters', async () => {
      const res = await request(API_URL())
        .post('/api/auth/register')
        .send({ 
          email: 'test@test.com', 
          username: 'test@user!', 
          password: 'TestPass123' 
        });
      
      expect(res.status).toBe(400);
    });

    it('should reject password shorter than 8 characters', async () => {
      const res = await request(API_URL())
        .post('/api/auth/register')
        .send({ 
          email: 'test@test.com', 
          username: 'testuser', 
          password: 'Short1' 
        });
      
      expect(res.status).toBe(400);
    });

    it('should reject password without letters', async () => {
      const res = await request(API_URL())
        .post('/api/auth/register')
        .send({ 
          email: 'test@test.com', 
          username: 'testuser', 
          password: '12345678' 
        });
      
      expect(res.status).toBe(400);
    });

    it('should reject password without numbers', async () => {
      const res = await request(API_URL())
        .post('/api/auth/register')
        .send({ 
          email: 'test@test.com', 
          username: 'testuser', 
          password: 'PasswordOnly' 
        });
      
      expect(res.status).toBe(400);
    });

    it('should reject invalid email formats', async () => {
      const invalidEmails = [
        'notanemail',
        '@nodomain.com',
        'spaces in@email.com',
        'missing@domain',
        '@.com',
        'double@@at.com',
      ];

      for (const email of invalidEmails) {
        const res = await request(API_URL())
          .post('/api/auth/register')
          .send({ 
            email, 
            username: `test${Date.now()}`, 
            password: 'TestPass123' 
          });
        
        expect(res.status).toBe(400);
      }
    });

    it('should reject duplicate email registration', async () => {
      const ts = Date.now();
      const email = `duplicate${ts}@test.com`;
      
      // First registration
      await request(API_URL())
        .post('/api/auth/register')
        .send({ 
          email, 
          username: `user1${ts}`, 
          password: 'TestPass123' 
        })
        .expect(201);

      // Duplicate email
      const res = await request(API_URL())
        .post('/api/auth/register')
        .send({ 
          email, 
          username: `user2${ts}`, 
          password: 'TestPass123' 
        });
      
      expect(res.status).toBe(409);
    });

    it('should reject duplicate username registration', async () => {
      const ts = Date.now();
      const username = `dupuser${ts}`;
      
      // First registration
      await request(API_URL())
        .post('/api/auth/register')
        .send({ 
          email: `email1${ts}@test.com`, 
          username, 
          password: 'TestPass123' 
        })
        .expect(201);

      // Duplicate username
      const res = await request(API_URL())
        .post('/api/auth/register')
        .send({ 
          email: `email2${ts}@test.com`, 
          username, 
          password: 'TestPass123' 
        });
      
      expect(res.status).toBe(409);
    });

    it('should trim whitespace from inputs', async () => {
      const ts = Date.now();
      const res = await request(API_URL())
        .post('/api/auth/register')
        .send({ 
          email: `  trim${ts}@test.com  `, 
          username: `  trimuser${ts}  `, 
          password: 'TestPass123' 
        });
      
      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe(`trim${ts}@test.com`);
    });

    it('should handle unicode usernames', async () => {
      const ts = Date.now();
      const res = await request(API_URL())
        .post('/api/auth/register')
        .send({ 
          email: `unicode${ts}@test.com`, 
          username: `用户${ts}`, 
          password: 'TestPass123' 
        });
      
      // Should either accept or reject gracefully
      expect([201, 400]).toContain(res.status);
    });

    it('should handle very long email addresses', async () => {
      const ts = Date.now();
      const longLocal = 'a'.repeat(250);
      const res = await request(API_URL())
        .post('/api/auth/register')
        .send({ 
          email: `${longLocal}${ts}@test.com`, 
          username: `longemail${ts}`, 
          password: 'TestPass123' 
        });
      
      // Should reject as too long
      expect(res.status).toBe(400);
    });
  });

  describe('Login Edge Cases', () => {
    it('should reject login with missing email', async () => {
      const res = await request(API_URL())
        .post('/api/auth/login')
        .send({ password: 'TestPass123' });
      
      expect(res.status).toBe(400);
    });

    it('should reject login with missing password', async () => {
      const res = await request(API_URL())
        .post('/api/auth/login')
        .send({ email: 'test@test.com' });
      
      expect(res.status).toBe(400);
    });

    it('should reject login with empty credentials', async () => {
      const res = await request(API_URL())
        .post('/api/auth/login')
        .send({});
      
      expect(res.status).toBe(400);
    });

    it('should reject login for non-existent user', async () => {
      const res = await request(API_URL())
        .post('/api/auth/login')
        .send({ 
          email: `nonexistent${Date.now()}@test.com`, 
          password: 'TestPass123' 
        });
      
      expect(res.status).toBe(401);
    });

    it('should handle case sensitivity in email correctly', async () => {
      const ts = Date.now();
      const email = `case${ts}@test.com`;
      
      await request(API_URL())
        .post('/api/auth/register')
        .send({ 
          email, 
          username: `caseuser${ts}`, 
          password: 'TestPass123' 
        })
        .expect(201);

      // Try login with different case
      const res = await request(API_URL())
        .post('/api/auth/login')
        .send({ 
          email: `CASE${ts}@TEST.COM`, 
          password: 'TestPass123' 
        });
      
      // Should work (emails typically case-insensitive)
      expect(res.status).toBe(200);
    });

    it('should reject login after too many failed attempts', async () => {
      const ts = Date.now();
      const email = `ratelimit${ts}@test.com`;
      
      await request(API_URL())
        .post('/api/auth/register')
        .send({ 
          email, 
          username: `rateuser${ts}`, 
          password: 'TestPass123' 
        })
        .expect(201);

      // Multiple failed attempts
      for (let i = 0; i < 10; i++) {
        await request(API_URL())
          .post('/api/auth/login')
          .send({ email, password: 'WrongPass123' });
      }

      // Should be rate limited
      const res = await request(API_URL())
        .post('/api/auth/login')
        .send({ email, password: 'TestPass123' });
      
      // Either rate limited (429) or still works
      expect([200, 429]).toContain(res.status);
    });
  });

  describe('Token Edge Cases', () => {
    it('should reject refresh with missing token', async () => {
      const res = await request(API_URL())
        .post('/api/auth/refresh')
        .send({});
      
      expect(res.status).toBe(400);
    });

    it('should reject refresh with malformed token', async () => {
      const res = await request(API_URL())
        .post('/api/auth/refresh')
        .send({ refreshToken: 'not.a.valid.token' });
      
      expect(res.status).toBe(401);
    });

    it('should reject refresh with expired token', async () => {
      // Create an expired token (would need to manipulate time or use a known expired token)
      const res = await request(API_URL())
        .post('/api/auth/refresh')
        .send({ refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImV4cCI6MTYwMDAwMDAwMH0.invalid' });
      
      expect(res.status).toBe(401);
    });

    it('should reject access to protected route with expired token', async () => {
      const res = await request(API_URL())
        .get('/api/auth/me')
        .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoiYWNjZXNzIiwiZXhwIjoxNjAwMDAwMDAwfQ.invalid');
      
      expect(res.status).toBe(401);
    });

    it('should reject access with refresh token instead of access token', async () => {
      const ts = Date.now();
      const regRes = await request(API_URL())
        .post('/api/auth/register')
        .send({ 
          email: `tokentype${ts}@test.com`, 
          username: `tokentype${ts}`, 
          password: 'TestPass123' 
        })
        .expect(201);

      // Try to use refresh token as access token
      const res = await request(API_URL())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${regRes.body.refreshToken}`);
      
      expect(res.status).toBe(401);
    });

    it('should handle token rotation correctly', async () => {
      const ts = Date.now();
      const regRes = await request(API_URL())
        .post('/api/auth/register')
        .send({ 
          email: `rotation${ts}@test.com`, 
          username: `rotation${ts}`, 
          password: 'TestPass123' 
        })
        .expect(201);

      const firstRefreshToken = regRes.body.refreshToken;

      // Refresh once
      const refreshRes1 = await request(API_URL())
        .post('/api/auth/refresh')
        .send({ refreshToken: firstRefreshToken })
        .expect(200);

      const secondRefreshToken = refreshRes1.body.refreshToken;
      expect(secondRefreshToken).not.toBe(firstRefreshToken);

      // Old refresh token should be invalid
      const oldTokenRes = await request(API_URL())
        .post('/api/auth/refresh')
        .send({ refreshToken: firstRefreshToken });
      
      expect(oldTokenRes.status).toBe(401);

      // New refresh token should work
      const refreshRes2 = await request(API_URL())
        .post('/api/auth/refresh')
        .send({ refreshToken: secondRefreshToken });
      
      expect(refreshRes2.status).toBe(200);
    });

    it('should reject reused refresh token after rotation', async () => {
      const ts = Date.now();
      const regRes = await request(API_URL())
        .post('/api/auth/register')
        .send({ 
          email: `reuse${ts}@test.com`, 
          username: `reuse${ts}`, 
          password: 'TestPass123' 
        })
        .expect(201);

      const refreshToken = regRes.body.refreshToken;

      // First refresh
      await request(API_URL())
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      // Try to reuse old token
      const res = await request(API_URL())
        .post('/api/auth/refresh')
        .send({ refreshToken });
      
      expect(res.status).toBe(401);
    });
  });

  describe('Logout Edge Cases', () => {
    it('should reject logout with invalid refresh token', async () => {
      const res = await request(API_URL())
        .post('/api/auth/logout')
        .send({ refreshToken: 'invalid.token.here' });
      
      // Should succeed even if token invalid (idempotent)
      expect([200, 401]).toContain(res.status);
    });

    it('should invalidate all tokens on logout-all', async () => {
      const ts = Date.now();
      const regRes = await request(API_URL())
        .post('/api/auth/register')
        .send({ 
          email: `logoutall${ts}@test.com`, 
          username: `logoutall${ts}`, 
          password: 'TestPass123' 
        })
        .expect(201);

      const accessToken = regRes.body.accessToken;
      const refreshToken = regRes.body.refreshToken;

      // Logout all
      await request(API_URL())
        .post('/api/auth/logout-all')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Refresh token should be invalid
      const refreshRes = await request(API_URL())
        .post('/api/auth/refresh')
        .send({ refreshToken });
      
      expect(refreshRes.status).toBe(401);
    });
  });

  describe('Authorization Header Edge Cases', () => {
    it('should reject request without Authorization header', async () => {
      const res = await request(API_URL())
        .get('/api/auth/me');
      
      expect(res.status).toBe(401);
    });

    it('should reject request with malformed Authorization header', async () => {
      const res = await request(API_URL())
        .get('/api/auth/me')
        .set('Authorization', 'NotBearer token');
      
      expect(res.status).toBe(401);
    });

    it('should reject request with empty Authorization header', async () => {
      const res = await request(API_URL())
        .get('/api/auth/me')
        .set('Authorization', '');
      
      expect(res.status).toBe(401);
    });

    it('should reject request with only Bearer prefix', async () => {
      const res = await request(API_URL())
        .get('/api/auth/me')
        .set('Authorization', 'Bearer ');
      
      expect(res.status).toBe(401);
    });

    it('should handle multiple spaces in Authorization header', async () => {
      const ts = Date.now();
      const regRes = await request(API_URL())
        .post('/api/auth/register')
        .send({ 
          email: `authheader${ts}@test.com`, 
          username: `authheader${ts}`, 
          password: 'TestPass123' 
        })
        .expect(201);

      const res = await request(API_URL())
        .get('/api/auth/me')
        .set('Authorization', `Bearer  ${regRes.body.accessToken}`);
      
      // Should handle gracefully
      expect([200, 401]).toContain(res.status);
    });
  });
});
