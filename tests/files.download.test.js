/**
 * File Download and URL Signing Tests
 * Tests for file download, signed URLs, and refresh
 */

const request = require('supertest');
const path = require('path');
const fs = require('fs');
const urlSigner = require('../backend/utils/urlSigner');

const API_URL = () => global.__TEST_API_URL__;

describe('File Download API', () => {
  let accessToken;
  let roomId;
  let uploadedFileId;
  const testFileDir = path.join(__dirname, 'test-files');

  beforeAll(async () => {
    if (!fs.existsSync(testFileDir)) {
      fs.mkdirSync(testFileDir, { recursive: true });
    }

    const ts = Date.now();
    const regRes = await request(API_URL())
      .post('/api/auth/register')
      .send({
        email: `dl_test_${ts}@example.com`,
        username: `dltest${ts}`.slice(0, 20),
        password: 'TestPass123',
      })
      .expect(201);

    accessToken = regRes.body.accessToken;

    const roomRes = await request(API_URL())
      .post('/api/rooms')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    roomId = roomRes.body.room.roomId;

    // Upload a test file
    const testFilePath = path.join(testFileDir, 'download-test.txt');
    fs.writeFileSync(testFilePath, 'Test content for download');

    const uploadRes = await request(API_URL())
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('roomId', roomId)
      .attach('file', testFilePath)
      .expect(201);

    uploadedFileId = uploadRes.body.attachment.id;
  });

  afterAll(() => {
    if (fs.existsSync(testFileDir)) {
      fs.rmSync(testFileDir, { recursive: true, force: true });
    }
  });

  describe('GET /api/files/:id', () => {
    it('should download file with valid auth', async () => {
      if (!uploadedFileId) return;

      const urlRes = await request(API_URL())
        .get(`/api/files/${uploadedFileId}/url`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const signedUrl = urlRes.body.attachment.url;
      const res = await request(API_URL())
        .get(signedUrl)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.toString()).toBe('Test content for download');
    });

    it('should reject download without auth', async () => {
      if (!uploadedFileId) return;

      const urlRes = await request(API_URL())
        .get(`/api/files/${uploadedFileId}/url`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const signedUrl = urlRes.body.attachment.url;
      await request(API_URL())
        .get(signedUrl)
        .expect(401);
    });

    it('should reject download with invalid token', async () => {
      if (!uploadedFileId) return;

      const urlRes = await request(API_URL())
        .get(`/api/files/${uploadedFileId}/url`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const signedUrl = urlRes.body.attachment.url;
      await request(API_URL())
        .get(signedUrl)
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);
    });

    it('should return 404 for non-existent file', async () => {
      await request(API_URL())
        .get('/api/files/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should reject download by non-member', async () => {
      if (!uploadedFileId) return;

      const ts = Date.now();
      const outsider = await request(API_URL())
        .post('/api/auth/register')
        .send({
          email: `dl_outsider_${ts}@example.com`,
          username: `dloutsider${ts}`.slice(0, 20),
          password: 'TestPass123',
        })
        .expect(201);

      await request(API_URL())
        .get(`/api/files/${uploadedFileId}`)
        .set('Authorization', `Bearer ${outsider.body.accessToken}`)
        .expect(403);
    });

    it('should include correct content-type header', async () => {
      if (!uploadedFileId) return;

      const urlRes = await request(API_URL())
        .get(`/api/files/${uploadedFileId}/url`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const signedUrl = urlRes.body.attachment.url;
      const res = await request(API_URL())
        .get(signedUrl)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBeDefined();
    });

    it('should include content-disposition header', async () => {
      if (!uploadedFileId) return;

      const urlRes = await request(API_URL())
        .get(`/api/files/${uploadedFileId}/url`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const signedUrl = urlRes.body.attachment.url;
      const res = await request(API_URL())
        .get(signedUrl)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toBeDefined();
    });
  });

  describe('GET /api/files/:id/url', () => {
    it('should refresh signed download URL', async () => {
      if (!uploadedFileId) return;

      const res = await request(API_URL())
        .get(`/api/files/${uploadedFileId}/url`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('attachment');
      expect(res.body.attachment).toHaveProperty('url');
      expect(res.body.attachment.url).toContain('/api/files/');
      expect(res.body.attachment.url).toContain('sig=');
      expect(res.body.attachment.url).toContain('exp=');
    });

    it('should reject URL refresh without auth', async () => {
      if (!uploadedFileId) return;

      await request(API_URL())
        .get(`/api/files/${uploadedFileId}/url`)
        .expect(401);
    });

    it('should reject URL refresh for non-existent file', async () => {
      await request(API_URL())
        .get('/api/files/non-existent-id/url')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should reject URL refresh by non-member', async () => {
      if (!uploadedFileId) return;

      const ts = Date.now();
      const outsider = await request(API_URL())
        .post('/api/auth/register')
        .send({
          email: `url_outsider_${ts}@example.com`,
          username: `urloutsider${ts}`.slice(0, 20),
          password: 'TestPass123',
        })
        .expect(201);

      await request(API_URL())
        .get(`/api/files/${uploadedFileId}/url`)
        .set('Authorization', `Bearer ${outsider.body.accessToken}`)
        .expect(403);
    });

    it('should generate unique URLs for each refresh', async () => {
      if (!uploadedFileId) return;

      const urls = [];
      
      for (let i = 0; i < 3; i++) {
        const res = await request(API_URL())
          .get(`/api/files/${uploadedFileId}/url`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);
        
        urls.push(res.body.attachment.url);
      }

      // URLs should be different (different signatures/timestamps)
      const uniqueUrls = new Set(urls);
      expect(uniqueUrls.size).toBe(3);
    });

    it('should return valid expiration timestamp', async () => {
      if (!uploadedFileId) return;

      const res = await request(API_URL())
        .get(`/api/files/${uploadedFileId}/url`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const signedUrl = res.body.attachment.url;
      const match = signedUrl.match(/exp=(\d+)/);
      expect(match).toBeTruthy();
      const expiresAt = parseInt(match[1], 10) * 1000;
      const now = Date.now();
      
      // Should expire in the future
      expect(expiresAt).toBeGreaterThan(now);
      // Should expire within 1 hour (default)
      expect(expiresAt).toBeLessThan(now + 60 * 60 * 1000 + 5000); // +5s buffer
    });
  });

  describe('Signed URL Download', () => {
    it('should download using signed URL', async () => {
      if (!uploadedFileId) return;

      // Get signed URL
      const urlRes = await request(API_URL())
        .get(`/api/files/${uploadedFileId}/url`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const signedUrl = urlRes.body.attachment.url;

      // Download using signed URL (auth still required)
      const downloadRes = await request(API_URL())
        .get(signedUrl)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(downloadRes.status).toBe(200);
      expect(downloadRes.body.toString()).toBe('Test content for download');
    });

    it('should reject expired signed URL', async () => {
      if (!uploadedFileId) return;

      const expiredUrl = urlSigner.sign(`/api/files/${uploadedFileId}`, -5);

      const res = await request(API_URL())
        .get(expiredUrl)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(403);
    });

    it('should reject tampered signed URL', async () => {
      if (!uploadedFileId) return;

      // Get signed URL
      const urlRes = await request(API_URL())
        .get(`/api/files/${uploadedFileId}/url`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const signedUrl = urlRes.body.attachment.url;
      
      // Tamper with the signature
      const tamperedUrl = signedUrl.replace(/sig=[^&]*/, 'sig=tampered');

      // Try to download with tampered URL
      const downloadRes = await request(API_URL())
        .get(tamperedUrl)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(downloadRes.status).toBe(403);
    });
  });

  describe('Bulk Operations', () => {
    it('should list room attachments with metadata', async () => {
      const res = await request(API_URL())
        .get(`/api/files/room/${roomId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body.attachments)).toBe(true);
      
      if (uploadedFileId && res.body.attachments.length > 0) {
        const attachment = res.body.attachments.find(a => a.id === uploadedFileId);
        if (attachment) {
          expect(attachment).toHaveProperty('id');
          expect(attachment).toHaveProperty('filename');
          expect(attachment).toHaveProperty('mimetype');
          expect(attachment).toHaveProperty('size');
          expect(attachment).toHaveProperty('createdAt');
        }
      }
    });

    it('should support pagination in file list', async () => {
      const res = await request(API_URL())
        .get(`/api/files/room/${roomId}?page=1&limit=10`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('attachments');
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.pagination).toHaveProperty('page');
      expect(res.body.pagination).toHaveProperty('limit');
      expect(res.body.pagination).toHaveProperty('total');
    });
  });
});
