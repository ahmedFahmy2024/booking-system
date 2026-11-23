import { expect, test } from '@playwright/test'

test('keeps the auditorium page visible during loading and retries inside the panel', async ({ page }) => {
  const responseGate = Promise.withResolvers<void>()
  let failRead = true
  await page.route('**/api/admin/auditoriums', async (route) => {
    await responseGate.promise
    if (failRead) {
      return route.fulfill({ status: 503, json: { error: 'unavailable' } })
    }
    return route.fulfill({ json: [] })
  })

  const heading = page.getByRole('heading', { name: 'إدارة القاعات والمقاعد' })
  const editor = page.getByLabel('اسم القاعة')
  try {
    await page.goto('/admin/auditoriums')
    await expect(heading).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: 'جارٍ التحميل…' })).toBeVisible()
    await expect(editor).toHaveCount(0)
  } finally {
    responseGate.resolve()
  }

  const error = page.getByRole('alert')
  await expect(error).toContainText('تعذر تحميل إدارة القاعات.')
  await expect(heading).toBeVisible()
  await expect(page.getByRole('link', { name: 'الأفلام', exact: true })).toBeVisible()
  await expect(editor).toHaveCount(0)

  failRead = false
  await error.getByRole('button', { name: 'إعادة المحاولة' }).click()
  await expect(editor).toBeVisible()
  await expect(error).toHaveCount(0)
})
