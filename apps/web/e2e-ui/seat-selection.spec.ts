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
  await page.route('**/api/bookings/confirm', (route) => {
    const payload = route.request().postDataJSON() as {
      seatIds: string[]
      customerEmail: string
      quotedUnitPricePiastres: number
    }
    route.fulfill({
      status: 201,
      json: {
        id: '33333333-3333-4333-8333-333333333333',
        reference: `bkg_${'a'.repeat(32)}`,
        showtimeId,
        filmTitle: detail.filmTitle,
        auditoriumName: detail.auditoriumName,
        seatLabels: payload.seatIds.map((_, index) => `A${index + 1}`),
        seatIds: payload.seatIds,
        customerEmail: payload.customerEmail,
        startsAt: detail.startsAt,
        unitPricePiastres: detail.pricePiastres,
        totalPiastres: detail.pricePiastres * payload.seatIds.length,
      },
    })
  })
}

async function useEnglish(page: Page) {
  await page.addInitScript(() => localStorage.setItem('app-locale', 'en'))
}

test.beforeEach(async ({ page }) => {
  await stubApi(page)
})

test('selects seats by keyboard and confirms them through the API', async ({ page }) => {
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

  const confirmation = page.locator('[aria-labelledby="booking-confirmation-heading"]')
  await expect(confirmation.getByRole('heading', { name: 'Your booking is confirmed' })).toBeVisible()
  await expect(confirmation.getByRole('status')).toContainText(`bkg_${'a'.repeat(32)}`)
  await expect(confirmation.getByText('Cairo Nights')).toBeVisible()
  await expect(confirmation.getByText('Auditorium Hall 1')).toBeVisible()
  await expect(confirmation.getByText('A1, A2', { exact: true })).toBeVisible()
  await expect(confirmation.getByText('Pay at the cinema when you arrive.')).toBeVisible()
  await expect(confirmation.getByText(/We emailed a private link/)).toContainText('guest@example.com')
  await expect(page.getByRole('button', { name: 'Confirm selection' })).toHaveCount(0)
})

test('shows the confirmation details in Arabic RTL after booking', async ({ page }) => {
  await page.goto(`/showtimes/${showtimeId}`)

  await page.getByRole('button', { name: 'المقعد A1 — متاح' }).click()
  await page.getByLabel('بريدك الإلكتروني').fill('guest@example.com')
  await page.getByRole('button', { name: 'تأكيد الاختيار' }).click()

  const confirmation = page.locator('[aria-labelledby="booking-confirmation-heading"]')
  await expect(confirmation.getByRole('heading', { name: 'تم تأكيد حجزك' })).toBeVisible()
  await expect(confirmation.getByText('Cairo Nights')).toBeVisible()
  await expect(confirmation.getByText('قاعة Hall 1')).toBeVisible()
  await expect(confirmation.getByText('ادفع المبلغ في المقر عند حضورك العرض.')).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
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
  await expect(page.getByText(/Booking confirmed/)).toHaveCount(0)

  await email.fill('guest@example.com')
  await page.getByRole('button', { name: 'Confirm selection' }).click()

  await expect(page.getByText(/Booking confirmed/)).toBeVisible()
  await expect(page.getByText('Enter a valid email address.')).toHaveCount(0)
})

test('prunes a taken seat after a conflict and confirms the remaining one', async ({ page }) => {
  await useEnglish(page)
  await page.goto(`/showtimes/${showtimeId}`)

  let attempts = 0
  await page.route('**/api/bookings/confirm', (route) => {
    attempts += 1
    if (attempts === 1) {
      route.fulfill({
        status: 409,
        json: {
          error: 'seat_unavailable',
          unitPricePiastres: detail.pricePiastres,
          availableSeatIds: [seatIds[1]],
        },
      })
      return
    }
    const payload = route.request().postDataJSON() as { seatIds: string[]; customerEmail: string }
    route.fulfill({
      status: 201,
      json: {
        id: '33333333-3333-4333-8333-333333333333',
        reference: `bkg_${'b'.repeat(32)}`,
        showtimeId,
        filmTitle: detail.filmTitle,
        auditoriumName: detail.auditoriumName,
        seatLabels: payload.seatIds.map((_, index) => `A${index + 1}`),
        seatIds: payload.seatIds,
        customerEmail: payload.customerEmail,
        startsAt: detail.startsAt,
        unitPricePiastres: detail.pricePiastres,
        totalPiastres: detail.pricePiastres * payload.seatIds.length,
      },
    })
  })

  await page.getByRole('button', { name: 'Seat A1 — available' }).click()
  await page.getByRole('button', { name: 'Seat A2 — available' }).click()
  const email = page.getByLabel('Your email address')
  await email.fill('guest@example.com')
  await page.getByRole('button', { name: 'Confirm selection' }).click()

  await expect(page.getByRole('alert')).toContainText('Some of the selected seats are no longer')
  await expect(email).toHaveValue('guest@example.com')
  await expect(page.getByRole('button', { name: 'Seat A1 — available' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await expect(page.getByRole('button', { name: 'Seat A2 — available' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  await page.getByRole('button', { name: 'Confirm selection' }).click()
  await expect(page.getByText(/Booking confirmed/)).toContainText(`bkg_${'b'.repeat(32)}`)
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('requires explicit confirmation when the price changed before checkout', async ({ page }) => {
  await useEnglish(page)
  await page.goto(`/showtimes/${showtimeId}`)

  const quoted: number[] = []
  let attempts = 0
  await page.route('**/api/bookings/confirm', (route) => {
    const payload = route.request().postDataJSON() as {
      seatIds: string[]
      customerEmail: string
      quotedUnitPricePiastres: number
    }
    quoted.push(payload.quotedUnitPricePiastres)
    attempts += 1
    if (attempts === 1) {
      route.fulfill({
        status: 409,
        json: {
          error: 'price_changed',
          unitPricePiastres: 3000,
          availableSeatIds: payload.seatIds,
        },
      })
      return
    }
    route.fulfill({
      status: 201,
      json: {
        id: '33333333-3333-4333-8333-333333333333',
        reference: `bkg_${'c'.repeat(32)}`,
        showtimeId,
        filmTitle: detail.filmTitle,
        auditoriumName: detail.auditoriumName,
        seatLabels: payload.seatIds.map((_, index) => `A${index + 1}`),
        seatIds: payload.seatIds,
        customerEmail: payload.customerEmail,
        startsAt: detail.startsAt,
        unitPricePiastres: 3000,
        totalPiastres: 3000 * payload.seatIds.length,
      },
    })
  })

  await page.getByRole('button', { name: 'Seat A1 — available' }).click()
  await page.getByLabel('Your email address').fill('guest@example.com')
  await page.getByRole('button', { name: 'Confirm selection' }).click()

  await expect(page.getByRole('alert')).toContainText('The seat price changed')
  await expect(page.getByText(/Total:/)).toContainText(egp(3000))
  await expect(page.getByRole('button', { name: 'Confirm selection' })).toBeDisabled()
  expect(quoted).toEqual([2500])

  await page.getByRole('button', { name: 'Confirm the new total' }).click()
  await expect(page.getByText(/Booking confirmed/)).toContainText(`bkg_${'c'.repeat(32)}`)
  expect(quoted).toEqual([2500, 3000])
  await expect(page.getByRole('alert')).toHaveCount(0)
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

test('sends one stable idempotency key per checkout attempt', async ({ page }) => {
  await useEnglish(page)
  await page.goto(`/showtimes/${showtimeId}`)

  const keys: string[] = []
  await page.route('**/api/bookings/confirm', (route) => {
    keys.push(route.request().headers()['idempotency-key'] ?? '')
    const payload = route.request().postDataJSON() as {
      seatIds: string[]
      customerEmail: string
      quotedUnitPricePiastres: number
    }
    if (keys.length === 1) {
      route.fulfill({ status: 409, json: { error: 'booking_closed' } })
      return
    }
    route.fulfill({
      status: 201,
      json: {
        id: '33333333-3333-4333-8333-333333333333',
        reference: `bkg_${'d'.repeat(32)}`,
        showtimeId,
        filmTitle: detail.filmTitle,
        auditoriumName: detail.auditoriumName,
        seatLabels: payload.seatIds.map((_, index) => `A${index + 1}`),
        seatIds: payload.seatIds,
        customerEmail: payload.customerEmail,
        startsAt: detail.startsAt,
        unitPricePiastres: detail.pricePiastres,
        totalPiastres: detail.pricePiastres * payload.seatIds.length,
      },
    })
  })

  await page.getByRole('button', { name: 'Seat A1 — available' }).click()
  await page.getByLabel('Your email address').fill('guest@example.com')
  await page.getByRole('button', { name: 'Confirm selection' }).click()

  await expect(page.getByText('Online booking for this showtime has closed.')).toBeVisible()
  await page.getByRole('button', { name: 'Confirm selection' }).click()
  await expect(page.getByText(/Booking confirmed/)).toContainText(`bkg_${'d'.repeat(32)}`)

  // An unchanged retry reuses the key; a new selection starts a new attempt.
  await page.getByRole('button', { name: 'Seat A1 — available' }).click()
  await page.getByRole('button', { name: 'Confirm selection' }).click()
  await expect(page.getByText(/Booking confirmed/)).toBeVisible()

  expect(keys[0]).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  )
  expect(keys[1]).toBe(keys[0])
  expect(keys[2]).not.toBe(keys[0])
  expect(keys).toHaveLength(3)
})

test('reuses the key after a reload when the first response was lost', async ({ page }) => {
  await useEnglish(page)
  await page.goto(`/showtimes/${showtimeId}`)

  const keys: string[] = []
  await page.route('**/api/bookings/confirm', (route) => {
    keys.push(route.request().headers()['idempotency-key'] ?? '')
    if (keys.length === 1) {
      route.abort('failed')
      return
    }
    const payload = route.request().postDataJSON() as {
      seatIds: string[]
      customerEmail: string
      quotedUnitPricePiastres: number
    }
    route.fulfill({
      status: 201,
      json: {
        id: '33333333-3333-4333-8333-333333333333',
        reference: `bkg_${'e'.repeat(32)}`,
        showtimeId,
        filmTitle: detail.filmTitle,
        auditoriumName: detail.auditoriumName,
        seatLabels: payload.seatIds.map((_, index) => `A${index + 1}`),
        seatIds: payload.seatIds,
        customerEmail: payload.customerEmail,
        startsAt: detail.startsAt,
        unitPricePiastres: detail.pricePiastres,
        totalPiastres: detail.pricePiastres * payload.seatIds.length,
      },
    })
  })

  await page.getByRole('button', { name: 'Seat A1 — available' }).click()
  await page.getByLabel('Your email address').fill('guest@example.com')
  await page.getByRole('button', { name: 'Confirm selection' }).click()
  await expect(page.getByText('Could not confirm the booking. Check the seats and try again.')).toBeVisible()

  await page.reload()
  await page.getByRole('button', { name: 'Seat A1 — available' }).click()
  await page.getByLabel('Your email address').fill('guest@example.com')
  await page.getByRole('button', { name: 'Confirm selection' }).click()
  await expect(page.getByText(/Booking confirmed/)).toContainText(`bkg_${'e'.repeat(32)}`)

  expect(keys).toHaveLength(2)
  expect(keys[1]).toBe(keys[0])
})
