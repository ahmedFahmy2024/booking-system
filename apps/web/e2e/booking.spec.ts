import { expect, test } from '@playwright/test'
import { z } from 'zod'

test('retries a failed booking and persists exactly one booking after a reload', async ({
  page,
  request,
}) => {
  const email = `e2e-${Date.now()}@example.com`
  const name = 'E2E Viewer'
  const startsAt = '2026-12-01T10:00'
  const saveError = 'Booking temporarily unavailable'

  let rejectFirstSave = true
  await page.route('**/api/bookings', async (route) => {
    if (route.request().method() === 'POST' && rejectFirstSave) {
      rejectFirstSave = false
      await route.fulfill({ status: 503, json: { message: saveError } })
      return
    }
    await route.fallback()
  })

  await page.goto('/')
  await page.getByLabel('Service').selectOption('1')
  await page.getByLabel('Customer name').fill(name)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Date and time').fill(startsAt)
  const submit = page.getByRole('button', { name: 'Create booking' })
  const savedEmail = page.getByText(email, { exact: true })
  await submit.click()

  await expect(page.getByRole('alert')).toHaveText(saveError)
  await expect(page.getByLabel('Service')).toHaveValue('1')
  await expect(page.getByLabel('Customer name')).toHaveValue(name)
  await expect(page.getByLabel('Email')).toHaveValue(email)
  await expect(page.getByLabel('Date and time')).toHaveValue(startsAt)
  await expect(savedEmail).toHaveCount(0)

  await submit.click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(savedEmail).toBeVisible()

  await page.reload()
  await expect(savedEmail).toBeVisible()

  const response = await request.get('/api/bookings')
  await expect(response).toBeOK()
  const bookings = z.array(z.object({ customerEmail: z.email() })).parse(await response.json())
  expect(bookings.filter((booking) => booking.customerEmail === email)).toHaveLength(1)
})
