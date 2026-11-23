import { expect, test } from '@playwright/test'

test('blocks an overlong normalized row label and submits after correction', async ({ page }) => {
  const requests: unknown[] = []
  await page.route('**/api/admin/auditoriums', async (route) => {
    if (route.request().method() === 'POST') {
      requests.push(route.request().postDataJSON())
      await route.fulfill({ status: 201, json: { id: 'hall-1', name: 'Main Hall', seats: [] } })
      return
    }
    await route.fulfill({ json: [] })
  })

  await page.goto('/admin/auditoriums')
  await page.getByLabel('اسم القاعة').fill('Main Hall')
  const row = page.getByLabel('الصف', { exact: true })
  const submit = page.getByRole('button', { name: 'إضافة القاعة' })
  await row.fill('ß'.repeat(6))
  await expect(row).toHaveValue('ß'.repeat(6))
  await submit.click()
  await expect(row).toHaveAttribute('aria-invalid', 'true')
  expect(requests).toHaveLength(0)

  await row.fill('b')
  await expect(row).toHaveValue('b')
  await expect(page.getByRole('list', { name: 'مقاعد الصف B' })).toBeVisible()
  await submit.click()
  await expect.poll(() => requests.length).toBe(1)
  expect(requests[0]).toEqual({
    name: 'Main Hall',
    seats: Array.from({ length: 10 }, (_, index) => ({
      rowLabel: 'B',
      seatNumber: index + 1,
      aisleAfter: false,
      isOutOfService: false,
    })),
  })
})

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
