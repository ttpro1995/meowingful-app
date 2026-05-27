import { test, expect } from '@playwright/test';
import { setupGraphqlMock } from './graphql-mock';

function buildUsername(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

test.describe('Auth E2E', () => {
  test.beforeEach(async ({ page }) => {
    await setupGraphqlMock(page);
  });

  test('should register a new user', async ({ page }) => {
    await page.goto('/register');

    const username = buildUsername('testuser');
    
    await page.fill('input#username', username);
    await page.fill('input#name', 'Test User');
    await page.fill('input#password', 'password123');
    await page.click('button[type="submit"]');

    // Should redirect to profile after successful registration
    await expect(page).toHaveURL('/profile');
    await expect(page.locator('h1')).toContainText('Profile');
  });

  test('should login with valid credentials', async ({ page }) => {
    // First register a user to login with
    const username = buildUsername('loginuser');
    await page.goto('/register');
    await page.fill('input#username', username);
    await page.fill('input#name', 'Login Test User');
    await page.fill('input#password', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/profile');

    // Logout - the button has text "Logout" and class "btn-danger"
    await page.click('button.btn-danger');
    await expect(page).toHaveURL('/login');
    
    // Now login
    await page.goto('/login');
    await page.fill('input#username', username);
    await page.fill('input#password', 'password123');
    await page.click('button[type="submit"]');

    // Should redirect to profile after successful login
    await expect(page).toHaveURL('/profile');
    await expect(page.locator('h1')).toContainText('Profile');
  });

  test('should fail to login with invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input#username', 'wronguser');
    await page.fill('input#password', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator('.error')).toContainText('Login failed');
  });
});