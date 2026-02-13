const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TEST_DB_PATH = path.join(__dirname, '..', 'messenger.test.db');

process.env.NODE_ENV = 'test';

// Generate random secrets for each test run instead of hardcoded values
// This ensures tests don't trigger secret scanners while maintaining security
function generateTestSecret() {
  return crypto.randomBytes(32).toString('hex');
}

// Use environment variables if set, otherwise generate random secrets
process.env.JWT_SECRET = process.env.JWT_SECRET || generateTestSecret();
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || generateTestSecret();
process.env.URL_SIGNING_SECRET = process.env.URL_SIGNING_SECRET || generateTestSecret();
process.env.DATABASE_PATH = TEST_DB_PATH;

const { createApp } = require('../backend/app');

let runtime = null;

beforeAll(async () => {
  // Clean up any existing test database
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }

  runtime = createApp({ enableHttps: false });
  const ports = await runtime.startServer({ port: 0 });

  global.__TEST_API_URL__ = `http://127.0.0.1:${ports.port}`;
}, 30000);

afterAll(async () => {
  if (runtime) {
    await runtime.stopServer();
  }

  // Clean up test database
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
}, 30000);
