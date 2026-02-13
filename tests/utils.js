/**
 * Test Utilities
 * Helper functions for tests to avoid hardcoded credentials
 */

const crypto = require('crypto');

/**
 * Generate a random test password that meets validation requirements
 * @returns {string} A random valid password
 */
function generateTestPassword() {
  const random = crypto.randomBytes(8).toString('hex');
  return `Pass${random}1`;
}

/**
 * Generate a unique test email
 * @param {string} prefix - Optional prefix for the email
 * @returns {string} A unique test email
 */
function generateTestEmail(prefix = 'test') {
  const random = crypto.randomBytes(4).toString('hex');
  const timestamp = Date.now();
  return `${prefix}_${random}_${timestamp}@test.local`;
}

/**
 * Generate a unique test username
 * @param {string} prefix - Optional prefix for the username
 * @returns {string} A unique test username
 */
function generateTestUsername(prefix = 'user') {
  const random = crypto.randomBytes(4).toString('hex');
  const timestamp = Date.now();
  return `${prefix}${random}${timestamp}`.slice(0, 20);
}

/**
 * Create a complete test user object
 * @param {string} prefix - Optional prefix for identifiers
 * @returns {Object} Test user data
 */
function generateTestUser(prefix = 'test') {
  return {
    email: generateTestEmail(prefix),
    username: generateTestUsername(prefix),
    password: generateTestPassword(),
  };
}

module.exports = {
  generateTestPassword,
  generateTestEmail,
  generateTestUsername,
  generateTestUser,
};
