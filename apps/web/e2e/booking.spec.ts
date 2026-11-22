import { expect, test } from '@playwright/test'

test('creates a booking that persists through Hono after a reload', async ({
  page,
  request,
}) => {
  const email = `e2e-${Date.now()}@example.com`

  await page.goto('/')
  await page.getByLabel('Service').selectOption('1')
  await page.getByLabel('Customer name').fill('E2E Viewer')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Date and time').fill('2026-12-01T10:00')
  await page.getByRole('button', { name: 'Create booking' }).click()

  await expect(page.getByText(email)).toBeVisible()

  await page.reload()
  await expect(page.getByText(email)).toBeVisible()

  const response = await request.get('/api/bookings')
  expect(response.ok()).toBeTruthy()
  const bookings = (await response.json()) as Array<{ customerEmail: string }>
  expect(bookings.some((booking) => booking.customerEmail === email)).toBe(true)
})
