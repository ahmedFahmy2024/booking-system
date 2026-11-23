import { expect, test, type Page } from '@playwright/test'

const poster =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='300'%3E%3Crect width='200' height='300' fill='%23e11d48'/%3E%3C/svg%3E"

const films = [
  {
    id: 'film-1',
    title: 'Cairo Nights',
    durationMinutes: 95,
    synopsis: 'A story set in Cairo.',
    posterUrl: poster,
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
  filmId: 'film-1',
  filmTitle: 'Cairo Nights',
  synopsis: 'A story set in Cairo.',
  posterUrl: poster,
  durationMinutes: 95,
  startsAt: '2026-12-01T14:00:00.000Z',
  auditoriumName: 'Hall 1',
  pricePiastres: 2500,
  bookingClosed: false,
}
const seatMap = { showtimeId: 'showtime-1', auditoriumName: 'Hall 1', seats: [] }

async function stubPublicApi(page: Page) {
  await page.route('**/api/films', (route) => route.fulfill({ json: films }))
  await page.route('**/api/showtimes/showtime-1', (route) => route.fulfill({ json: detail }))
  await page.route('**/api/showtimes/showtime-1/seat-map', (route) => route.fulfill({ json: seatMap }))
}

const posterViewTransitionName = 'poster-film-1'

/** Record the CSS pseudo-element animations created by the named poster morph. */
async function recordPosterTransitions(page: Page) {
  await page.addInitScript((name) => {
    const start = document.startViewTransition?.bind(document)
    if (!start) return
    ;(window as unknown as { __posterTransitions: Array<{ pseudo: string; duration: number }> }).__posterTransitions = []
    document.startViewTransition = ((...args: Parameters<typeof start>) => {
      const transition = start(...args)
      void transition.ready.then(() => {
        for (const animation of document.getAnimations()) {
          const pseudo = (animation.effect as KeyframeEffect | null)?.pseudoElement ?? ''
          if (pseudo.includes(name)) {
            ;(window as unknown as {
              __posterTransitions: Array<{ pseudo: string; duration: number }>
            }).__posterTransitions.push({
              pseudo,
              duration: Number(animation.effect?.getTiming().duration ?? 0),
            })
          }
        }
      }, () => {})
      return transition
    }) as typeof document.startViewTransition
  }, posterViewTransitionName)
}

function posterTransitions(page: Page) {
  return page.evaluate(() =>
    (window as unknown as { __posterTransitions?: Array<{ pseudo: string; duration: number }> })
      .__posterTransitions ?? [],
  )
}

test('morphs the shared poster forward and back, keeping RTL and focus', async ({ page }) => {
  await recordPosterTransitions(page)
  await stubPublicApi(page)

  await page.goto('/')
  const viewSeats = page.getByRole('link', { name: 'عرض المقاعد' })
  await expect(viewSeats).toBeVisible()
  const prefetched = page.waitForResponse((response) =>
    response.url().endsWith('/api/showtimes/showtime-1/seat-map'),
  )
  await viewSeats.hover()
  await (await prefetched).finished()

  await viewSeats.click()
  await expect(page).toHaveURL(/\/showtimes\/showtime-1$/)
  await expect(page.locator('img').first()).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl')
  await expect.poll(async () => (await posterTransitions(page)).length).toBeGreaterThan(0)

  // Focus is not stranded on the link that was removed by the navigation.
  await page.keyboard.press('Tab')
  expect(await page.evaluate(() => document.activeElement?.textContent?.trim())).toBe('العودة إلى الأفلام')

  await page.evaluate(() => {
    ;(window as unknown as { __posterTransitions: unknown[] }).__posterTransitions.length = 0
  })
  await page.getByRole('link', { name: 'العودة إلى الأفلام' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.locator('img').first()).toBeVisible()
  await expect.poll(async () => (await posterTransitions(page)).length).toBeGreaterThan(0)
})

test('honours reduced motion for the poster morph', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await recordPosterTransitions(page)
  await stubPublicApi(page)

  await page.goto('/')
  const viewSeats = page.getByRole('link', { name: 'عرض المقاعد' })
  const prefetched = page.waitForResponse((response) =>
    response.url().endsWith('/api/showtimes/showtime-1/seat-map'),
  )
  await viewSeats.hover()
  await (await prefetched).finished()
  await viewSeats.click()
  await expect(page).toHaveURL(/\/showtimes\/showtime-1$/)
  await expect.poll(async () => (await posterTransitions(page)).length).toBeGreaterThan(0)

  const durations = (await posterTransitions(page)).map((entry) => entry.duration)
  expect(durations.every((duration) => duration === 0)).toBe(true)
})

test('renders instantly when the browser has no View Transitions API', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(document, 'startViewTransition', { value: undefined, configurable: true })
  })
  await stubPublicApi(page)

  await page.goto('/')
  await expect(page.locator('img').first()).toBeVisible()
  await page.getByRole('link', { name: 'عرض المقاعد' }).click()

  await expect(page).toHaveURL(/\/showtimes\/showtime-1$/)
  await expect(page.locator('img').first()).toBeVisible()
  expect(await page.evaluate(() => '__posterTransitions' in window)).toBe(false)
})
