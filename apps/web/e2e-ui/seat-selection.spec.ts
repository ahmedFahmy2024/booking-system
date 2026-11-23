import { expect, test, type Page } from '@playwright/test'

const showtimeId = '11111111-1111-4111-8111-111111111111'
const seatIds = Array.from(
  { length: 7 },
  (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
)
const detail = {
  id: showtimeId,
  filmId: '22222222-2222-4222-8222-222222222222',
  filmTitle: 'Cairo Nights',
  synopsis: 'A story set in Cairo.',
  posterUrl: null,
  durationMinutes: 95,
  startsAt: '2026-12-01T14:00:00.000Z',
  auditoriumName: 'Hall 1',
  pricePiastres: 2500,
  bookingClosed: false,
}
const seatMap = {
  showtimeId,
  auditoriumName: 'Hall 1',
  seats: seatIds.map((id, index) => ({
    id,
    rowLabel: 'A',
    seatNumber: index + 1,
    aisleAfter: false,
    outOfService: false,
    available: true,
  })),
}
const egp = (piastres: number) =>
  new Intl.NumberFormat('en', { style: 'currency', currency: 'EGP' }).format(piastres / 100)

async function stubApi(page: Page) {
  await page.route('**/api/films', (route) => route.fulfill({ json: [] }))
  await page.route(`**/api/showtimes/${showtimeId}`, (route) => route.fulfill({ json: detail }))
  await page.route(`**/api/showtimes/${showtimeId}/seat-map`, (route) =>
    route.fulfill({ json: seatMap }),
  )
}

async function useEnglish(page: Page) {
  await page.addInitScript(() => localStorage.setItem('app-locale', 'en'))
}

test.beforeEach(async ({ page }) => {
  await stubApi(page)
})

test('selects seats by keyboard and shows the EGP total and ready summary', async ({ page }) => {
  await useEnglish(page)
  await page.goto(`/showtimes/${showtimeId}`)

  await expect(page.getByRole('heading', { name: 'Cairo Nights', level: 1 })).toBeVisible()
  const first = page.getByRole('button', { name: 'Seat A1 — available' })
  await first.focus()
  await page.keyboard.press('Enter')
  await expect(first).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Seat A2 — available' }).click()

  await expect(page.getByText(/Total:/)).toContainText(egp(5000))
  await expect(page.getByText('Selected seats: A1, A2')).toBeVisible()

  await page.getByLabel('Your email address').fill('guest@example.com')
  await page.getByRole('button', { name: 'Confirm selection' }).click()

  await expect(page.getByRole('status').filter({ hasText: 'Selection checked' })).toContainText(
    'guest@example.com',
  )
})

test('refuses a seventh seat and keeps the six-seat total', async ({ page }) => {
  await useEnglish(page)
  await page.goto(`/showtimes/${showtimeId}`)

  for (let number = 1; number <= 7; number += 1) {
    await page.getByRole('button', { name: `Seat A${number} — available` }).click()
  }

  await expect(page.getByText('You can select at most 6 seats.')).toBeVisible()
  await expect(page.getByText(/Total:/)).toContainText(egp(15000))
  await expect(page.getByRole('button', { name: 'Seat A7 — available' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
})

test('keeps the selection and email on a bad email and accepts the retry', async ({ page }) => {
  await useEnglish(page)
  await page.goto(`/showtimes/${showtimeId}`)

  await page.getByRole('button', { name: 'Seat A1 — available' }).click()
  const email = page.getByLabel('Your email address')
  await email.fill('not-an-email')
  await page.getByRole('button', { name: 'Confirm selection' }).click()

  await expect(page.getByText('Enter a valid email address.')).toBeVisible()
  await expect(email).toHaveValue('not-an-email')
  await expect(page.getByRole('button', { name: 'Seat A1 — available' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByText(/Selection checked/)).toHaveCount(0)

  await email.fill('guest@example.com')
  await page.getByRole('button', { name: 'Confirm selection' }).click()

  await expect(page.getByText(/Selection checked/)).toBeVisible()
  await expect(page.getByText('Enter a valid email address.')).toHaveCount(0)
})

test('keeps Arabic RTL and labelled seats while selecting', async ({ page }) => {
  await page.goto(`/showtimes/${showtimeId}`)

  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  const first = page.getByRole('button', { name: 'المقعد A1 — متاح' })
  await first.click()
  await expect(first).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('المقاعد المختارة: A1')).toBeVisible()
  await expect(page.getByText(/الإجمالي/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'تأكيد الاختيار' })).toBeVisible()
})
