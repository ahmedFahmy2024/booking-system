import { expect, test } from '@playwright/test'
import { z } from 'zod'

test.use({ timezoneId: 'UTC' })

test('retries a failed booking and persists exactly one booking after a reload', async ({
  page,
  request,
}) => {
  const email = `e2e-${Date.now()}@example.com`
  const name = 'E2E Viewer'
  const startsAt = '2026-12-01T10:00'
  const saveError = 'تعذر حفظ الحجز. حاول مرة أخرى.'

  let rejectFirstSave = true
  await page.route('**/api/bookings', async (route) => {
    if (route.request().method() === 'POST' && rejectFirstSave) {
      rejectFirstSave = false
      await route.fulfill({ status: 503, json: { message: 'Booking temporarily unavailable' } })
      return
    }
    await route.fallback()
  })

  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar-EG')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await page.getByLabel('الخدمة').selectOption('1')
  await page.getByLabel('اسم العميل').fill(name)
  await page.getByLabel('البريد الإلكتروني').fill(email)
  await page.getByLabel('التاريخ والوقت بتوقيت جهازك').fill(startsAt)
  const submit = page.getByRole('button', { name: 'تأكيد الحجز' })
  const savedEmail = page.getByText(email, { exact: true })
  await submit.click()

  await expect(page.getByRole('alert')).toHaveText(saveError)
  await expect(page.getByLabel('الخدمة')).toHaveValue('1')
  await expect(page.getByLabel('اسم العميل')).toHaveValue(name)
  await expect(page.getByLabel('البريد الإلكتروني')).toHaveValue(email)
  await expect(page.getByLabel('التاريخ والوقت بتوقيت جهازك')).toHaveValue(startsAt)
  await expect(savedEmail).toHaveCount(0)

  await submit.click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(savedEmail).toBeVisible()

  await page.reload()
  await expect(savedEmail).toBeVisible()
  const savedBooking = page.getByRole('listitem').filter({ hasText: email })
  const expectedDate = new Date(`${startsAt}:00Z`).toLocaleString('ar-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Cairo',
  })
  await expect(savedBooking.locator('time')).toHaveText(`${expectedDate} بتوقيت القاهرة`)

  const response = await request.get('/api/bookings')
  await expect(response).toBeOK()
  const bookings = z.array(z.object({ customerEmail: z.email() })).parse(await response.json())
  expect(bookings.filter((booking) => booking.customerEmail === email)).toHaveLength(1)
})
