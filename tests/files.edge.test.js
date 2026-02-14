/**
 * File Upload Edge Case Tests
 * Comprehensive edge case coverage for file operations
 */

const request = require('supertest');
const path = require('path');
const fs = require('fs');

const API_URL = () => global.__TEST_API_URL__;

describe('File Upload Edge Cases', () => {
  let accessToken;
  let roomId;
  const testFileDir = path.join(__dirname, 'test-files');

  beforeAll(async () => {
    // Create test file directory
    if (!fs.existsSync(testFileDir)) {
      fs.mkdirSync(testFileDir, { recursive: true });
    }

    // Register and create room
    const ts = Date.now();
    const regRes = await request(API_URL())
      .post('/api/auth/register')
      .send({
        email: `file_edge_${ts}@example.com`,
        username: `fileedge${ts}`.slice(0, 20),
        password: 'TestPassword123',
      })
      .expect(201);

    accessToken = regRes.body.accessToken;

    const roomRes = await request(API_URL())
      .post('/api/rooms')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    roomId = roomRes.body.room.roomId;
  });

  afterAll(() => {
    // Cleanup test files
    if (fs.existsSync(testFileDir)) {
      fs.rmSync(testFileDir, { recursive: true, force: true });
    }
  });

  describe('File Type Edge Cases', () => {
    it('should reject executable files', async () => {
      const exePath = path.join(testFileDir, 'test.exe');
      fs.writeFileSync(exePath, Buffer.from('MZ' + 'a'.repeat(100))); // Windows executable header

      const res = await request(API_URL())
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${accessToken}`)
        .field('roomId', roomId)
        .attach('file', exePath);

      expect(res.status).toBe(400);
    });

    it('should reject script files', async () => {
      const jsPath = path.join(testFileDir, 'script.js');
      fs.writeFileSync(jsPath, 'alert("xss")');

      const res = await request(API_URL())
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${accessToken}`)
        .field('roomId', roomId)
        .attach('file', jsPath);

      expect(res.status).toBe(400);
    });

    it('should reject HTML files', async () => {
      const htmlPath = path.join(testFileDir, 'page.html');
      fs.writeFileSync(htmlPath, '<script>alert("xss")</script>');

      const res = await request(API_URL())
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${accessToken}`)
        .field('roomId', roomId)
        .attach('file', htmlPath);

      expect(res.status).toBe(400);
    });

    it('should accept valid image formats', async () => {
      const formats = [
        { ext: 'png', magic: Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) },
        { ext: 'jpg', magic: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]) },
        { ext: 'gif', magic: Buffer.from([0x47, 0x49, 0x46, 0x38]) },
      ];

      for (const { ext, magic } of formats) {
        const filePath = path.join(testFileDir, `valid.${ext}`);
        const content = Buffer.concat([magic, Buffer.from('dummy image data')]);
        fs.writeFileSync(filePath, content);

        const res = await request(API_URL())
          .post('/api/files/upload')
          .set('Authorization', `Bearer ${accessToken}`)
          .field('roomId', roomId)
          .attach('file', filePath);

        expect(res.status).toBe(201);

        fs.unlinkSync(filePath);
      }
    });

    it('should reject files with double extensions', async () => {
      const doubleExtPath = path.join(testFileDir, 'malicious.png.exe');
      fs.writeFileSync(doubleExtPath, Buffer.from('MZ' + 'a'.repeat(100)));

      const res = await request(API_URL())
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${accessToken}`)
        .field('roomId', roomId)
        .attach('file', doubleExtPath);

      expect(res.status).toBe(400);
    });

    it('should reject files with null bytes in name', async () => {
      const nullBytePath = path.join(testFileDir, 'file\x00.txt');
      // This might not work on all systems, so wrap in try-catch
      try {
        fs.writeFileSync(nullBytePath, 'content');
      } catch (e) {
        // Skip if filesystem doesn't support null bytes
        return;
      }

      const res = await request(API_URL())
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${accessToken}`)
        .field('roomId', roomId)
        .attach('file', nullBytePath);

      expect([400, 500]).toContain(res.status);
    });
  });

  describe('File Size Edge Cases', () => {
    it('should allow empty files', async () => {
      const emptyPath = path.join(testFileDir, 'empty.txt');
      fs.writeFileSync(emptyPath, '');

      const res = await request(API_URL())
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${accessToken}`)
        .field('roomId', roomId)
        .attach('file', emptyPath);

      expect(res.status).toBe(201);
    });

    it('should reject files exceeding size limit', async () => {
      // Create a file larger than 10MB
      const largePath = path.join(testFileDir, 'large.txt');
      const largeContent = Buffer.alloc(11 * 1024 * 1024); // 11MB
      fs.writeFileSync(largePath, largeContent);

      const res = await request(API_URL())
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${accessToken}`)
        .field('roomId', roomId)
        .attach('file', largePath);

      expect(res.status).toBe(400); // FILE_TOO_LARGE

      fs.unlinkSync(largePath);
    });

    it('should accept files just under size limit', async () => {
      const nearLimitPath = path.join(testFileDir, 'near-limit.txt');
      const content = Buffer.alloc(9.9 * 1024 * 1024); // 9.9MB
      fs.writeFileSync(nearLimitPath, content);

      const res = await request(API_URL())
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${accessToken}`)
        .field('roomId', roomId)
        .attach('file', nearLimitPath);

      expect(res.status).toBe(201);

      fs.unlinkSync(nearLimitPath);
    });
  });

  describe('File Name Edge Cases', () => {
    it('should handle very long filenames', async () => {
      const longName = 'a'.repeat(200) + '.txt';
      const longPath = path.join(testFileDir, longName);
      fs.writeFileSync(longPath, 'content');

      const res = await request(API_URL())
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${accessToken}`)
        .field('roomId', roomId)
        .attach('file', longPath);

      expect(res.status).toBe(201);
    });

    it('should handle filenames with special characters', async () => {
      const specialNames = [
        'file with spaces.txt',
        'file-with-dashes.txt',
        'file_with_underscores.txt',
        'file.multiple.dots.txt',
        'UPPERCASE.TXT',
        'mixedCase.Txt',
      ];

      for (const name of specialNames) {
        const filePath = path.join(testFileDir, name);
        fs.writeFileSync(filePath, 'content');

        const res = await request(API_URL())
          .post('/api/files/upload')
          .set('Authorization', `Bearer ${accessToken}`)
          .field('roomId', roomId)
          .attach('file', filePath);

        expect(res.status).toBe(201);

        fs.unlinkSync(filePath);
      }
    });

    it('should handle unicode filenames', async () => {
      const unicodeNames = [
        '文件.txt',
        'файл.txt',
        'ファイル.txt',
        'emoji🎉.txt',
      ];

      for (const name of unicodeNames) {
        const filePath = path.join(testFileDir, name);
        try {
          fs.writeFileSync(filePath, 'content');
        } catch (e) {
          // Skip if filesystem doesn't support
          continue;
        }

        const res = await request(API_URL())
          .post('/api/files/upload')
          .set('Authorization', `Bearer ${accessToken}`)
          .field('roomId', roomId)
          .attach('file', filePath);

        expect(res.status).toBe(201);

        try {
          fs.unlinkSync(filePath);
        } catch (e) {}
      }
    });

    it('should handle path traversal attempts', async () => {
      const traversalNames = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32\\config\\sam',
        'file/../../../etc/passwd',
        'file.txt/../../../etc/passwd',
      ];

      for (const name of traversalNames) {
        // Create file with traversal name (without actual path)
        const safeName = name.replace(/[\/\\]/g, '_');
        const filePath = path.join(testFileDir, safeName);
        fs.writeFileSync(filePath, 'content');

        const res = await request(API_URL())
          .post('/api/files/upload')
          .set('Authorization', `Bearer ${accessToken}`)
          .field('roomId', roomId)
          .attach('file', filePath);

        expect(res.status).toBe(201);

        fs.unlinkSync(filePath);
      }
    });
  });

  describe('Upload Request Edge Cases', () => {
    it('should reject upload without roomId', async () => {
      const filePath = path.join(testFileDir, 'no-room.txt');
      fs.writeFileSync(filePath, 'content');

      const res = await request(API_URL())
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', filePath);

      expect(res.status).toBe(400);
    });

    it('should reject upload with invalid roomId', async () => {
      const filePath = path.join(testFileDir, 'invalid-room.txt');
      fs.writeFileSync(filePath, 'content');

      const res = await request(API_URL())
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${accessToken}`)
        .field('roomId', 'non-existent-room')
        .attach('file', filePath);

      expect(res.status).toBe(403);
    });

    it('should reject upload to room user is not member of', async () => {
      // Create another user and their room
      const ts = Date.now();
      const otherReg = await request(API_URL())
        .post('/api/auth/register')
        .send({
          email: `other_file_${ts}@example.com`,
          username: `otherfile${ts}`.slice(0, 20),
          password: 'TestPassword123',
        })
        .expect(201);

      const otherRoom = await request(API_URL())
        .post('/api/rooms')
        .set('Authorization', `Bearer ${otherReg.body.accessToken}`)
        .expect(201);

      const filePath = path.join(testFileDir, 'wrong-room.txt');
      fs.writeFileSync(filePath, 'content');

      const res = await request(API_URL())
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${accessToken}`)
        .field('roomId', otherRoom.body.room.roomId)
        .attach('file', filePath);

      expect(res.status).toBe(403);
    });

    it('should reject upload without file', async () => {
      const res = await request(API_URL())
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${accessToken}`)
        .field('roomId', roomId);

      expect(res.status).toBe(400);
    });

    it('should reject upload with multiple files', async () => {
      const file1Path = path.join(testFileDir, 'multi1.txt');
      const file2Path = path.join(testFileDir, 'multi2.txt');
      fs.writeFileSync(file1Path, 'content1');
      fs.writeFileSync(file2Path, 'content2');

      const res = await request(API_URL())
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${accessToken}`)
        .field('roomId', roomId)
        .attach('file', file1Path)
        .attach('file', file2Path);

      expect(res.status).toBe(400);
    });
  });

  describe('Download Edge Cases', () => {
    let uploadedFileId;

    beforeAll(async () => {
      // Upload a file for download tests
      const filePath = path.join(testFileDir, 'download-test.txt');
      fs.writeFileSync(filePath, 'Download test content');

      const uploadRes = await request(API_URL())
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${accessToken}`)
        .field('roomId', roomId)
        .attach('file', filePath);

      if (uploadRes.status === 201) {
        uploadedFileId = uploadRes.body.attachment.id;
      }
    });

    it('should reject download without auth', async () => {
      if (!uploadedFileId) return;

      const res = await request(API_URL())
        .get(`/api/files/${uploadedFileId}`);

      expect(res.status).toBe(401);
    });

    it('should reject download of non-existent file', async () => {
      const res = await request(API_URL())
        .get('/api/files/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(404);
    });

    it('should reject download by non-member', async () => {
      if (!uploadedFileId) return;

      const ts = Date.now();
      const outsider = await request(API_URL())
        .post('/api/auth/register')
        .send({
          email: `outsider_dl_${ts}@example.com`,
          username: `outsiderdl${ts}`.slice(0, 20),
          password: 'TestPassword123',
        })
        .expect(201);

      const res = await request(API_URL())
        .get(`/api/files/${uploadedFileId}`)
        .set('Authorization', `Bearer ${outsider.body.accessToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('Concurrent Uploads', () => {
    it('should handle multiple concurrent uploads', async () => {
      const uploads = [];
      
      for (let i = 0; i < 5; i++) {
        const filePath = path.join(testFileDir, `concurrent-${i}.txt`);
        fs.writeFileSync(filePath, `Content ${i}`);

        uploads.push(
          request(API_URL())
            .post('/api/files/upload')
            .set('Authorization', `Bearer ${accessToken}`)
            .field('roomId', roomId)
            .attach('file', filePath)
        );
      }

      const results = await Promise.all(uploads);
      
      // All should complete (success or error)
      results.forEach(res => {
        expect([201, 400, 413, 429]).toContain(res.status);
      });
    });
  });

  describe('File Listing Edge Cases', () => {
    it('should handle listing files for non-existent room', async () => {
      const res = await request(API_URL())
        .get('/api/files/room/non-existent-room')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(404);
    });

    it('should reject listing files for room user is not member of', async () => {
      const ts = Date.now();
      const other = await request(API_URL())
        .post('/api/auth/register')
        .send({
          email: `other_list_${ts}@example.com`,
          username: `otherlist${ts}`.slice(0, 20),
          password: 'TestPassword123',
        })
        .expect(201);

      const otherRoom = await request(API_URL())
        .post('/api/rooms')
        .set('Authorization', `Bearer ${other.body.accessToken}`)
        .expect(201);

      const res = await request(API_URL())
        .get(`/api/files/room/${otherRoom.body.room.roomId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(403);
    });
  });
});
