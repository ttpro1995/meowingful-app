import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test.describe('Profile E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Register a new user for profile tests
    await page.goto('/register');
    const username = `profileuser_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    await page.fill('input#username', username);
    await page.fill('input#name', 'Profile Test User');
    await page.fill('input#password', 'password123');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL('/profile');
  });

  test('should display user profile', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Profile');
    await expect(page.locator('text=Username:')).toBeVisible();
    await expect(page.locator('text=Profile Test User')).toBeVisible();
  });

  test('should update profile name', async ({ page }) => {
    await page.click('button:has-text("Edit Profile")');
    await page.fill('input#name', 'Updated Profile User');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('.success')).toContainText('Profile updated');
  });

  test('should update profile bio', async ({ page }) => {
    await page.click('button:has-text("Edit Profile")');
    await page.fill('textarea#bio', 'This is my bio');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('.success')).toContainText('Profile updated');
  });
});