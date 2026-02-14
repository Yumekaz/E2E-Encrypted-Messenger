/**
 * File Integrity Utility Tests
 */

const fileIntegrity = require('../backend/utils/fileIntegrity');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

describe('File Integrity Utility', () => {
  const testDir = path.join(__dirname, 'test-integrity-files');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Clean test directory before each test
    const files = fs.readdirSync(testDir);
    files.forEach(file => {
      fs.unlinkSync(path.join(testDir, file));
    });
  });

  describe('calculateHash()', () => {
    it('should calculate consistent hash for file', async () => {
      const testFile = path.join(testDir, 'test.txt');
      fs.writeFileSync(testFile, 'test content');
      
      const hash1 = await fileIntegrity.calculateHash(testFile);
      const hash2 = await fileIntegrity.calculateHash(testFile);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex length
    });

    it('should calculate different hashes for different content', async () => {
      const testFile1 = path.join(testDir, 'test1.txt');
      const testFile2 = path.join(testDir, 'test2.txt');
      fs.writeFileSync(testFile1, 'content 1');
      fs.writeFileSync(testFile2, 'content 2');
      
      const hash1 = await fileIntegrity.calculateHash(testFile1);
      const hash2 = await fileIntegrity.calculateHash(testFile2);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should calculate correct SHA-256 hash', async () => {
      const testFile = path.join(testDir, 'test.txt');
      const content = 'test content';
      fs.writeFileSync(testFile, content);
      
      const hash = await fileIntegrity.calculateHash(testFile);
      const expectedHash = crypto.createHash('sha256').update(content).digest('hex');
      
      expect(hash).toBe(expectedHash);
    });

    it('should handle empty file', async () => {
      const testFile = path.join(testDir, 'empty.txt');
      fs.writeFileSync(testFile, '');
      
      const hash = await fileIntegrity.calculateHash(testFile);
      const expectedHash = crypto.createHash('sha256').update('').digest('hex');
      
      expect(hash).toBe(expectedHash);
    });

    it('should handle large file', async () => {
      const testFile = path.join(testDir, 'large.bin');
      const content = crypto.randomBytes(1024 * 1024); // 1MB
      fs.writeFileSync(testFile, content);
      
      const hash = await fileIntegrity.calculateHash(testFile);
      const expectedHash = crypto.createHash('sha256').update(content).digest('hex');
      
      expect(hash).toBe(expectedHash);
    });

    it('should reject for non-existent file', async () => {
      const nonExistent = path.join(testDir, 'does-not-exist.txt');
      
      await expect(fileIntegrity.calculateHash(nonExistent)).rejects.toThrow();
    });

    it('should handle binary content', async () => {
      const testFile = path.join(testDir, 'binary.bin');
      const content = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe]);
      fs.writeFileSync(testFile, content);
      
      const hash = await fileIntegrity.calculateHash(testFile);
      const expectedHash = crypto.createHash('sha256').update(content).digest('hex');
      
      expect(hash).toBe(expectedHash);
    });

    it('should handle unicode content', async () => {
      const testFile = path.join(testDir, 'unicode.txt');
      const content = 'Hello 世界 🌍';
      fs.writeFileSync(testFile, content);
      
      const hash = await fileIntegrity.calculateHash(testFile);
      const expectedHash = crypto.createHash('sha256').update(content).digest('hex');
      
      expect(hash).toBe(expectedHash);
    });
  });

  describe('verifyFile()', () => {
    it('should detect missing file', async () => {
      const attachment = {
        id: 'test-123',
        filepath: 'does-not-exist.txt',
        size: 100,
      };
      
      const result = await fileIntegrity.verifyFile(attachment);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not found');
      expect(result.missing).toBe(true);
    });

    it('should return correct structure for missing file', async () => {
      const attachment = {
        id: 'test-123',
        filepath: 'missing.txt',
        size: 100,
      };
      
      const result = await fileIntegrity.verifyFile(attachment);
      
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('missing');
      expect(result.valid).toBe(false);
      expect(result.missing).toBe(true);
    });
  });

  describe('cleanupOrphanedFiles()', () => {
    it('should be defined as a function', () => {
      expect(typeof fileIntegrity.cleanupOrphanedFiles).toBe('function');
    });
  });

  describe('cleanupMissingFiles()', () => {
    it('should be defined as a function', () => {
      expect(typeof fileIntegrity.cleanupMissingFiles).toBe('function');
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent hash calculations', async () => {
      const files = [];
      for (let i = 0; i < 5; i++) {
        const file = path.join(testDir, `concurrent-${i}.txt`);
        fs.writeFileSync(file, `content ${i}`);
        files.push(file);
      }
      
      const hashes = await Promise.all(
        files.map(f => fileIntegrity.calculateHash(f))
      );
      
      expect(hashes).toHaveLength(5);
      hashes.forEach(hash => {
        expect(hash).toHaveLength(64);
      });
    });

    it('should handle file with only whitespace', async () => {
      const testFile = path.join(testDir, 'whitespace.txt');
      fs.writeFileSync(testFile, '   \n\t  ');
      
      const hash = await fileIntegrity.calculateHash(testFile);
      expect(hash).toHaveLength(64);
    });

    it('should handle single character file', async () => {
      const testFile = path.join(testDir, 'single.txt');
      fs.writeFileSync(testFile, 'x');
      
      const hash = await fileIntegrity.calculateHash(testFile);
      expect(hash).toHaveLength(64);
    });

    it('should handle file with newlines only', async () => {
      const testFile = path.join(testDir, 'newlines.txt');
      fs.writeFileSync(testFile, '\n\n\n');
      
      const hash = await fileIntegrity.calculateHash(testFile);
      expect(hash).toHaveLength(64);
    });

    it('should handle file with null bytes', async () => {
      const testFile = path.join(testDir, 'nulls.bin');
      fs.writeFileSync(testFile, Buffer.from([0x00, 0x00, 0x00]));
      
      const hash = await fileIntegrity.calculateHash(testFile);
      expect(hash).toHaveLength(64);
    });

    it('should handle very long content', async () => {
      const testFile = path.join(testDir, 'long.txt');
      const content = 'a'.repeat(100000);
      fs.writeFileSync(testFile, content);
      
      const hash = await fileIntegrity.calculateHash(testFile);
      const expectedHash = crypto.createHash('sha256').update(content).digest('hex');
      
      expect(hash).toBe(expectedHash);
    });
  });
});
