import { test, expect } from '@playwright/test'

test('home page loads and shows a heading', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})
