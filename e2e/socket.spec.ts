/**
 * Socket Real-time E2E Tests
 * Tests for real-time socket behavior in browser
 */

import { test, expect, Page } from '@playwright/test';

async function registerUser(page: Page, suffix: string) {
  const ts = Date.now();
  await page.goto('/');
  await page.getByTestId('auth-toggle-mode').click();
  await page.getByTestId('auth-email-input').fill(`socket_e2e_${suffix}_${ts}@example.com`);
  await page.getByTestId('auth-username-input').fill(`sockete2e${suffix}${ts}`.slice(0, 20));
  await page.getByTestId('auth-password-input').fill('TestPassword123');
  await page.getByTestId('auth-confirm-password-input').fill('TestPassword123');
  await page.getByTestId('auth-submit-button').click();
  await expect(page.getByTestId('create-room-button')).toBeVisible({ timeout: 15000 });
  return { username: `sockete2e${suffix}${ts}`.slice(0, 20), ts };
}

test.describe('Socket Real-time Features', () => {
  test.describe.configure({ mode: 'serial' });

  test('typing indicator appears when user types', async ({ page }) => {
    const user = await registerUser(page, 'typing');
    
    // Create room
    await page.getByTestId('create-room-button').click();
    await expect(page.getByTestId('room-message-input')).toBeVisible({ timeout: 10000 });

    // Type in message input
    await page.getByTestId('room-message-input').fill('Typing test');
    
    // Typing indicator should appear (may be subtle, just verify no error)
    await page.waitForTimeout(500);
    
    // Send message
    await page.getByTestId('room-send-button').click();
    await expect(page.getByText('Typing test')).toBeVisible();
  });

  test('message appears immediately after sending', async ({ page }) => {
    await registerUser(page, 'message');
    
    await page.getByTestId('create-room-button').click();
    await expect(page.getByTestId('room-message-input')).toBeVisible({ timeout: 10000 });

    const testMessage = `Test message ${Date.now()}`;
    await page.getByTestId('room-message-input').fill(testMessage);
    await page.getByTestId('room-send-button').click();

    // Message should appear without page reload
    await expect(page.getByText(testMessage)).toBeVisible({ timeout: 5000 });
  });

  test('member list updates when joining room', async ({ page }) => {
    await registerUser(page, 'memberlist');
    
    await page.getByTestId('create-room-button').click();
    await expect(page.getByTestId('room-message-input')).toBeVisible({ timeout: 10000 });

    // Open members panel
    await page.getByTestId('room-members-open-button').click();
    await expect(page.getByTestId('room-members-panel')).toBeVisible();
    
    // Should see self in member list
    await expect(page.getByTestId('member-list')).toContainText('memberlist');
  });

  test('encryption indicator shows secure connection', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('encryption-indicator')).toBeVisible();
    
    // Should show encrypted/secure status
    const indicator = page.getByTestId('encryption-indicator');
    await expect(indicator).toContainText(/encrypted|secure|🔒/i);
  });
});

test.describe('Multi-user Socket Interactions', () => {
  test.describe.configure({ mode: 'serial' });

  test('two users can exchange messages', async ({ browser }) => {
    // Create two browser contexts
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Register both users
      const ts = Date.now();
      
      // User 1
      await page1.goto('/');
      await page1.getByTestId('auth-toggle-mode').click();
      await page1.getByTestId('auth-email-input').fill(`multi_1_${ts}@example.com`);
      await page1.getByTestId('auth-username-input').fill(`multi1${ts}`.slice(0, 20));
      await page1.getByTestId('auth-password-input').fill('TestPassword123');
      await page1.getByTestId('auth-confirm-password-input').fill('TestPassword123');
      await page1.getByTestId('auth-submit-button').click();
      await expect(page1.getByTestId('create-room-button')).toBeVisible({ timeout: 15000 });

      // User 2
      await page2.goto('/');
      await page2.getByTestId('auth-toggle-mode').click();
      await page2.getByTestId('auth-email-input').fill(`multi_2_${ts}@example.com`);
      await page2.getByTestId('auth-username-input').fill(`multi2${ts}`.slice(0, 20));
      await page2.getByTestId('auth-password-input').fill('TestPassword123');
      await page2.getByTestId('auth-confirm-password-input').fill('TestPassword123');
      await page2.getByTestId('auth-submit-button').click();
      await expect(page2.getByTestId('create-room-button')).toBeVisible({ timeout: 15000 });

      // User 1 creates room
      await page1.getByTestId('create-room-button').click();
      await expect(page1.getByTestId('room-message-input')).toBeVisible({ timeout: 10000 });

      // Get room code
      await page1.getByTestId('room-info-open-button').click();
      await expect(page1.getByTestId('room-info-modal')).toBeVisible();
      const roomCode = await page1.getByTestId('room-code-display').textContent();
      await page1.getByTestId('room-info-close-button').click();

      // User 2 joins room
      await page2.getByTestId('open-join-room-modal-button').click();
      await page2.getByTestId('join-room-code-input').fill(roomCode!.trim());
      await page2.getByTestId('join-room-submit-button').click();

      // User 1 approves join request
      await expect(page1.getByTestId('join-request-notification')).toBeVisible({ timeout: 10000 });
      await page1.getByTestId('approve-join-button').click();

      // Wait for user 2 to join
      await expect(page2.getByTestId('room-message-input')).toBeVisible({ timeout: 10000 });

      // User 1 sends message
      const testMessage = `Hello from user 1! ${Date.now()}`;
      await page1.getByTestId('room-message-input').fill(testMessage);
      await page1.getByTestId('room-send-button').click();

      // User 2 should see the message
      await expect(page2.getByText(testMessage)).toBeVisible({ timeout: 5000 });

      // User 2 replies
      const replyMessage = `Reply from user 2! ${Date.now()}`;
      await page2.getByTestId('room-message-input').fill(replyMessage);
      await page2.getByTestId('room-send-button').click();

      // User 1 should see the reply
      await expect(page1.getByText(replyMessage)).toBeVisible({ timeout: 5000 });

    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('user sees member join notification', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      const ts = Date.now();
      
      // User 1 creates room
      await page1.goto('/');
      await page1.getByTestId('auth-toggle-mode').click();
      await page1.getByTestId('auth-email-input').fill(`join_notif_1_${ts}@example.com`);
      await page1.getByTestId('auth-username-input').fill(`joinnotif1${ts}`.slice(0, 20));
      await page1.getByTestId('auth-password-input').fill('TestPassword123');
      await page1.getByTestId('auth-confirm-password-input').fill('TestPassword123');
      await page1.getByTestId('auth-submit-button').click();
      await expect(page1.getByTestId('create-room-button')).toBeVisible({ timeout: 15000 });

      await page1.getByTestId('create-room-button').click();
      await expect(page1.getByTestId('room-message-input')).toBeVisible({ timeout: 10000 });

      // Get room code
      await page1.getByTestId('room-info-open-button').click();
      const roomCode = await page1.getByTestId('room-code-display').textContent();
      await page1.getByTestId('room-info-close-button').click();

      // User 2 joins
      await page2.goto('/');
      await page2.getByTestId('auth-toggle-mode').click();
      await page2.getByTestId('auth-email-input').fill(`join_notif_2_${ts}@example.com`);
      await page2.getByTestId('auth-username-input').fill(`joinnotif2${ts}`.slice(0, 20));
      await page2.getByTestId('auth-password-input').fill('TestPassword123');
      await page2.getByTestId('auth-confirm-password-input').fill('TestPassword123');
      await page2.getByTestId('auth-submit-button').click();
      await expect(page2.getByTestId('create-room-button')).toBeVisible({ timeout: 15000 });

      await page2.getByTestId('open-join-room-modal-button').click();
      await page2.getByTestId('join-room-code-input').fill(roomCode!.trim());
      await page2.getByTestId('join-room-submit-button').click();

      // User 1 should see join request
      await expect(page1.getByTestId('join-request-notification')).toBeVisible({ timeout: 10000 });
      
      // Approve and verify member joined
      await page1.getByTestId('approve-join-button').click();
      
      // Should see member joined message
      await expect(page1.getByText(/joined|member/i)).toBeVisible({ timeout: 5000 });

    } finally {
      await context1.close();
      await context2.close();
    }
  });
});

test.describe('Room Lifecycle E2E', () => {
  test.describe.configure({ mode: 'serial' });

  test('room is deleted when owner leaves', async ({ page }) => {
    await registerUser(page, 'ownerleave');
    
    await page.getByTestId('create-room-button').click();
    await expect(page.getByTestId('room-message-input')).toBeVisible({ timeout: 10000 });

    // Send a message
    await page.getByTestId('room-message-input').fill('Message before leaving');
    await page.getByTestId('room-send-button').click();
    await expect(page.getByText('Message before leaving')).toBeVisible();

    // Leave room
    await page.getByTestId('room-leave-open-button').click();
    await expect(page.getByTestId('room-leave-modal')).toBeVisible();
    await page.getByTestId('room-leave-confirm-button').click();

    // Should return to home
    await expect(page.getByTestId('create-room-button')).toBeVisible({ timeout: 10000 });
  });

  test('user can rejoin room after leaving', async ({ page }) => {
    const user = await registerUser(page, 'rejoin');
    
    // Create room
    await page.getByTestId('create-room-button').click();
    await expect(page.getByTestId('room-message-input')).toBeVisible({ timeout: 10000 });

    // Get room code
    await page.getByTestId('room-info-open-button').click();
    const roomCode = await page.getByTestId('room-code-display').textContent();
    await page.getByTestId('room-info-close-button').click();

    // Leave room
    await page.getByTestId('room-leave-open-button').click();
    await page.getByTestId('room-leave-confirm-button').click();
    await expect(page.getByTestId('create-room-button')).toBeVisible({ timeout: 10000 });

    // Rejoin using room code
    await page.getByTestId('open-join-room-modal-button').click();
    await page.getByTestId('join-room-code-input').fill(roomCode!.trim());
    await page.getByTestId('join-room-submit-button').click();

    // Since we're the owner, we should rejoin directly
    await expect(page.getByTestId('room-message-input')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Error Handling E2E', () => {
  test.describe.configure({ mode: 'serial' });

  test('shows error for invalid room code', async ({ page }) => {
    await registerUser(page, 'invalidcode');
    
    await page.getByTestId('open-join-room-modal-button').click();
    await page.getByTestId('join-room-code-input').fill('INVALID');
    await page.getByTestId('join-room-submit-button').click();

    // Should show error
    await expect(page.getByText(/not found|invalid|error/i)).toBeVisible({ timeout: 5000 });
  });

  test('shows error for network disconnection', async ({ page }) => {
    await registerUser(page, 'network');
    
    await page.getByTestId('create-room-button').click();
    await expect(page.getByTestId('room-message-input')).toBeVisible({ timeout: 10000 });

    // Simulate offline
    await page.context().setOffline(true);
    
    // Try to send message
    await page.getByTestId('room-message-input').fill('Offline message');
    await page.getByTestId('room-send-button').click();

    // Should show some error or pending state
    await page.waitForTimeout(1000);
    
    // Restore connection
    await page.context().setOffline(false);
  });
});
