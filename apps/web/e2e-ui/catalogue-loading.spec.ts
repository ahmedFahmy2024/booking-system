import { expect, test } from '@playwright/test'

const films = [
  {
    id: 'film-1',
    title: 'Cairo Nights',
    durationMinutes: 95,
    synopsis: 'A story set in Cairo.',
    posterUrl: null,
    showtimes: [
      {
        id: 'showtime-1',
        startsAt: '2026-12-01T14:00:00.000Z',
        pricePiastres: 2500,
        auditoriumName: 'Hall 1',
      },
    ],
  },
]
const detail = {
  id: 'showtime-1',
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
  showtimeId: 'showtime-1',
  auditoriumName: 'Hall 1',
  seats: [
    {
      id: 'seat-1',
      rowLabel: 'A',
      seatNumber: 1,
      aisleAfter: true,
      outOfService: false,
      available: true,
    },
    {
      id: 'seat-2',
      rowLabel: 'A',
      seatNumber: 2,
      aisleAfter: false,
      outOfService: true,
      available: false,
    },
  ],
}
const loadingText = 'جارٍ التحميل…'

async function stubHeadingRoutes(page: import('@playwright/test').Page) {
  await page.route('**/api/films', (route) => route.fulfill({ json: films }))
  await page.route('**/api/showtimes/showtime-1', (route) => route.fulfill({ json: detail }))
}

test('keeps the showtime heading visible while the seat map loads', async ({ page }) => {
  await stubHeadingRoutes(page)
  const gate = Promise.withResolvers<void>()
  await page.route('**/api/showtimes/showtime-1/seat-map', async (route) => {
    await gate.promise
    await route.fulfill({ json: seatMap })
  })

  try {
    await page.goto('/showtimes/showtime-1')
    await expect(page.getByRole('heading', { name: 'Cairo Nights', level: 1 })).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: loadingText })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'خريطة المقاعد' })).toHaveCount(0)
  } finally {
    gate.resolve()
  }

  await expect(page.getByRole('button', { name: 'المقعد A1 — متاح' })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: loadingText })).toHaveCount(0)
})

test('retries a failed seat map without losing the heading', async ({ page }) => {
  await stubHeadingRoutes(page)
  let retryGate: Promise<void> | undefined
  await page.route('**/api/showtimes/showtime-1/seat-map', async (route) => {
    if (!retryGate) return route.fulfill({ status: 503, json: { error: 'unavailable' } })
    await retryGate
    await route.fulfill({ json: seatMap })
  })

  await page.goto('/showtimes/showtime-1')
  const error = page.getByRole('alert')
  await expect(error).toContainText('تعذّر تحميل خريطة المقاعد.')
  await expect(page.getByRole('heading', { name: 'Cairo Nights', level: 1 })).toBeVisible()

  const gate = Promise.withResolvers<void>()
  retryGate = gate.promise
  try {
    await error.getByRole('button', { name: 'إعادة المحاولة' }).click()
    await expect(page.getByRole('status').filter({ hasText: loadingText })).toBeVisible()
  } finally {
    gate.resolve()
  }

  await expect(page.getByRole('button', { name: 'المقعد A1 — متاح' })).toBeVisible()
  await expect(error).toHaveCount(0)
})

test('retries a failed catalogue read from the route error', async ({ page }) => {
  let retryGate: Promise<void> | undefined
  await page.route('**/api/films', async (route) => {
    if (!retryGate) return route.fulfill({ status: 503, json: { error: 'unavailable' } })
    await retryGate
    await route.fulfill({ json: films })
  })

  await page.goto('/')
  const error = page.getByRole('alert')
  await expect(error).toContainText('تعذر تحميل الصفحة')

  const gate = Promise.withResolvers<void>()
  retryGate = gate.promise
  try {
    await error.getByRole('button', { name: 'إعادة المحاولة' }).click()
    await expect(page.getByRole('status').filter({ hasText: loadingText })).toBeVisible()
  } finally {
    gate.resolve()
  }

  await expect(page.getByText('Cairo Nights', { exact: true })).toBeVisible()
  await expect(error).toHaveCount(0)
})

test('opens a warm showtime link without a seat-map fallback', async ({ page }) => {
  let mapReads = 0
  await stubHeadingRoutes(page)
  await page.route('**/api/showtimes/showtime-1/seat-map', async (route) => {
    mapReads += 1
    await route.fulfill({ json: seatMap })
  })

  await page.goto('/')
  const viewSeats = page.getByRole('link', { name: 'عرض المقاعد' })
  await expect(viewSeats).toBeVisible()
  const prefetched = page.waitForResponse((response) =>
    response.url().endsWith('/api/showtimes/showtime-1/seat-map'),
  )
  await viewSeats.hover()
  await (await prefetched).finished()
  await page.evaluate((text) => {
    const observer = new MutationObserver((records) => {
      if (
        records.some((record) =>
          Array.from(record.addedNodes).some((node) => node.textContent?.includes(text)),
        )
      ) {
        performance.mark('seat-map-fallback-shown')
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
  }, loadingText)

  await viewSeats.click()
  await expect(page.getByRole('heading', { name: 'Cairo Nights', level: 1 })).toBeVisible()
  await expect(page.getByRole('button', { name: 'المقعد A1 — متاح' })).toBeVisible()
  expect(await page.evaluate(() => performance.getEntriesByName('seat-map-fallback-shown').length)).toBe(0)
  expect(mapReads).toBe(1)
})
