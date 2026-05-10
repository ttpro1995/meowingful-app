import { test, expect } from '@playwright/test';

test.describe('Profile E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Register a new user for profile tests
    await page.goto('/register');
    const username = `profileuser_${Date.now()}`;
    
    await page.fill('input#username', username);
    await page.fill('input#name', 'Profile Test User');
    await page.fill('input#password', 'password123');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL('/profile');
  });

  test('should display user profile', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Profile');
    await expect(page.locator('input#username')).toBeDisabled();
    await expect(page.locator('input#name')).toHaveValue('Profile Test User');
  });

  test('should update profile name', async ({ page }) => {
    await page.fill('input#name', 'Updated Profile User');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('.success')).toContainText('Profile updated');
    await expect(page.locator('input#name')).toHaveValue('Updated Profile User');
  });

  test('should update profile bio', async ({ page }) => {
    await page.fill('textarea#bio', 'This is my bio');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('.success')).toContainText('Profile updated');
  });
});