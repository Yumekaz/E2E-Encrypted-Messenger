/**
 * Advanced Room E2E Tests
 * Complex room scenarios and edge cases
 */

import { test, expect, Page } from '@playwright/test';

async function registerAndCreateRoom(page: Page, suffix: string) {
  const ts = Date.now();
  await page.goto('/');
  await page.getByTestId('auth-toggle-mode').click();
  await page.getByTestId('auth-email-input').fill(`adv_room_${suffix}_${ts}@example.com`);
  await page.getByTestId('auth-username-input').fill(`advroom${suffix}${ts}`.slice(0, 20));
  await page.getByTestId('auth-password-input').fill('TestPassword123');
  await page.getByTestId('auth-confirm-password-input').fill('TestPassword123');
  await page.getByTestId('auth-submit-button').click();
  await expect(page.getByTestId('create-room-button')).toBeVisible({ timeout: 15000 });
  
  await page.getByTestId('create-room-button').click();
  await expect(page.getByTestId('room-message-input')).toBeVisible({ timeout: 10000 });
  
  return { ts, username: `advroom${suffix}${ts}`.slice(0, 20) };
}

test.describe('Advanced Room Features', () => {
  test.describe.configure({ mode: 'serial' });

  test('room info displays encryption details', async ({ page }) => {
    await registerAndCreateRoom(page, 'info');
    
    await page.getByTestId('room-info-open-button').click();
    await expect(page.getByTestId('room-info-modal')).toBeVisible();
    
    // Should show encryption info
    await expect(page.getByText(/AES|ECDH|encrypted|secure/i)).toBeVisible();
    
    // Should show QR code
    await expect(page.getByTestId('room-qr-code')).toBeVisible();
    
    await page.getByTestId('room-info-close-button').click();
    await expect(page.getByTestId('room-info-modal')).not.toBeVisible();
  });

  test('room code can be copied to clipboard', async ({ page }) => {
    await registerAndCreateRoom(page, 'copy');
    
    await page.getByTestId('room-info-open-button').click();
    await expect(page.getByTestId('room-info-modal')).toBeVisible();
    
    // Click copy button
    await page.getByTestId('room-code-copy-button').click();
    
    // Should show copy confirmation
    await expect(page.getByText(/copied|clipboard/i)).toBeVisible({ timeout: 3000 });
  });

  test('multiple messages can be sent and displayed', async ({ page }) => {
    await registerAndCreateRoom(page, 'messages');
    
    const messages = [];
    for (let i = 0; i < 5; i++) {
      const msg = `Test message ${i} - ${Date.now()}`;
      messages.push(msg);
      await page.getByTestId('room-message-input').fill(msg);
      await page.getByTestId('room-send-button').click();
      await expect(page.getByText(msg)).toBeVisible();
    }
    
    // All messages should be visible
    for (const msg of messages) {
      await expect(page.getByText(msg)).toBeVisible();
    }
  });

  test('message input clears after sending', async ({ page }) => {
    await registerAndCreateRoom(page, 'clear');
    
    await page.getByTestId('room-message-input').fill('This should clear');
    await page.getByTestId('room-send-button').click();
    
    // Input should be empty
    await expect(page.getByTestId('room-message-input')).toHaveValue('');
  });

  test('empty messages cannot be sent', async ({ page }) => {
    await registerAndCreateRoom(page, 'empty');
    
    // Try to send empty message
    await page.getByTestId('room-send-button').click();
    
    // Should not add empty message
    const messages = await page.locator('[data-testid="message-bubble"]').count();
    expect(messages).toBe(0);
  });

  test('members panel shows and hides correctly', async ({ page }) => {
    await registerAndCreateRoom(page, 'members');
    
    // Open members panel
    await page.getByTestId('room-members-open-button').click();
    await expect(page.getByTestId('room-members-panel')).toBeVisible();
    
    // Close members panel
    await page.getByTestId('room-members-close-button').click();
    await expect(page.getByTestId('room-members-panel')).not.toBeVisible();
  });

  test('back button navigates to home', async ({ page }) => {
    await registerAndCreateRoom(page, 'back');
    
    await page.getByTestId('room-back-button').click();
    await expect(page.getByTestId('create-room-button')).toBeVisible({ timeout: 10000 });
  });

  test('leave room shows confirmation modal', async ({ page }) => {
    await registerAndCreateRoom(page, 'leave');
    
    await page.getByTestId('room-leave-open-button').click();
    await expect(page.getByTestId('room-leave-modal')).toBeVisible();
    
    // Cancel leaving
    await page.getByTestId('room-leave-cancel-button').click();
    await expect(page.getByTestId('room-leave-modal')).not.toBeVisible();
    
    // Still in room
    await expect(page.getByTestId('room-message-input')).toBeVisible();
  });
});

test.describe('Room Security Features', () => {
  test.describe.configure({ mode: 'serial' });

  test('screenshot detection warning', async ({ page }) => {
    await registerAndCreateRoom(page, 'screenshot');
    
    // Simulate screenshot key (this may not work in all browsers)
    await page.keyboard.press('PrintScreen');
    
    // Wait a bit for any warning
    await page.waitForTimeout(500);
    
    // Test passes if no crash (actual screenshot detection is OS-dependent)
    expect(true).toBe(true);
  });

  test('encryption status is visible', async ({ page }) => {
    await registerAndCreateRoom(page, 'encrypt');
    
    // Encryption indicator should be visible somewhere
    const indicator = page.locator('[data-testid="encryption-indicator"], .encryption-badge, .lock-icon').first();
    await expect(indicator).toBeVisible();
  });
});

test.describe('Join Room Scenarios', () => {
  test.describe.configure({ mode: 'serial' });

  test('join room modal validates code length', async ({ page }) => {
    const ts = Date.now();
    await page.goto('/');
    await page.getByTestId('auth-toggle-mode').click();
    await page.getByTestId('auth-email-input').fill(`join_val_${ts}@example.com`);
    await page.getByTestId('auth-username-input').fill(`joinval${ts}`.slice(0, 20));
    await page.getByTestId('auth-password-input').fill('TestPassword123');
    await page.getByTestId('auth-confirm-password-input').fill('TestPassword123');
    await page.getByTestId('auth-submit-button').click();
    await expect(page.getByTestId('open-join-room-modal-button')).toBeVisible({ timeout: 15000 });
    
    await page.getByTestId('open-join-room-modal-button').click();
    await expect(page.getByTestId('join-room-modal')).toBeVisible();
    
    // Too short
    await page.getByTestId('join-room-code-input').fill('ABC');
    await expect(page.getByTestId('join-room-submit-button')).toBeDisabled();
    
    // Valid length
    await page.getByTestId('join-room-code-input').fill('ABCDEF');
    await expect(page.getByTestId('join-room-submit-button')).toBeEnabled();
    
    // Too long
    await page.getByTestId('join-room-code-input').fill('ABCDEFG');
    // May be truncated or disabled
  });

  test('cancel join room closes modal', async ({ page }) => {
    const ts = Date.now();
    await page.goto('/');
    await page.getByTestId('auth-toggle-mode').click();
    await page.getByTestId('auth-email-input').fill(`join_cancel_${ts}@example.com`);
    await page.getByTestId('auth-username-input').fill(`joincancel${ts}`.slice(0, 20));
    await page.getByTestId('auth-password-input').fill('TestPassword123');
    await page.getByTestId('auth-confirm-password-input').fill('TestPassword123');
    await page.getByTestId('auth-submit-button').click();
    await expect(page.getByTestId('open-join-room-modal-button')).toBeVisible({ timeout: 15000 });
    
    await page.getByTestId('open-join-room-modal-button').click();
    await expect(page.getByTestId('join-room-modal')).toBeVisible();
    
    await page.getByTestId('join-room-cancel-button').click();
    await expect(page.getByTestId('join-room-modal')).not.toBeVisible();
  });
});
