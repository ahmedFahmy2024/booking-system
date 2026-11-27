import { expect, test, type Page, type Route } from '@playwright/test'

/** B5.1 browser evidence: the guest page uses a stubbed API so no live Neon data or private link is involved. */

const reference = `bkg_${'a'.repeat(32)}`
const token = `gl_${'A'.repeat(43)}`
const detail = {
  id: '33333333-3333-4333-8333-333333333333',
  reference,
  showtimeId: '11111111-1111-4111-8111-111111111111',
  filmTitle: 'Cairo Nights',
  startsAt: '2026-12-01T12:00:00.000Z',
  auditoriumName: 'Hall 1',
  seatLabels: ['A1', 'A2'],
  unitPricePiastres: 2500,
  totalPiastres: 5000,
  customerEmail: 'guest@example.com',
  status: 'confirmed',
  canCancel: true,
}

const cancelledDetail = { ...detail, status: 'cancelled', canCancel: false }

function guestDenial(route: Route) {
  return route.fulfill({
    status: 404,
    json: { error: 'guest_link_invalid' },
    headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  })
}

function guestDetail(route: Route) {
  return route.fulfill({
    status: 200,
    json: detail,
    headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  })
}

async function stubGuestDetail(page: Page, accept: (token: string | null) => boolean) {
  await page.route(`**/api/guest/bookings/${reference}*`, (route) => {
    const sentToken = new URL(route.request().url()).searchParams.get('token')
    return accept(sentToken) ? guestDetail(route) : guestDenial(route)
  })
}

test('opens a valid private link with frozen details and no credential in the DOM', async ({ page }) => {
  await stubGuestDetail(page, (sentToken) => sentToken === token)
  let guestReferer: string | undefined
  page.on('request', (request) => {
    if (request.url().includes('/api/guest/bookings/')) guestReferer = request.headers().referer
  })
  await page.goto(`/guest/bookings/${reference}?token=${token}`)

  await expect(page.getByRole('heading', { name: 'تفاصيل حجزك', level: 1 })).toBeVisible()
  const card = page.getByRole('region', { name: 'تفاصيل الحجز' })
  await expect(card.getByRole('status')).toContainText(reference)
  await expect(card.getByText('Cairo Nights')).toBeVisible()
  await expect(card.getByText('قاعة Hall 1')).toBeVisible()
  await expect(card.getByText('A1، A2', { exact: true })).toBeVisible()
  await expect(card.getByText(/guest@example.com/)).toBeVisible()
  await expect(card.getByText('ادفع المبلغ في المقر عند حضورك العرض.')).toBeVisible()
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer')
  expect(await page.locator('body').innerText()).not.toContain(token)
  for (const href of await page.locator('a').evaluateAll((links) => links.map((link) => link.getAttribute('href')))) {
    expect(href ?? '').not.toContain(token)
  }
  expect(guestReferer ?? '').not.toContain(token)
})

test('gives only a generic denial when only the reference is known', async ({ page }) => {
  await stubGuestDetail(page, () => false)
  await page.goto(`/guest/bookings/${reference}`)

  await expect(page.getByRole('alert')).toContainText('هذا الرابط الخاص غير صالح أو انتهت صلاحيته.')
  await expect(page.getByRole('region', { name: 'تفاصيل الحجز' })).toHaveCount(0)
  expect(await page.locator('body').innerText()).not.toContain(detail.customerEmail)
  expect(await page.locator('body').innerText()).not.toContain(detail.filmTitle)
})

test('recovers from a denied read on retry without reloading the document', async ({ page }) => {
  // TanStack Query retries automatically, so keep denying until the explicit
  // retry click releases the gate. This mirrors the catalogue route-error case.
  let retryGate: Promise<void> | undefined
  await page.route(`**/api/guest/bookings/${reference}*`, async (route) => {
    if (!retryGate) return guestDenial(route)
    await retryGate
    return guestDetail(route)
  })
  await page.goto(`/guest/bookings/${reference}?token=${token}`)

  const error = page.getByRole('alert')
  await expect(error).toContainText('هذا الرابط الخاص غير صالح أو انتهت صلاحيته.')
  const gate = Promise.withResolvers<void>()
  retryGate = gate.promise
  try {
    await error.getByRole('button', { name: 'إعادة المحاولة' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'جارٍ التحميل' })).toBeVisible()
  } finally {
    gate.resolve()
  }
  await expect(page.getByRole('heading', { name: 'تفاصيل حجزك', level: 1 })).toBeVisible()
  await expect(page.getByRole('region', { name: 'تفاصيل الحجز' })).toContainText(detail.customerEmail)
  await expect(error).toHaveCount(0)
})

test('a wrong token is denied with the same generic message and not logged in dev', async ({ page }) => {
  await stubGuestDetail(page, () => false)
  const consoleText: string[] = []
  page.on('console', (message) => consoleText.push(message.text()))
  await page.goto(`/guest/bookings/${reference}?token=${`gl_${'B'.repeat(43)}`}`)

  await expect(page.getByRole('alert')).toContainText('هذا الرابط الخاص غير صالح أو انتهت صلاحيته.')
  expect(await page.locator('body').innerText()).not.toContain(detail.customerEmail)
  await expect(page.getByRole('region', { name: 'تفاصيل الحجز' })).toHaveCount(0)
  expect(consoleText.join(' ')).not.toContain('gl_')
})

test('a duplicated token query is normalised to the first value and denied generically', async ({ page }) => {
  await stubGuestDetail(page, (sentToken) => sentToken === token)
  await page.goto(`/guest/bookings/${reference}?token=wrong&token=${token}`)

  await expect(page.getByRole('alert')).toContainText('هذا الرابط الخاص غير صالح أو انتهت صلاحيته.')
  await expect(page.getByRole('region', { name: 'تفاصيل الحجز' })).toHaveCount(0)
})

test('requires an explicit confirmation and sends the credential in a header, not the URL', async ({ page }) => {
  // The mutation invalidates the pinned detail query, so the stub must reflect
  // the committed cancellation on the refetch just like the real API does.
  let currentDetail: unknown = detail
  await page.route(`**/api/guest/bookings/${reference}*`, (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    const sentToken = new URL(route.request().url()).searchParams.get('token')
    return sentToken === token ? guestDetailWith(route, currentDetail) : guestDenial(route)
  })
  let cancelRequests = 0
  await page.route(`**/api/guest/bookings/${reference}/cancel`, (route) => {
    cancelRequests += 1
    expect(route.request().method()).toBe('POST')
    expect(route.request().headers()['x-guest-token']).toBe(token)
    expect(route.request().url()).not.toContain(token)
    currentDetail = cancelledDetail
    return route.fulfill({
      status: 200,
      json: cancelledDetail,
      headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
    })
  })
  await page.goto(`/guest/bookings/${reference}?token=${token}`)

  await page.getByRole('button', { name: 'إلغاء الحجز' }).click()
  expect(cancelRequests).toBe(0)
  await expect(page.getByText(/هل تريد إلغاء هذا الحجز كاملًا/)).toBeVisible()
  await page.getByRole('button', { name: 'تأكيد الإلغاء' }).click()

  await expect(page.getByText(/تم إلغاء الحجز/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'إلغاء الحجز' })).toHaveCount(0)
  expect(cancelRequests).toBe(1)
  expect(await page.locator('body').innerText()).not.toContain(token)
})

test('a closed cancellation window shows a localized error and keeps the booking', async ({ page }) => {
  await stubGuestDetail(page, (sentToken) => sentToken === token)
  await page.route(`**/api/guest/bookings/${reference}/cancel`, (route) =>
    route.fulfill({
      status: 409,
      json: { error: 'cancellation_closed' },
      headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
    }),
  )
  await page.goto(`/guest/bookings/${reference}?token=${token}`)

  await page.getByRole('button', { name: 'إلغاء الحجز' }).click()
  await page.getByRole('button', { name: 'تأكيد الإلغاء' }).click()

  await expect(page.getByRole('alert')).toContainText('انتهت مهلة الإلغاء')
  await expect(page.getByRole('region', { name: 'تفاصيل الحجز' })).toContainText(detail.customerEmail)
  await expect(page.getByRole('button', { name: 'تأكيد الإلغاء' })).toBeVisible()
})

test('closes the confirmation panel when a refused write refreshes the booking as closed', async ({ page }) => {
  let currentDetail: unknown = detail
  await page.route(`**/api/guest/bookings/${reference}*`, (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    return guestDetailWith(route, currentDetail)
  })
  await page.route(`**/api/guest/bookings/${reference}/cancel`, (route) => {
    currentDetail = { ...detail, canCancel: false }
    return route.fulfill({
      status: 409,
      json: { error: 'cancellation_closed' },
      headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
    })
  })
  await page.goto(`/guest/bookings/${reference}?token=${token}`)

  await page.getByRole('button', { name: 'إلغاء الحجز' }).click()
  await page.getByRole('button', { name: 'تأكيد الإلغاء' }).click()

  await expect(page.getByText(/انتهت مهلة الإلغاء/)).toBeVisible()
  await expect(page.getByText(/هل تريد إلغاء هذا الحجز كاملًا/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'إلغاء الحجز' })).toHaveCount(0)
})

test('hides the cancel action when the two-hour window is already closed', async ({ page }) => {
  await stubGuestDetail(page, (sentToken) => sentToken === token)
  await page.route(`**/api/guest/bookings/${reference}*`, (route) =>
    guestDetailWith(route, { ...detail, canCancel: false }),
  )
  await page.goto(`/guest/bookings/${reference}?token=${token}`)

  await expect(page.getByRole('region', { name: 'تفاصيل الحجز' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'إلغاء الحجز' })).toHaveCount(0)
})

function guestDetailWith(route: Route, body: unknown) {
  return route.fulfill({
    status: 200,
    json: body,
    headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  })
}
