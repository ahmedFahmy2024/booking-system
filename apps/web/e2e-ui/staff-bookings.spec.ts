import { expect, test, type Page, type Route } from '@playwright/test'

/** B6.1 browser evidence: a stubbed API on the real Vite proxy, so no staff session or live data is used. */

const BOOKING_ID = '77777777-7777-4777-8777-777777777777'
const OTHER_ID = '77777777-7777-4777-8777-777777777778'
const SHOWTIME_ID = '44444444-4444-4444-8444-444444444444'

const item = (id: string, reference: string) => ({
  id,
  reference,
  status: id === OTHER_ID ? 'cancelled' : 'confirmed',
  customerName: 'Ahmed',
  customerEmail: 'ahmed@example.com',
  filmTitle: 'Cairo Nights',
  serviceName: null,
  startsAt: '2026-12-01T16:00:00.000Z',
  auditoriumName: 'Hall 1',
  seatCount: 2,
  unitPricePiastres: 2500,
  totalPiastres: 5000,
  cancelledAt: null,
})

const filters = {
  films: [{ id: '11111111-1111-4111-8111-111111111111', title: 'Cairo Nights' }],
  showtimes: [
    {
      id: SHOWTIME_ID,
      filmTitle: 'Cairo Nights',
      startsAt: '2026-12-01T16:00:00.000Z',
      auditoriumName: 'Hall 1',
      status: 'published',
    },
  ],
}

const detail = {
  id: BOOKING_ID,
  reference: 'bkg_1',
  status: 'confirmed',
  customerName: 'Ahmed',
  customerEmail: 'ahmed@example.com',
  cancelledAt: null,
  cancelledByUserId: null,
  cancellationReason: null,
  guestLinkSent: true,
  guestLinkExpiresAt: '2026-12-08T16:00:00.000Z',
  showtimeId: SHOWTIME_ID,
  showtimeStatus: 'published',
  unitPricePiastres: 2500,
  totalPiastres: 5000,
  filmTitle: 'Cairo Nights',
  startsAt: '2026-12-01T16:00:00.000Z',
  auditoriumName: 'Hall 1',
  seatLabels: ['A1', 'A2'],
}

const occupancy = {
  showtimeId: SHOWTIME_ID,
  filmTitle: 'Cairo Nights',
  startsAt: '2026-12-01T16:00:00.000Z',
  auditoriumName: 'Hall 1',
  status: 'published',
  totalSeats: 3,
  outOfServiceSeats: 1,
  bookedSeats: 1,
  availableSeats: 1,
  occupancyPercent: 50,
}

function listBody(reference: string | null, status: string | null) {
  const referenceRow =
    reference === 'gate'
      ? 'bkg_gate'
      : reference === 'bkg_2'
        ? 'bkg_2'
        : null
  if (referenceRow) {
    return {
      items: [item(OTHER_ID, referenceRow)],
      total: 1,
      page: 1,
      pageSize: 20,
      pageCount: 1,
    }
  }
  const items =
    status === 'cancelled'
      ? [item(OTHER_ID, 'bkg_2')]
      : [item(BOOKING_ID, 'bkg_1'), item(OTHER_ID, 'bkg_2')]
  return { items, total: items.length, page: 1, pageSize: 20, pageCount: 1 }
}

async function stubList(page: Page, gate?: PromiseWithResolvers<void>) {
  const seen: URL[] = []
  await page.route('**/api/staff/bookings**', async (route: Route) => {
    const url = new URL(route.request().url())
    seen.push(url)
    const reference = url.searchParams.get('reference')
    if (reference === 'gate' && gate) await gate.promise
    return route.fulfill({ json: listBody(reference, url.searchParams.get('status')) })
  })
  await page.route('**/api/staff/bookings/*', (route) => {
    const id = route.request().url().split('/').pop()
    if (id === BOOKING_ID) return route.fulfill({ json: detail })
    return route.fulfill({ status: 404, json: { error: 'booking_not_found' } })
  })
  await page.route('**/api/staff/bookings/filters', (route) => route.fulfill({ json: filters }))
  await page.route('**/api/staff/showtimes/*/occupancy', (route) =>
    route.fulfill({ json: occupancy }),
  )
  return seen
}

async function english(page: Page) {
  await page.addInitScript(() => localStorage.setItem('app-locale', 'en'))
}

test('defaults filters in the URL and restores them on back, forward and reload', async ({ page }) => {
  await english(page)
  const seen = await stubList(page)
  await page.goto('/staff/bookings')

  await expect(page.getByRole('heading', { name: 'Cinema bookings', level: 1 })).toBeVisible()
  expect(new URL(page.url()).searchParams.get('period')).toBe('upcoming')
  expect(new URL(page.url()).searchParams.get('status')).toBe('all')
  expect(new URL(page.url()).searchParams.get('page')).toBe('1')
  await expect(page.getByText('bkg_1')).toBeVisible()

  await page.getByLabel('Booking reference').fill('bkg_2')
  await page.getByLabel('Status').selectOption('cancelled')
  await page.getByRole('button', { name: 'Apply search' }).click()
  await expect(page.getByText('bkg_2')).toBeVisible()
  await expect(page.getByText('bkg_1')).toHaveCount(0)
  const filteredUrl = page.url()
  expect(new URL(filteredUrl).searchParams.get('reference')).toBe('bkg_2')
  expect(new URL(filteredUrl).searchParams.get('status')).toBe('cancelled')
  expect(seen.at(-1)?.searchParams.get('reference')).toBe('bkg_2')
  expect(seen.at(-1)?.searchParams.get('status')).toBe('cancelled')

  await page.goBack()
  await expect(page.getByText('bkg_1')).toBeVisible()
  expect(new URL(page.url()).searchParams.get('reference')).toBe('')
  await page.goForward()
  expect(page.url()).toBe(filteredUrl)
  await expect(page.getByText('bkg_2')).toBeVisible()
  await page.reload()
  expect(page.url()).toBe(filteredUrl)
  await expect(page.getByText('bkg_2')).toBeVisible()
})

test('keeps the current rows visible while a filtered replacement loads', async ({ page }) => {
  await english(page)
  const gate = Promise.withResolvers<void>()
  await stubList(page, gate)
  await page.goto('/staff/bookings')
  await expect(page.getByText('bkg_1')).toBeVisible()

  await page.getByLabel('Booking reference').fill('gate')
  await page.getByRole('button', { name: 'Apply search' }).click()
  await expect(page.getByText('bkg_1')).toBeVisible()
  await expect(page.getByText('bkg_gate')).toHaveCount(0)
  gate.resolve()
  await expect(page.getByText('bkg_gate')).toBeVisible()
  await expect(page.getByText('bkg_1')).toHaveCount(0)
})

test('opens a frozen detail with occupancy and returns to the same filtered list', async ({ page }) => {
  await english(page)
  await stubList(page)
  const listUrl = '/staff/bookings?reference=bkg_1&status=all&period=all&page=2&pageSize=20'
  await page.goto(listUrl)
  await page.getByRole('link', { name: 'Cairo Nights — bkg_1' }).click()

  await expect(page.getByRole('heading', { name: 'Booking details', level: 1 })).toBeVisible()
  await expect(page.getByText('A1، A2', { exact: true })).toBeVisible()
  await expect(page.getByText('ahmed@example.com')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Showtime occupancy' })).toBeVisible()
  await expect(page.getByText('Occupancy 50%')).toBeVisible()
  expect(new URL(page.url()).searchParams.get('reference')).toBe('bkg_1')
  expect(new URL(page.url()).searchParams.get('page')).toBe('2')

  await page.getByRole('link', { name: 'Back to bookings' }).click()
  expect(page.url()).toContain('/staff/bookings?')
  const backParams = new URL(page.url()).searchParams
  const expectedParams = new URL('http://localhost' + listUrl).searchParams
  expect(backParams.get('reference')).toBe(expectedParams.get('reference'))
  expect(backParams.get('status')).toBe(expectedParams.get('status'))
  expect(backParams.get('period')).toBe(expectedParams.get('period'))
  expect(backParams.get('page')).toBe(expectedParams.get('page'))
  expect(backParams.get('pageSize')).toBe(expectedParams.get('pageSize'))
  await expect(page.getByText('bkg_1')).toBeVisible()
})

test('a malformed booking id gets the same localized not-found state', async ({ page }) => {
  await english(page)
  await stubList(page)
  await page.goto('/staff/bookings/not-a-uuid')
  await expect(page.getByRole('alert')).toContainText('This booking does not exist.')
  await expect(page.getByRole('heading', { name: 'Booking details' })).toHaveCount(0)
})

test('shows a localized not-found state and recovers on retry', async ({ page }) => {
  await english(page)
  await stubList(page)
  let found = false
  await page.route('**/api/staff/bookings/*', (route) => {
    if (route.request().url().includes('/filters')) return route.fallback()
    return found
      ? route.fulfill({ json: detail })
      : route.fulfill({ status: 404, json: { error: 'booking_not_found' } })
  })
  await page.goto(`/staff/bookings/${BOOKING_ID}`)

  const alert = page.getByRole('alert')
  await expect(alert).toContainText('This booking does not exist.')
  found = true
  await alert.getByRole('button', { name: 'Retry' }).click()
  await expect(page.getByRole('heading', { name: 'Booking details', level: 1 })).toBeVisible()
  await expect(alert).toHaveCount(0)
})
