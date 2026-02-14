/**
 * Input Validators Tests
 */

const validators = require('../backend/utils/validators');
const { ValidationError } = require('../backend/utils/errors');

describe('Validators', () => {
  describe('isValidEmail()', () => {
    it('should validate correct email addresses', () => {
      expect(validators.isValidEmail('test@example.com')).toBe(true);
      expect(validators.isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(validators.isValidEmail('user+tag@example.com')).toBe(true);
      expect(validators.isValidEmail('123@numeric.com')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(validators.isValidEmail('')).toBe(false);
      expect(validators.isValidEmail('notanemail')).toBe(false);
      expect(validators.isValidEmail('@example.com')).toBe(false);
      expect(validators.isValidEmail('test@')).toBe(false);
      expect(validators.isValidEmail('test@.com')).toBe(false);
      expect(validators.isValidEmail('test@com')).toBe(false);
      expect(validators.isValidEmail('test example.com')).toBe(false);
    });

    it('should reject null and undefined', () => {
      expect(validators.isValidEmail(null)).toBe(false);
      expect(validators.isValidEmail(undefined)).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(validators.isValidEmail('a@b.co')).toBe(true);
      expect(validators.isValidEmail('very.long.email@very.long.domain.com')).toBe(true);
    });
  });

  describe('isValidPassword()', () => {
    it('should validate strong passwords', () => {
      expect(validators.isValidPassword('Password123')).toBe(true);
      expect(validators.isValidPassword('MyP@ssw0rd')).toBe(true);
      expect(validators.isValidPassword('abc123def')).toBe(true);
      expect(validators.isValidPassword('1234567a')).toBe(true);
    });

    it('should reject short passwords', () => {
      expect(validators.isValidPassword('short1')).toBe(false);
      expect(validators.isValidPassword('a1')).toBe(false);
      expect(validators.isValidPassword('1234567')).toBe(false);
    });

    it('should reject passwords without letters', () => {
      expect(validators.isValidPassword('12345678')).toBe(false);
      expect(validators.isValidPassword('1234567890')).toBe(false);
    });

    it('should reject passwords without numbers', () => {
      expect(validators.isValidPassword('password')).toBe(false);
      expect(validators.isValidPassword('PasswordOnly')).toBe(false);
    });

    it('should reject empty passwords', () => {
      expect(validators.isValidPassword('')).toBe(false);
    });

    it('should accept exactly 8 characters', () => {
      expect(validators.isValidPassword('Passw0rd')).toBe(true);
    });

    it('should accept long passwords', () => {
      expect(validators.isValidPassword('VeryLongPassword1234567890')).toBe(true);
    });
  });

  describe('isValidUsername()', () => {
    it('should validate correct usernames', () => {
      expect(validators.isValidUsername('user123')).toBe(true);
      expect(validators.isValidUsername('john_doe')).toBe(true);
      expect(validators.isValidUsername('ABC')).toBe(true);
      expect(validators.isValidUsername('a1_b2')).toBe(true);
    });

    it('should reject short usernames', () => {
      expect(validators.isValidUsername('ab')).toBe(false);
      expect(validators.isValidUsername('a')).toBe(false);
    });

    it('should reject long usernames', () => {
      expect(validators.isValidUsername('a'.repeat(21))).toBe(false);
      expect(validators.isValidUsername('very_long_username_12345')).toBe(false);
    });

    it('should accept exactly 3 characters', () => {
      expect(validators.isValidUsername('abc')).toBe(true);
    });

    it('should accept exactly 20 characters', () => {
      expect(validators.isValidUsername('a'.repeat(20))).toBe(true);
    });

    it('should reject usernames with special characters', () => {
      expect(validators.isValidUsername('user@name')).toBe(false);
      expect(validators.isValidUsername('user.name')).toBe(false);
      expect(validators.isValidUsername('user-name')).toBe(false);
      expect(validators.isValidUsername('user name')).toBe(false);
      expect(validators.isValidUsername('user!name')).toBe(false);
    });

    it('should reject empty username', () => {
      expect(validators.isValidUsername('')).toBe(false);
    });

    it('should allow underscores', () => {
      expect(validators.isValidUsername('user_name')).toBe(true);
      expect(validators.isValidUsername('_user_')).toBe(true);
    });
  });

  describe('isValidRoomCode()', () => {
    it('should validate correct room codes', () => {
      expect(validators.isValidRoomCode('ABC123')).toBe(true);
      expect(validators.isValidRoomCode('123456')).toBe(true);
      expect(validators.isValidRoomCode('ABCDEF')).toBe(true);
      expect(validators.isValidRoomCode('A1B2C3')).toBe(true);
    });

    it('should reject lowercase letters', () => {
      expect(validators.isValidRoomCode('abc123')).toBe(false);
      expect(validators.isValidRoomCode('Abc123')).toBe(false);
    });

    it('should reject short codes', () => {
      expect(validators.isValidRoomCode('ABC12')).toBe(false);
      expect(validators.isValidRoomCode('ABC')).toBe(false);
    });

    it('should reject long codes', () => {
      expect(validators.isValidRoomCode('ABC1234')).toBe(false);
      expect(validators.isValidRoomCode('ABC123456')).toBe(false);
    });

    it('should reject codes with special characters', () => {
      expect(validators.isValidRoomCode('ABC-12')).toBe(false);
      expect(validators.isValidRoomCode('ABC 12')).toBe(false);
      expect(validators.isValidRoomCode('ABC@12')).toBe(false);
    });

    it('should reject empty code', () => {
      expect(validators.isValidRoomCode('')).toBe(false);
    });
  });

  describe('sanitizeString()', () => {
    it('should trim whitespace', () => {
      expect(validators.sanitizeString('  hello  ')).toBe('hello');
      expect(validators.sanitizeString('\t\nhello\t\n')).toBe('hello');
    });

    it('should limit length to 1000 characters', () => {
      const longString = 'a'.repeat(2000);
      const result = validators.sanitizeString(longString);
      expect(result.length).toBe(1000);
    });

    it('should handle empty string', () => {
      expect(validators.sanitizeString('')).toBe('');
    });

    it('should handle non-string input', () => {
      expect(validators.sanitizeString(null)).toBe('');
      expect(validators.sanitizeString(undefined)).toBe('');
      expect(validators.sanitizeString(123)).toBe('');
      expect(validators.sanitizeString({})).toBe('');
    });

    it('should preserve valid content', () => {
      expect(validators.sanitizeString('Hello World')).toBe('Hello World');
      expect(validators.sanitizeString('test@example.com')).toBe('test@example.com');
    });

    it('should handle unicode characters', () => {
      expect(validators.sanitizeString('  你好  ')).toBe('你好');
      expect(validators.sanitizeString('  🌍  ')).toBe('🌍');
    });
  });

  describe('validateRegistration()', () => {
    it('should validate correct registration data', () => {
      const data = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'Password123',
      };

      const result = validators.validateRegistration(data);

      expect(result.email).toBe('test@example.com');
      expect(result.username).toBe('testuser');
      expect(result.password).toBe('Password123');
    });

    it('should normalize email to lowercase', () => {
      const data = {
        email: 'TEST@EXAMPLE.COM',
        username: 'testuser',
        password: 'Password123',
      };

      const result = validators.validateRegistration(data);

      expect(result.email).toBe('test@example.com');
    });

    it('should lowercase email', () => {
      const data = {
        email: 'TEST@EXAMPLE.COM',
        username: 'testuser',
        password: 'Password123',
      };

      const result = validators.validateRegistration(data);

      expect(result.email).toBe('test@example.com');
    });

    it('should throw ValidationError for invalid email', () => {
      const data = {
        email: 'invalid-email',
        username: 'testuser',
        password: 'Password123',
      };

      expect(() => validators.validateRegistration(data)).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid username', () => {
      const data = {
        email: 'test@example.com',
        username: 'ab',
        password: 'Password123',
      };

      expect(() => validators.validateRegistration(data)).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid password', () => {
      const data = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'short',
      };

      expect(() => validators.validateRegistration(data)).toThrow(ValidationError);
    });

    it('should throw ValidationError with details', () => {
      const data = {
        email: 'invalid',
        username: 'ab',
        password: 'short',
      };

      try {
        validators.validateRegistration(data);
        fail('Should have thrown ValidationError');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect(err.details).toBeInstanceOf(Array);
        expect(err.details.length).toBeGreaterThan(0);
      }
    });

    it('should throw for missing fields', () => {
      expect(() => validators.validateRegistration({})).toThrow(ValidationError);
      expect(() => validators.validateRegistration(null)).toThrow();
      expect(() => validators.validateRegistration(undefined)).toThrow();
    });
  });

  describe('validateLogin()', () => {
    it('should validate correct login data', () => {
      const data = {
        email: 'test@example.com',
        password: 'Password123',
      };

      const result = validators.validateLogin(data);

      expect(result.email).toBe('test@example.com');
      expect(result.password).toBe('Password123');
    });

    it('should normalize email to lowercase', () => {
      const data = {
        email: 'TEST@EXAMPLE.COM',
        password: 'Password123',
      };

      const result = validators.validateLogin(data);

      expect(result.email).toBe('test@example.com');
    });

    it('should throw ValidationError for invalid email', () => {
      const data = {
        email: 'invalid-email',
        password: 'Password123',
      };

      expect(() => validators.validateLogin(data)).toThrow(ValidationError);
    });

    it('should throw ValidationError for missing password', () => {
      const data = {
        email: 'test@example.com',
        password: '',
      };

      expect(() => validators.validateLogin(data)).toThrow(ValidationError);
    });

    it('should throw ValidationError for null password', () => {
      const data = {
        email: 'test@example.com',
        password: null,
      };

      expect(() => validators.validateLogin(data)).toThrow(ValidationError);
    });

    it('should accept any non-empty password', () => {
      const data = {
        email: 'test@example.com',
        password: 'x',
      };

      // Login doesn't validate password strength, just presence
      const result = validators.validateLogin(data);
      expect(result.password).toBe('x');
    });
  });

  describe('validateMessage()', () => {
    it('should validate correct message data', () => {
      const data = {
        roomId: 'room-123',
        encryptedData: 'encrypted-content',
        iv: 'initialization-vector',
      };

      const result = validators.validateMessage(data);

      expect(result.roomId).toBe('room-123');
      expect(result.encryptedData).toBe('encrypted-content');
      expect(result.iv).toBe('initialization-vector');
    });

    it('should throw ValidationError for missing encryptedData', () => {
      const data = {
        roomId: 'room-123',
        iv: 'initialization-vector',
      };

      expect(() => validators.validateMessage(data)).toThrow(ValidationError);
    });

    it('should throw ValidationError for missing iv', () => {
      const data = {
        roomId: 'room-123',
        encryptedData: 'encrypted-content',
      };

      expect(() => validators.validateMessage(data)).toThrow(ValidationError);
    });

    it('should throw ValidationError for missing roomId', () => {
      const data = {
        encryptedData: 'encrypted-content',
        iv: 'initialization-vector',
      };

      expect(() => validators.validateMessage(data)).toThrow(ValidationError);
    });

    it('should sanitize roomId', () => {
      const data = {
        roomId: '  room-123  ',
        encryptedData: 'encrypted-content',
        iv: 'initialization-vector',
      };

      const result = validators.validateMessage(data);

      expect(result.roomId).toBe('room-123');
    });

    it('should preserve encrypted data as-is', () => {
      const data = {
        roomId: 'room-123',
        encryptedData: '  encrypted-content  ',
        iv: '  iv  ',
      };

      const result = validators.validateMessage(data);

      // Encrypted data and IV should not be sanitized
      expect(result.encryptedData).toBe('  encrypted-content  ');
      expect(result.iv).toBe('  iv  ');
    });
  });
});
