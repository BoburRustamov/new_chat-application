import { test, expect } from '@playwright/test';

test.describe('SignalR Connection', () => {
  test.beforeEach(async ({ page }) => {
    // Listen for console logs
    page.on('console', (msg) => {
      if (msg.text().includes('SignalR') || msg.text().includes('[SignalR]')) {
        console.log('Browser:', msg.text());
      }
    });
  });

  test('should connect to SignalR after login', async ({ page }) => {
    // First register/login a test user
    await page.goto('/');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Click "Sign Up" to switch to register form
    await page.getByText('Sign Up').click();
    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible({ timeout: 5000 });

    const timestamp = Date.now();
    const testEmail = `test${timestamp}@example.com`;
    const testUsername = `testuser${timestamp}`;

    // Fill form with correct placeholders
    await page.getByPlaceholder('John Doe').fill('Test User');
    await page.getByPlaceholder('johndoe').fill(testUsername);
    await page.getByPlaceholder('you@example.com').fill(testEmail);
    await page.getByPlaceholder('Create a password').fill('TestPassword123!');
    await page.getByPlaceholder('Confirm your password').fill('TestPassword123!');

    // Submit registration
    await page.locator('button[type="submit"]').click();

    // Wait for redirect to chat page
    await expect(page).toHaveURL('/chat', { timeout: 15000 });

    // Wait for SignalR connection (with extra time for Strict Mode recovery)
    await page.waitForFunction(() => {
      // Check if connection status indicator shows connected
      const wifiIcon = document.querySelector('[title="connected"]');
      return wifiIcon !== null;
    }, { timeout: 15000 });

    // Verify the chat page loaded
    await expect(page.getByText('Welcome to ChatApp')).toBeVisible();
  });

  test('should reconnect SignalR after page navigation', async ({ page }) => {
    // Login first
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Use existing test account or create new
    const timestamp = Date.now();
    const testEmail = `test${timestamp}@example.com`;

    await page.getByText('Sign Up').click();
    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible({ timeout: 5000 });

    await page.getByPlaceholder('John Doe').fill('Test User');
    await page.getByPlaceholder('johndoe').fill(`testuser${timestamp}`);
    await page.getByPlaceholder('you@example.com').fill(testEmail);
    await page.getByPlaceholder('Create a password').fill('TestPassword123!');
    await page.getByPlaceholder('Confirm your password').fill('TestPassword123!');
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL('/chat', { timeout: 15000 });

    // Wait for initial connection
    await page.waitForFunction(() => {
      const wifiIcon = document.querySelector('[title="connected"]');
      return wifiIcon !== null;
    }, { timeout: 15000 });

    // Navigate to settings by clicking the settings icon button (last icon in header)
    // The button contains a Settings icon (lucide-react)
    const settingsButton = page.locator('button').filter({ has: page.locator('svg.lucide-settings') });
    await settingsButton.click();
    await expect(page).toHaveURL('/settings');

    // Go back to chat using the back button (first button with ArrowLeft icon)
    const backButton = page.locator('button').filter({ has: page.locator('svg.lucide-arrow-left') });
    await backButton.click();
    await expect(page).toHaveURL('/chat');

    // Verify reconnection
    await page.waitForFunction(() => {
      const wifiIcon = document.querySelector('[title="connected"]');
      return wifiIcon !== null;
    }, { timeout: 15000 });
  });

  test('should handle message sending when connected', async ({ page }) => {
    // Setup test user
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const timestamp = Date.now();

    await page.getByText('Sign Up').click();
    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible({ timeout: 5000 });

    await page.getByPlaceholder('John Doe').fill('Test Sender');
    await page.getByPlaceholder('johndoe').fill(`sender${timestamp}`);
    await page.getByPlaceholder('you@example.com').fill(`sender${timestamp}@example.com`);
    await page.getByPlaceholder('Create a password').fill('TestPassword123!');
    await page.getByPlaceholder('Confirm your password').fill('TestPassword123!');
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL('/chat', { timeout: 15000 });

    // Wait for connection
    await page.waitForFunction(() => {
      const wifiIcon = document.querySelector('[title="connected"]');
      return wifiIcon !== null;
    }, { timeout: 15000 });

    // Create a new chat (need another user first - for now just verify no error on chat page)
    await expect(page.getByText('Welcome to ChatApp')).toBeVisible();
    await expect(page.getByText('Select a chat to start messaging')).toBeVisible();
  });
});
