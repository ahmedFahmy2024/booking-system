import { expect, test, type APIRequestContext } from '@playwright/test'

/**
 * B4.6 live booking journey. Unlike the stubbed e2e-ui specs, this drives the
 * real Hono API and the isolated Neon database: an admin creates a film, an
 * auditorium and a published showtime through the admin API, then an anonymous
 * Arabic visitor books two seats. The first confirm fails at the browser HTTP
 * boundary so the retry path is visible; the retry writes real claims.
 */

test.use({ timezoneId: 'UTC' })

const adminEmail = 'b46-e2e-admin@example.com'
const adminPassword = 'B46E2EPass123!'
const seatPricePiastres = 2500

function cairoWallClock(instant: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant)
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`
}

async function jsonResponse(response: import('@playwright/test').APIResponse) {
  expect(response.ok(), `${response.status()} ${await response.text()}`).toBeTruthy()
  return (await response.json()) as Record<string, unknown>
}

async function prepareShowtime(request: APIRequestContext, stamp: number) {
  const signIn = await request.post('/api/auth/sign-in/email', {
    headers: { Origin: 'http://localhost:5173', 'x-forwarded-for': `198.51.100.${stamp % 200 + 1}` },
    data: { email: adminEmail, password: adminPassword },
  })
  expect(signIn.ok(), `admin sign-in failed: ${signIn.status()}`).toBeTruthy()

  const filmTitle = `E2E فيلم ${stamp}`
  const film = await jsonResponse(
    await request.post('/api/admin/films', {
      data: { title: filmTitle, durationMinutes: 90, synopsis: 'حجز تجريبي', posterUrl: null },
    }),
  )
  const auditorium = await jsonResponse(
    await request.post('/api/admin/auditoriums', {
      data: {
        name: `B4.6 Screen ${stamp}`,
        seats: [
          { rowLabel: 'A', seatNumber: 1 },
          { rowLabel: 'A', seatNumber: 2 },
        ],
      },
    }),
  )
  const startsAt = cairoWallClock(new Date(Date.now() + 24 * 60 * 60_000))
  const showtime = await jsonResponse(
    await request.post('/api/admin/showtimes', {
      data: {
        filmId: film.id,
        auditoriumId: auditorium.id,
        startsAt,
        pricePiastres: seatPricePiastres,
      },
    }),
  )
  const published = await jsonResponse(
    await request.post(`/api/admin/showtimes/${showtime.id}/publish`, {
      data: { pricePiastres: seatPricePiastres },
    }),
  )
  expect(published.status).toBe('published')
  return { filmTitle, showtimeId: String(showtime.id) }
}

test('retries a failed confirmation and persists exactly one booking after a reload', async ({
  browser,
  page,
  request,
}) => {
  const stamp = Date.now()
  const email = `e2e-b46-${stamp}@example.com`
  const { filmTitle, showtimeId } = await prepareShowtime(request, stamp)

  let rejectFirstSave = true
  await page.route('**/api/bookings/confirm', async (route) => {
    if (route.request().method() === 'POST' && rejectFirstSave) {
      rejectFirstSave = false
      await route.fulfill({ status: 503, json: { error: 'temporarily_unavailable' } })
      return
    }
    await route.fallback()
  })

  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar-EG')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  const card = page.locator('li').filter({ hasText: filmTitle }).first()
  await expect(card).toBeVisible()
  await card.getByRole('link', { name: 'عرض المقاعد' }).click()
  await expect(page).toHaveURL(new RegExp(`/showtimes/${showtimeId}`))
  await expect(page.getByRole('heading', { name: filmTitle, level: 1 })).toBeVisible()

  const firstSeat = page.getByRole('button', { name: 'المقعد A1 — متاح' })
  await firstSeat.focus()
  await page.keyboard.press('Enter')
  await expect(firstSeat).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'المقعد A2 — متاح' }).click()
  const emailField = page.getByLabel('بريدك الإلكتروني')
  await emailField.fill(email)
  await expect(page.getByText('المقاعد المختارة: A1، A2')).toBeVisible()
  const submit = page.getByRole('button', { name: 'تأكيد الاختيار' })

  await submit.click()
  await expect(page.getByRole('alert')).toHaveText(
    'تعذّر تأكيد الحجز. تحقق من المقاعد وحاول مرة أخرى.',
  )
  await expect(firstSeat).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'المقعد A2 — متاح' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(emailField).toHaveValue(email)
  await expect(page.getByRole('region', { name: 'تم تأكيد حجزك' })).toHaveCount(0)

  await submit.click()
  const confirmation = page.getByRole('region', { name: 'تم تأكيد حجزك' })
  await expect(confirmation.getByRole('heading', { name: 'تم تأكيد حجزك' })).toBeVisible()
  const statusText = await confirmation.getByRole('status').innerText()
  const reference = /bkg_[A-Za-z0-9_-]{32}/.exec(statusText)?.[0]
  expect(reference, `missing reference in: ${statusText}`).toBeDefined()
  await expect(confirmation.getByText(filmTitle)).toBeVisible()
  await expect(confirmation.getByText('قاعة B4.6 Screen')).toBeVisible()
  await expect(confirmation.getByText('A1، A2', { exact: true })).toBeVisible()
  await expect(confirmation.getByText('ادفع المبلغ في المقر عند حضورك العرض.')).toBeVisible()
  await expect(confirmation.getByText(email)).toBeVisible()
  await expect(submit).toHaveCount(0)

  // The seats are claimed on the server, so a fresh read shows them as booked.
  await page.reload()
  await expect(page.getByRole('button', { name: 'المقعد A1 — محجوز' })).toHaveAttribute(
    'aria-disabled',
    'true',
  )
  await expect(page.getByRole('button', { name: 'المقعد A2 — محجوز' })).toHaveAttribute(
    'aria-disabled',
    'true',
  )

  const staffList = await request.get('/api/bookings')
  expect(staffList.ok()).toBeTruthy()
  const bookings = (await staffList.json()) as Array<{ customerEmail: string; startsAt: string }>
  expect(bookings.filter((booking) => booking.customerEmail === email)).toHaveLength(1)

  const anonymousContext = await browser.newContext({
    baseURL: String(test.info().project.use.baseURL ?? 'http://localhost:5173'),
  })
  const denied = await anonymousContext.request.get('/api/bookings')
  expect(denied.status()).toBe(401)
  expect(await denied.json()).toEqual({ error: 'authentication_required' })
  await anonymousContext.close()
})
