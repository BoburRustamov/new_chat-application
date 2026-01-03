import { test, expect } from '@playwright/test';

test.describe('SignalR Debug', () => {
  test('debug SignalR connection lifecycle', async ({ page }) => {
    // Capture all console messages
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      consoleLogs.push(`[${msg.type()}] ${text}`);
      console.log(`[Browser ${msg.type()}] ${text}`);
    });

    // Capture any errors
    page.on('pageerror', (err) => {
      console.log(`[Page Error] ${err.message}`);
    });

    await page.goto('/');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Take a screenshot to debug what we see
    await page.screenshot({ path: 'e2e/screenshots/login-page.png' });

    console.log('\n--- Starting Registration ---\n');

    // Register a new user
    const timestamp = Date.now();

    // Click "Sign Up" link - the text is inside a button element but styled as a link
    const signUpLink = page.getByText('Sign Up');
    await signUpLink.click();

    // Wait for register form to appear - using heading or visible text
    await page.waitForTimeout(1000); // Give React time to update
    await page.screenshot({ path: 'e2e/screenshots/register-page.png' });

    // The register form should now be visible - look for the heading
    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible({ timeout: 5000 });

    // Fill registration form - using correct placeholders from RegisterForm.tsx
    await page.getByPlaceholder('John Doe').fill('Debug User');
    await page.getByPlaceholder('johndoe').fill(`debug${timestamp}`);
    await page.getByPlaceholder('you@example.com').fill(`debug${timestamp}@test.com`);
    await page.getByPlaceholder('Create a password').fill('Password123!');
    await page.getByPlaceholder('Confirm your password').fill('Password123!');

    // Submit - the button with text "Sign Up" in the form
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    console.log('\n--- Waiting for Chat Page ---\n');

    // Wait for navigation to chat
    await page.waitForURL('**/chat', { timeout: 15000 });

    // Screenshot of chat page
    await page.screenshot({ path: 'e2e/screenshots/chat-page.png' });

    console.log('\n--- On Chat Page, Waiting for SignalR ---\n');

    // Wait longer for SignalR - React Strict Mode causes a delay
    // The second mount should succeed after the first cleanup
    await page.waitForTimeout(8000);

    // Check connection status
    const connectionStatus = await page.evaluate(() => {
      // Look for the title attribute on the wifi icon
      const icons = document.querySelectorAll('[title]');
      for (const icon of icons) {
        const title = icon.getAttribute('title');
        if (title && ['connected', 'connecting', 'reconnecting', 'disconnected'].includes(title)) {
          return title;
        }
      }
      return 'unknown';
    });

    console.log(`\n--- Connection Status: ${connectionStatus} ---\n`);
    console.log('\n--- All Console Logs ---');
    consoleLogs.forEach(log => console.log(log));

    // Screenshot showing connection status
    await page.screenshot({ path: 'e2e/screenshots/connection-status.png' });

    // The test passes if SignalR is connected
    expect(connectionStatus).toBe('connected');
  });
});
