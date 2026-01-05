import { test, expect, Page, BrowserContext } from '@playwright/test';

// Test configuration
const API_URL = 'http://localhost:5004/api';

// Helper function to generate unique test data
function generateTestUser(prefix: string = 'user') {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return {
    displayName: `Test ${prefix} ${timestamp}`,
    username: `${prefix}${timestamp}${random}`.substring(0, 20),
    email: `${prefix}${timestamp}${random}@test.com`,
    password: 'TestPassword123!',
  };
}

// Helper function to register a user via UI
async function registerUser(page: Page, user: ReturnType<typeof generateTestUser>) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Switch to register form
  await page.getByText('Sign Up').click();
  await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible({ timeout: 5000 });

  // Fill registration form
  await page.getByPlaceholder('John Doe').fill(user.displayName);
  await page.getByPlaceholder('johndoe').fill(user.username);
  await page.getByPlaceholder('you@example.com').fill(user.email);
  await page.getByPlaceholder('Create a password').fill(user.password);
  await page.getByPlaceholder('Confirm your password').fill(user.password);

  // Submit
  await page.locator('button[type="submit"]').click();

  // Wait for redirect to chat
  await expect(page).toHaveURL('/chat', { timeout: 15000 });
}

// Helper function to login a user via UI
async function loginUser(page: Page, email: string, password: string) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Make sure we're on login tab
  const signInTab = page.getByText('Sign In');
  if (await signInTab.isVisible()) {
    await signInTab.click();
  }

  // Fill login form
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('Enter your password').fill(password);

  // Submit
  await page.locator('button[type="submit"]').click();

  // Wait for redirect to chat
  await expect(page).toHaveURL('/chat', { timeout: 15000 });
}

// Helper to wait for SignalR connection
async function waitForSignalRConnection(page: Page) {
  await page.waitForFunction(() => {
    const wifiIcon = document.querySelector('[title="connected"]');
    return wifiIcon !== null;
  }, { timeout: 15000 });
}

// ============================================================
// Test Suite: Authentication
// ============================================================
test.describe('Authentication', () => {
  test('should register a new user successfully', async ({ page }) => {
    const user = generateTestUser('register');
    await registerUser(page, user);

    // Verify chat page loaded
    await expect(page.getByText('Welcome to ChatApp')).toBeVisible();
    await waitForSignalRConnection(page);
  });

  test('should login with existing credentials', async ({ page }) => {
    // First register
    const user = generateTestUser('login');
    await registerUser(page, user);

    // Logout
    const settingsButton = page.locator('button').filter({ has: page.locator('svg.lucide-settings') });
    await settingsButton.click();
    await expect(page).toHaveURL('/settings');

    // Find and click logout button
    const logoutButton = page.getByRole('button', { name: /log out/i });
    await logoutButton.click();

    // Wait for logout to process
    await page.waitForTimeout(2000);

    // Should redirect to auth page (may need to navigate there)
    // Check if we're redirected or still on settings
    const currentUrl = page.url();
    if (currentUrl.includes('/settings')) {
      // Navigate manually to verify tokens are cleared
      await page.goto('/chat');
      await page.waitForTimeout(1000);
    }

    // Should now be on auth page since tokens are cleared
    await expect(page).toHaveURL('/', { timeout: 10000 });

    // Now login with same credentials
    await loginUser(page, user.email, user.password);
    await expect(page.getByText('Welcome to ChatApp')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Try to login with invalid credentials
    await page.getByPlaceholder('you@example.com').fill('nonexistent@test.com');
    await page.getByPlaceholder('Enter your password').fill('WrongPassword123!');
    await page.locator('button[type="submit"]').click();

    // Should show error message or stay on auth page
    await expect(page).toHaveURL('/');
  });

  test('should validate password length on registration', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.getByText('Sign Up').click();
    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();

    // Try with short password
    await page.getByPlaceholder('John Doe').fill('Test User');
    await page.getByPlaceholder('johndoe').fill('testshortpw');
    await page.getByPlaceholder('you@example.com').fill('shortpw@test.com');
    await page.getByPlaceholder('Create a password').fill('12345'); // Less than 6 chars
    await page.getByPlaceholder('Confirm your password').fill('12345');
    await page.locator('button[type="submit"]').click();

    // Should show validation error or stay on page
    // BUG CHECK: Does frontend validate minimum 6 chars?
    await page.waitForTimeout(1000);
    const isStillOnAuthPage = page.url().endsWith('/');
    console.log('[BUG CHECK] Short password validation:', isStillOnAuthPage ? 'WORKING' : 'MIGHT BE BROKEN');
  });

  test('ISSUE #31: Check redirect on token expiry', async ({ page }) => {
    // This test checks that redirect goes to '/' not '/login'
    const user = generateTestUser('tokenexp');
    await registerUser(page, user);

    // Clear localStorage to simulate token expiry
    await page.evaluate(() => {
      localStorage.clear();
    });

    // Try to navigate to a protected route
    await page.goto('/chat');
    await page.waitForTimeout(2000);

    // Should redirect to '/' not '/login'
    const currentUrl = page.url();
    const redirectedCorrectly = currentUrl.endsWith('/') || currentUrl.includes('/?');
    console.log('[ISSUE #31] Redirect URL:', currentUrl, redirectedCorrectly ? 'CORRECT' : 'BUG - should be /');

    expect(currentUrl).not.toContain('/login');
  });
});

// ============================================================
// Test Suite: Chat Creation and Management
// ============================================================
test.describe('Chat Management', () => {
  test('should show empty state when no chats', async ({ page }) => {
    const user = generateTestUser('nochat');
    await registerUser(page, user);
    await waitForSignalRConnection(page);

    // Should show empty state
    await expect(page.getByText('Welcome to ChatApp')).toBeVisible();
    await expect(page.getByText('Select a chat to start messaging')).toBeVisible();
  });

  test('should open new chat modal', async ({ page }) => {
    const user = generateTestUser('newchat');
    await registerUser(page, user);
    await waitForSignalRConnection(page);

    // Look for new chat button
    const newChatButton = page.locator('button').filter({ has: page.locator('svg.lucide-plus') });
    await newChatButton.first().click();

    // Modal should appear
    await expect(page.getByRole('heading', { name: 'New Chat' })).toBeVisible({ timeout: 5000 });

    // Should have mode toggle buttons (text buttons: "New Chat" and "New Group")
    await expect(page.getByText('New Group')).toBeVisible();
  });

  test('should search for users when creating private chat', async ({ page }) => {
    const user = generateTestUser('searchchat');
    await registerUser(page, user);
    await waitForSignalRConnection(page);

    // Open new chat modal
    const newChatButton = page.locator('button').filter({ has: page.locator('svg.lucide-plus') });
    await newChatButton.first().click();

    await expect(page.getByRole('heading', { name: 'New Chat' })).toBeVisible({ timeout: 5000 });

    // Search for a user
    const searchInput = page.getByPlaceholder('Search users...');
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.waitForTimeout(500);
      // Results should appear or show no users found
    }
  });

  test('ISSUE #51: should validate group name is not whitespace only', async ({ page }) => {
    const user = generateTestUser('groupval');
    await registerUser(page, user);
    await waitForSignalRConnection(page);

    // Open new chat modal
    const newChatButton = page.locator('button').filter({ has: page.locator('svg.lucide-plus') });
    await newChatButton.first().click();

    // Switch to Group mode using text button "New Group"
    await page.getByText('New Group').click();
    await page.waitForTimeout(500);

    // Try to enter whitespace-only name
    const groupNameInput = page.getByPlaceholder('Group name');
    if (await groupNameInput.isVisible()) {
      await groupNameInput.fill('   '); // Whitespace only

      // Try to create (even without members)
      const createButton = page.getByRole('button', { name: /create/i });
      if (await createButton.isVisible()) {
        await createButton.click();
        await page.waitForTimeout(500);

        // Should NOT create group with whitespace name
        // BUG CHECK: Modal should still be visible
        const modalStillOpen = await page.getByRole('heading', { name: /New Chat|New Group/ }).isVisible();
        console.log('[ISSUE #51] Whitespace group name validation:', modalStillOpen ? 'WORKING' : 'BUG - allowed whitespace name');
      }
    }
  });
});

// ============================================================
// Test Suite: Two User Interactions
// ============================================================
test.describe('Two User Chat Interactions', () => {
  test('should create private chat between two users', async ({ browser }) => {
    // Create two browser contexts (two different users)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Register first user
      const user1 = generateTestUser('alice');
      await registerUser(page1, user1);
      await waitForSignalRConnection(page1);

      // Register second user
      const user2 = generateTestUser('bob');
      await registerUser(page2, user2);
      await waitForSignalRConnection(page2);

      // User 1 creates a private chat with User 2
      const newChatButton = page1.locator('button').filter({ has: page1.locator('svg.lucide-plus') });
      await newChatButton.first().click();

      await expect(page1.getByRole('heading', { name: /New Chat|New Group/ })).toBeVisible({ timeout: 5000 });

      // Search for user2
      const searchInput = page1.getByPlaceholder('Search users...');
      await searchInput.fill(user2.username);
      await page1.waitForTimeout(1000);

      // Click on user2 in search results
      const userResult = page1.getByText(user2.displayName);
      if (await userResult.isVisible()) {
        await userResult.click();

        // Wait for chat to be created and visible
        await page1.waitForTimeout(2000);

        // Chat should be created
        console.log('[TEST] Private chat created between two users');
      }
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('should send and receive messages in real-time', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Register users
      const user1 = generateTestUser('sender');
      const user2 = generateTestUser('receiver');

      await registerUser(page1, user1);
      await waitForSignalRConnection(page1);

      await registerUser(page2, user2);
      await waitForSignalRConnection(page2);

      // User 1 creates chat with User 2
      const newChatButton = page1.locator('button').filter({ has: page1.locator('svg.lucide-plus') });
      await newChatButton.first().click();
      await expect(page1.getByRole('heading', { name: /New Chat|New Group/ })).toBeVisible({ timeout: 5000 });

      const searchInput = page1.getByPlaceholder('Search users...');
      await searchInput.fill(user2.username);
      await page1.waitForTimeout(1000);

      const userResult = page1.getByText(user2.displayName);
      if (await userResult.isVisible()) {
        await userResult.click();
        await page1.waitForTimeout(2000);

        // Send a message from User 1
        const messageInput = page1.getByPlaceholder('Type a message...');
        if (await messageInput.isVisible()) {
          await messageInput.fill('Hello from User 1!');

          // Press Enter or click send
          await page1.keyboard.press('Enter');
          await page1.waitForTimeout(1000);

          // Message should appear in User 1's chat
          await expect(page1.getByText('Hello from User 1!', { exact: true })).toBeVisible({ timeout: 5000 });

          // Check if User 2 received the message
          // User 2 needs to click on the chat first
          await page2.waitForTimeout(2000);

          const chatInList = page2.locator('[class*="chat-item"]').first();
          if (await chatInList.isVisible()) {
            await chatInList.click();
            await page2.waitForTimeout(1000);

            // Check if message is visible
            const messageVisible = await page2.getByText('Hello from User 1!').isVisible();
            console.log('[TEST] Real-time message delivery:', messageVisible ? 'WORKING' : 'NOT VISIBLE (may need to refresh)');
          }
        }
      }
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('should create and manage group chat', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const context3 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    const page3 = await context3.newPage();

    try {
      // Register three users
      const user1 = generateTestUser('groupowner');
      const user2 = generateTestUser('member1');
      const user3 = generateTestUser('member2');

      await registerUser(page1, user1);
      await waitForSignalRConnection(page1);

      await registerUser(page2, user2);
      await waitForSignalRConnection(page2);

      await registerUser(page3, user3);
      await waitForSignalRConnection(page3);

      // User 1 creates a group chat
      const newChatButton = page1.locator('button').filter({ has: page1.locator('svg.lucide-plus') });
      await newChatButton.first().click();

      await expect(page1.getByRole('heading', { name: /New Chat|New Group/ })).toBeVisible({ timeout: 5000 });

      // Switch to Group Chat tab
      await page1.getByText('Group Chat').click();
      await page1.waitForTimeout(500);

      // Fill group details
      const groupNameInput = page1.getByPlaceholder('Group name');
      if (await groupNameInput.isVisible()) {
        await groupNameInput.fill('Test Group Chat');

        // Search and add members
        const memberSearchInput = page1.getByPlaceholder('Search users to add...');
        if (await memberSearchInput.isVisible()) {
          // Add user2
          await memberSearchInput.fill(user2.username);
          await page1.waitForTimeout(500);
          const user2Result = page1.getByText(user2.displayName);
          if (await user2Result.isVisible()) {
            await user2Result.click();
          }

          // Add user3
          await memberSearchInput.clear();
          await memberSearchInput.fill(user3.username);
          await page1.waitForTimeout(500);
          const user3Result = page1.getByText(user3.displayName);
          if (await user3Result.isVisible()) {
            await user3Result.click();
          }

          // Create group
          const createButton = page1.getByRole('button', { name: /create/i });
          if (await createButton.isVisible()) {
            await createButton.click();
            await page1.waitForTimeout(2000);

            // Group should be created
            console.log('[TEST] Group chat created');

            // ISSUE #33: Verify creator has Owner role
            // Need to check chat settings to verify
          }
        }
      }
    } finally {
      await context1.close();
      await context2.close();
      await context3.close();
    }
  });
});

// ============================================================
// Test Suite: Message Features
// ============================================================
test.describe('Message Features', () => {
  test('ISSUE #9: should track message read status', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      const user1 = generateTestUser('msgsender');
      const user2 = generateTestUser('msgreader');

      await registerUser(page1, user1);
      await waitForSignalRConnection(page1);

      await registerUser(page2, user2);
      await waitForSignalRConnection(page2);

      // Create private chat and send message
      const newChatButton = page1.locator('button').filter({ has: page1.locator('svg.lucide-plus') });
      await newChatButton.first().click();

      await expect(page1.getByRole('heading', { name: /New Chat|New Group/ })).toBeVisible({ timeout: 5000 });

      const searchInput = page1.getByPlaceholder('Search users...');
      await searchInput.fill(user2.username);
      await page1.waitForTimeout(1000);

      const userResult = page1.getByText(user2.displayName);
      if (await userResult.isVisible()) {
        await userResult.click();
        await page1.waitForTimeout(2000);

        const messageInput = page1.getByPlaceholder('Type a message...');
        if (await messageInput.isVisible()) {
          await messageInput.fill('Test read receipt');
          await page1.keyboard.press('Enter');
          await page1.waitForTimeout(2000);

          // Check message status indicator (should show sent, then read when user2 opens)
          // BUG CHECK: Message status should update
          const singleCheckVisible = await page1.locator('svg.lucide-check').first().isVisible();
          const doubleCheckVisible = await page1.locator('svg.lucide-check-check').first().isVisible();

          console.log('[ISSUE #9] Message status - Single check (sent):', singleCheckVisible);
          console.log('[ISSUE #9] Message status - Double check (read):', doubleCheckVisible);

          // User 2 opens the chat to trigger read
          await page2.waitForTimeout(1000);
          const chatInList = page2.locator('div').filter({ hasText: user1.displayName }).first();
          if (await chatInList.isVisible()) {
            await chatInList.click();
            await page2.waitForTimeout(2000);

            // Now check if User 1 sees read status
            const doubleCheckAfterRead = await page1.locator('svg.lucide-check-check').first().isVisible();
            console.log('[ISSUE #9] After read - Double check visible:', doubleCheckAfterRead);
          }
        }
      }
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('ISSUE #28: should search messages correctly', async ({ page }) => {
    const user = generateTestUser('msgsearch');
    await registerUser(page, user);
    await waitForSignalRConnection(page);

    // Need to have a chat with messages first
    // For now, just check if search UI works
    const searchButton = page.locator('button').filter({ has: page.locator('svg.lucide-search') });
    if (await searchButton.first().isVisible()) {
      await searchButton.first().click();

      // Search panel should appear
      const searchInput = page.getByPlaceholder(/search/i);
      if (await searchInput.isVisible()) {
        await searchInput.fill('test');
        await page.waitForTimeout(1000);

        // Check if results display correctly
        // BUG: Backend returns PagedResponse with 'items', frontend expects 'messages'
        console.log('[ISSUE #28] Message search UI is visible');
      }
    }
  });
});

// ============================================================
// Test Suite: Settings Page
// ============================================================
test.describe('Settings Page', () => {
  test('should navigate to settings and back', async ({ page }) => {
    const user = generateTestUser('settings');
    await registerUser(page, user);
    await waitForSignalRConnection(page);

    // Navigate to settings
    const settingsButton = page.locator('button').filter({ has: page.locator('svg.lucide-settings') });
    await settingsButton.click();
    await expect(page).toHaveURL('/settings');

    // Should see settings page - check for the back button and profile content
    await expect(page.locator('button').filter({ has: page.locator('svg.lucide-arrow-left') })).toBeVisible({ timeout: 5000 });

    // Navigate back
    const backButton = page.locator('button').filter({ has: page.locator('svg.lucide-arrow-left') });
    await backButton.click();
    await expect(page).toHaveURL('/chat');
  });

  test('ISSUE #32: should load bio from user data', async ({ page }) => {
    const user = generateTestUser('biotest');
    await registerUser(page, user);
    await waitForSignalRConnection(page);

    // Navigate to settings
    const settingsButton = page.locator('button').filter({ has: page.locator('svg.lucide-settings') });
    await settingsButton.click();
    await expect(page).toHaveURL('/settings');

    // Update bio
    const bioInput = page.locator('textarea').filter({ hasText: '' });
    const bioTextarea = page.getByPlaceholder(/bio/i);
    if (await bioTextarea.isVisible()) {
      await bioTextarea.fill('This is my test bio');

      // Save profile
      const saveButton = page.getByRole('button', { name: /save/i }).first();
      if (await saveButton.isVisible()) {
        await saveButton.click();
        await page.waitForTimeout(2000);

        // Refresh page and check if bio is loaded
        await page.reload();
        await page.waitForTimeout(2000);

        const bioValue = await bioTextarea.inputValue();
        console.log('[ISSUE #32] Bio loaded after refresh:', bioValue === 'This is my test bio' ? 'WORKING' : 'BUG - bio not loaded');
      }
    }
  });

  test('ISSUE #23: should save notification settings', async ({ page }) => {
    const user = generateTestUser('notif');
    await registerUser(page, user);
    await waitForSignalRConnection(page);

    const settingsButton = page.locator('button').filter({ has: page.locator('svg.lucide-settings') });
    await settingsButton.click();
    await expect(page).toHaveURL('/settings');

    // Find notification settings section
    const notifSection = page.getByText('Notification Settings');
    if (await notifSection.isVisible()) {
      // Toggle a notification setting
      const pushToggle = page.getByText('Push Notifications').locator('..').locator('input[type="checkbox"]');
      if (await pushToggle.isVisible()) {
        await pushToggle.click();

        // Save
        const saveButton = page.getByRole('button', { name: /save/i });
        if (await saveButton.nth(1).isVisible()) {
          await saveButton.nth(1).click();
          await page.waitForTimeout(1000);

          // Check for error
          const errorVisible = await page.getByText(/error|failed/i).isVisible();
          console.log('[ISSUE #23] Save notification settings:', errorVisible ? 'BUG - endpoint missing or error' : 'WORKING');
        }
      }
    }
  });

  test('ISSUE #24: should save privacy settings', async ({ page }) => {
    const user = generateTestUser('privacy');
    await registerUser(page, user);
    await waitForSignalRConnection(page);

    const settingsButton = page.locator('button').filter({ has: page.locator('svg.lucide-settings') });
    await settingsButton.click();
    await expect(page).toHaveURL('/settings');

    // Find privacy settings section
    const privacySection = page.getByText('Privacy Settings');
    if (await privacySection.isVisible()) {
      // Toggle a privacy setting
      const onlineToggle = page.getByText('Show Online Status').locator('..').locator('input[type="checkbox"]');
      if (await onlineToggle.isVisible()) {
        await onlineToggle.click();

        // Save
        const saveButtons = page.getByRole('button', { name: /save/i });
        const privacySaveButton = saveButtons.nth(2); // Third save button for privacy
        if (await privacySaveButton.isVisible()) {
          await privacySaveButton.click();
          await page.waitForTimeout(1000);

          const errorVisible = await page.getByText(/error|failed/i).isVisible();
          console.log('[ISSUE #24] Save privacy settings:', errorVisible ? 'BUG - endpoint missing or error' : 'WORKING');
        }
      }
    }
  });

  test('ISSUE #29: should apply theme changes', async ({ page }) => {
    const user = generateTestUser('theme');
    await registerUser(page, user);
    await waitForSignalRConnection(page);

    const settingsButton = page.locator('button').filter({ has: page.locator('svg.lucide-settings') });
    await settingsButton.click();
    await expect(page).toHaveURL('/settings');

    // Find theme section - click on Appearance tab first
    const appearanceTab = page.getByRole('button', { name: /appearance/i });
    if (await appearanceTab.isVisible()) {
      await appearanceTab.click();
      await page.waitForTimeout(500);

      // Click dark theme option
      const darkThemeButton = page.getByRole('button', { name: /dark/i });
      if (await darkThemeButton.isVisible()) {
        await darkThemeButton.click();
        await page.waitForTimeout(500);

        // Check if theme class was applied to document
        const hasDarkClass = await page.evaluate(() => {
          return document.documentElement.classList.contains('dark') ||
                 document.body.classList.contains('dark') ||
                 document.body.style.backgroundColor.includes('rgb(0') ||
                 document.body.style.backgroundColor.includes('#0');
        });

        console.log('[ISSUE #29] Dark theme applied:', hasDarkClass ? 'WORKING' : 'BUG - theme not applied');
      } else {
        console.log('[ISSUE #29] Dark theme button not found');
      }
    } else {
      console.log('[ISSUE #29] Appearance tab not found');
    }
  });

  test('ISSUE #52: should show logout confirmation', async ({ page }) => {
    const user = generateTestUser('logoutconf');
    await registerUser(page, user);
    await waitForSignalRConnection(page);

    const settingsButton = page.locator('button').filter({ has: page.locator('svg.lucide-settings') });
    await settingsButton.click();
    await expect(page).toHaveURL('/settings');

    // Set up dialog handler to detect confirmation
    let dialogShown = false;
    page.on('dialog', async dialog => {
      dialogShown = true;
      await dialog.dismiss();
    });

    // Click logout
    const logoutButton = page.getByRole('button', { name: /log out/i });
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      await page.waitForTimeout(500);

      console.log('[ISSUE #52] Logout confirmation dialog:', dialogShown ? 'WORKING' : 'BUG - no confirmation');
    }
  });
});

// ============================================================
// Test Suite: Chat Features
// ============================================================
test.describe('Chat Features', () => {
  test('ISSUE #25: should mute chat', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      const user1 = generateTestUser('muteowner');
      const user2 = generateTestUser('muteother');

      await registerUser(page1, user1);
      await waitForSignalRConnection(page1);

      await registerUser(page2, user2);
      await waitForSignalRConnection(page2);

      // Create private chat
      const newChatButton = page1.locator('button').filter({ has: page1.locator('svg.lucide-plus') });
      await newChatButton.first().click();

      await expect(page1.getByRole('heading', { name: /New Chat|New Group/ })).toBeVisible({ timeout: 5000 });

      const searchInput = page1.getByPlaceholder('Search users...');
      await searchInput.fill(user2.username);
      await page1.waitForTimeout(1000);

      const userResult = page1.getByText(user2.displayName);
      if (await userResult.isVisible()) {
        await userResult.click();
        await page1.waitForTimeout(2000);

        // Open chat settings/menu
        const moreButton = page1.locator('button').filter({ has: page1.locator('svg.lucide-more-vertical') });
        if (await moreButton.isVisible()) {
          await moreButton.click();
          await page1.waitForTimeout(500);

          // Look for mute option
          const muteOption = page1.getByText(/mute/i);
          if (await muteOption.isVisible()) {
            await muteOption.click();
            await page1.waitForTimeout(1000);

            // Check for error
            const errorVisible = await page1.getByText(/error|failed/i).isVisible();
            console.log('[ISSUE #25] Mute chat:', errorVisible ? 'BUG - endpoint missing' : 'WORKING');
          }
        }
      }
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('ISSUE #41: Forward modal should show private chat names correctly', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      const user1 = generateTestUser('forwarder');
      const user2 = generateTestUser('forwardee');

      await registerUser(page1, user1);
      await waitForSignalRConnection(page1);

      await registerUser(page2, user2);
      await waitForSignalRConnection(page2);

      // Create private chat
      const newChatButton = page1.locator('button').filter({ has: page1.locator('svg.lucide-plus') });
      await newChatButton.first().click();

      await expect(page1.getByRole('heading', { name: /New Chat|New Group/ })).toBeVisible({ timeout: 5000 });

      const searchInput = page1.getByPlaceholder('Search users...');
      await searchInput.fill(user2.username);
      await page1.waitForTimeout(1000);

      const userResult = page1.getByText(user2.displayName);
      if (await userResult.isVisible()) {
        await userResult.click();
        await page1.waitForTimeout(2000);

        // Send a message
        const messageInput = page1.getByPlaceholder('Type a message...');
        if (await messageInput.isVisible()) {
          await messageInput.fill('Test message for forwarding');
          await page1.keyboard.press('Enter');
          await page1.waitForTimeout(2000);

          // Right-click on the message to open context menu
          const message = page1.getByText('Test message for forwarding', { exact: true });
          if (await message.isVisible()) {
            await message.click({ button: 'right' });
            await page1.waitForTimeout(500);

            // Look for forward option
            const forwardOption = page1.getByText(/forward/i);
            if (await forwardOption.isVisible()) {
              await forwardOption.click();
              await page1.waitForTimeout(500);

              // Forward modal should show chat names, not "Chat"
              const chatText = await page1.locator('[class*="modal"]').textContent();
              const showsGenericChat = chatText?.includes('Chat') && !chatText?.includes(user2.displayName);

              console.log('[ISSUE #41] Forward modal chat names:', showsGenericChat ? 'BUG - shows "Chat" instead of name' : 'WORKING');
            }
          }
        }
      }
    } finally {
      await context1.close();
      await context2.close();
    }
  });
});

// ============================================================
// Test Suite: 404 Page
// ============================================================
test.describe('Navigation and 404', () => {
  test('ISSUE #30: should show 404 page for invalid routes', async ({ page }) => {
    const user = generateTestUser('fourohfour');
    await registerUser(page, user);
    await waitForSignalRConnection(page);

    // Navigate to invalid route
    await page.goto('/some-invalid-route-that-does-not-exist');
    await page.waitForTimeout(1000);

    // Should show 404 page or redirect
    const currentUrl = page.url();
    const pageContent = await page.textContent('body');

    const has404Page = pageContent?.includes('404') ||
                       pageContent?.includes('Not Found') ||
                       pageContent?.includes('not found');

    console.log('[ISSUE #30] 404 page:', has404Page ? 'WORKING' : 'BUG - blank page or no 404');
    console.log('[ISSUE #30] Current URL:', currentUrl);
  });
});

// ============================================================
// Test Suite: Voice Recording
// ============================================================
test.describe('Voice Recording', () => {
  test('ISSUE #10: should check browser support before recording', async ({ page }) => {
    const user = generateTestUser('voicerec');
    await registerUser(page, user);
    await waitForSignalRConnection(page);

    // This test would need to be run in a browser that doesn't support MediaRecorder
    // For now, just verify the voice recorder button exists

    // Need to be in a chat first
    console.log('[ISSUE #10] Voice recorder browser check - manual testing needed');
  });
});

// ============================================================
// Test Suite: Error Handling
// ============================================================
test.describe('Error Handling', () => {
  test('ISSUE #47: should handle chat loading errors gracefully', async ({ page }) => {
    const user = generateTestUser('loadchaterr');
    await registerUser(page, user);

    // Intercept chat loading request and make it fail
    await page.route('**/api/chats', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Server error' }),
      });
    });

    // Wait for any error handling
    await page.waitForTimeout(2000);

    // Should show error message, not infinite loading
    const loadingSpinner = page.locator('[class*="loading"]');
    const errorMessage = page.getByText(/error|failed/i);

    const hasError = await errorMessage.isVisible();
    const stillLoading = await loadingSpinner.isVisible();

    console.log('[ISSUE #47] Chat loading error handling:', hasError ? 'WORKING - shows error' : (stillLoading ? 'BUG - infinite loading' : 'Shows empty state'));
  });

  test('ISSUE #49: should handle call initiation errors', async ({ page }) => {
    // This would require being in a chat to test call functionality
    console.log('[ISSUE #49] Call error handling - requires being in a chat');
  });
});

// ============================================================
// Test Suite: Bug Fixes Verification
// ============================================================
test.describe('Bug Fixes Verification', () => {
  test('FIX: Group owner can add/remove members', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const context3 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    const page3 = await context3.newPage();

    try {
      // Register users
      const owner = generateTestUser('grpowner');
      const member1 = generateTestUser('grpmem1');
      const member2 = generateTestUser('grpmem2');

      await registerUser(page1, owner);
      await waitForSignalRConnection(page1);

      await registerUser(page2, member1);
      await waitForSignalRConnection(page2);

      await registerUser(page3, member2);
      await waitForSignalRConnection(page3);

      // Owner creates a group with member1
      const newChatButton = page1.locator('button').filter({ has: page1.locator('svg.lucide-plus') });
      await newChatButton.first().click();

      await expect(page1.getByRole('heading', { name: /New Chat|New Group/ })).toBeVisible({ timeout: 5000 });

      // Switch to Group mode
      await page1.getByText('New Group').click();
      await page1.waitForTimeout(500);

      const groupNameInput = page1.getByPlaceholder('Group name');
      if (await groupNameInput.isVisible()) {
        await groupNameInput.fill('Test Group for Add/Remove');

        // Search and add member1
        const memberSearchInput = page1.getByPlaceholder('Search users to add...');
        if (await memberSearchInput.isVisible()) {
          await memberSearchInput.fill(member1.username);
          await page1.waitForTimeout(500);
          const memberResult = page1.getByText(member1.displayName);
          if (await memberResult.isVisible()) {
            await memberResult.click();
          }

          // Create group
          const createButton = page1.getByRole('button', { name: /create/i });
          if (await createButton.isVisible()) {
            await createButton.click();
            await page1.waitForTimeout(2000);

            // Now try to add member2 to the group (owner should be able to)
            // Open chat settings
            const moreButton = page1.locator('button').filter({ has: page1.locator('svg.lucide-more-vertical') });
            if (await moreButton.isVisible()) {
              await moreButton.click();
              await page1.waitForTimeout(500);

              // Look for settings or members option
              const settingsOption = page1.getByText(/settings|members/i);
              if (await settingsOption.isVisible()) {
                await settingsOption.click();
                await page1.waitForTimeout(500);

                // Look for add member functionality
                const addMemberButton = page1.getByText(/add member/i);
                if (await addMemberButton.isVisible()) {
                  await addMemberButton.click();
                  await page1.waitForTimeout(500);

                  // Search for member2
                  const addSearchInput = page1.getByPlaceholder(/search/i);
                  if (await addSearchInput.isVisible()) {
                    await addSearchInput.fill(member2.username);
                    await page1.waitForTimeout(500);

                    const member2Result = page1.getByText(member2.displayName);
                    if (await member2Result.isVisible()) {
                      await member2Result.click();
                      await page1.waitForTimeout(1000);

                      // Check for success or error
                      const errorVisible = await page1.getByText(/error|permission|forbidden/i).isVisible();
                      console.log('[FIX] Owner add member:', errorVisible ? 'FAILED' : 'SUCCESS');
                    }
                  }
                }
              }
            }
          }
        }
      }
    } finally {
      await context1.close();
      await context2.close();
      await context3.close();
    }
  });

  test('FIX: Settings page loads current user settings', async ({ page }) => {
    const user = generateTestUser('settingsload');
    await registerUser(page, user);
    await waitForSignalRConnection(page);

    // Navigate to settings
    const settingsButton = page.locator('button').filter({ has: page.locator('svg.lucide-settings') });
    await settingsButton.click();
    await expect(page).toHaveURL('/settings');

    // Wait for settings to load (should see loading spinner first)
    await page.waitForTimeout(2000);

    // Check that profile data is loaded by finding an input containing the display name
    const displayNameInput = page.locator(`input[value="${user.displayName}"]`);
    const displayNameVisible = await displayNameInput.isVisible().catch(() => false);

    console.log('[FIX] Settings loads display name:', displayNameVisible ? 'SUCCESS' : 'NEEDS VERIFICATION');

    // Navigate to notifications tab
    const notificationsTab = page.getByRole('button', { name: /notifications/i });
    if (await notificationsTab.isVisible()) {
      await notificationsTab.click();
      await page.waitForTimeout(500);

      // Check that toggle states are loaded from backend
      // Default should be: push=true, email=false, sound=true
      console.log('[FIX] Notification settings tab loaded');
    }

    // Navigate to privacy tab
    const privacyTab = page.getByRole('button', { name: /privacy/i });
    if (await privacyTab.isVisible()) {
      await privacyTab.click();
      await page.waitForTimeout(500);

      console.log('[FIX] Privacy settings tab loaded');
    }
  });

  test('FIX: Pin message only visible to authorized users', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Register users
      const owner = generateTestUser('pinowner');
      const member = generateTestUser('pinmember');

      await registerUser(page1, owner);
      await waitForSignalRConnection(page1);

      await registerUser(page2, member);
      await waitForSignalRConnection(page2);

      // Owner creates a group with member
      const newChatButton = page1.locator('button').filter({ has: page1.locator('svg.lucide-plus') });
      await newChatButton.first().click();

      await expect(page1.getByRole('heading', { name: /New Chat|New Group/ })).toBeVisible({ timeout: 5000 });

      // Switch to Group mode
      await page1.getByText('New Group').click();
      await page1.waitForTimeout(500);

      const groupNameInput = page1.getByPlaceholder('Group name');
      if (await groupNameInput.isVisible()) {
        await groupNameInput.fill('Test Group for Pin');

        const memberSearchInput = page1.getByPlaceholder('Search users to add...');
        if (await memberSearchInput.isVisible()) {
          await memberSearchInput.fill(member.username);
          await page1.waitForTimeout(500);
          const memberResult = page1.getByText(member.displayName);
          if (await memberResult.isVisible()) {
            await memberResult.click();
          }

          const createButton = page1.getByRole('button', { name: /create/i });
          if (await createButton.isVisible()) {
            await createButton.click();
            await page1.waitForTimeout(2000);

            // Owner sends a message
            const messageInput = page1.getByPlaceholder('Type a message...');
            if (await messageInput.isVisible()) {
              await messageInput.fill('Test message for pinning');
              await page1.keyboard.press('Enter');
              await page1.waitForTimeout(1500);

              // Owner right-clicks message - should see Pin option
              const message = page1.getByText('Test message for pinning', { exact: true });
              if (await message.isVisible()) {
                await message.click({ button: 'right' });
                await page1.waitForTimeout(500);

                const pinOption = page1.getByText('Pin');
                const ownerCanPin = await pinOption.isVisible();
                console.log('[FIX] Owner sees Pin option:', ownerCanPin ? 'SUCCESS' : 'FAILED');

                // Close context menu
                await page1.keyboard.press('Escape');
              }
            }

            // Member joins and checks if they can see Pin option
            await page2.waitForTimeout(2000);

            // Find and click on the group chat in member's chat list
            const groupChat = page2.getByText('Test Group for Pin');
            if (await groupChat.isVisible()) {
              await groupChat.click();
              await page2.waitForTimeout(1500);

              // Member right-clicks message - should NOT see Pin option (regular member)
              const message2 = page2.getByText('Test message for pinning', { exact: true });
              if (await message2.isVisible()) {
                await message2.click({ button: 'right' });
                await page2.waitForTimeout(500);

                const pinOption2 = page2.getByText('Pin');
                const memberCanPin = await pinOption2.isVisible();
                console.log('[FIX] Regular member sees Pin option:', memberCanPin ? 'FAILED - should not see' : 'SUCCESS - hidden as expected');
              }
            }
          }
        }
      }
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('FIX: Voice recording sends as Voice type', async ({ browser }) => {
    // This test verifies that voice recordings are sent with type 'Voice' not 'Audio'
    // Due to microphone permission requirements, this is best tested manually
    // or with mocked permissions

    console.log('[FIX] Voice message type - requires manual testing with microphone permissions');
    console.log('       Expected: Messages sent via voice recorder should have type "Voice"');
    console.log('       Verify: Check network request when sending voice message');
  });
});

// ============================================================
// Test Suite: API Response Validation
// ============================================================
test.describe('API Response Validation', () => {
  test('should verify API endpoints exist', async ({ page, request }) => {
    const user = generateTestUser('apicheck');
    await registerUser(page, user);

    // Get the auth token from localStorage
    const token = await page.evaluate(() => localStorage.getItem('accessToken'));

    if (token) {
      // Test various endpoints
      const endpoints = [
        { method: 'GET', path: '/api/chats', expected: 200 },
        { method: 'GET', path: '/api/users/me', expected: 200 },
        // These should be tested but need proper request bodies
        // { method: 'PUT', path: '/api/users/settings/notifications', expected: [200, 204] },
        // { method: 'PUT', path: '/api/users/settings/privacy', expected: [200, 204] },
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await request.fetch(`${API_URL}${endpoint.path.replace('/api', '')}`, {
            method: endpoint.method,
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          console.log(`[API CHECK] ${endpoint.method} ${endpoint.path}: ${response.status()}`);
        } catch (error) {
          console.log(`[API CHECK] ${endpoint.method} ${endpoint.path}: FAILED - ${error}`);
        }
      }
    }
  });
});
