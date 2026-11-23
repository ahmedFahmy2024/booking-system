import { expect, test } from '@playwright/test'

const films = [{
  id: 'film-1',
  title: 'Cairo Nights',
  durationMinutes: 95,
  synopsis: 'A story set in Cairo.',
  posterUrl: null,
}]
const loadingText = 'جارٍ التحميل…'
const title = 'إدارة الأفلام'

test('submits a numeric duration and a null poster for a blank field', async ({ page }) => {
  await page.route('**/api/admin/films', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 201, json: films[0] })
      return
    }
    await route.fulfill({ json: [] })
  })

  await page.goto('/admin/films')
  await page.getByLabel('عنوان الفيلم').fill(' Cairo Nights ')
  await page.getByLabel('المدة بالدقائق').fill('95')
  await page.getByLabel('نبذة عن الفيلم').fill('A story set in Cairo.')
  const saved = page.waitForResponse((response) => response.request().method() === 'POST'
    && response.url().endsWith('/api/admin/films'))
  await page.getByRole('button', { name: 'إضافة الفيلم' }).click()
  const response = await saved
  expect(response.status()).toBe(201)
  expect(response.request().postDataJSON()).toEqual({
    title: 'Cairo Nights',
    durationMinutes: 95,
    synopsis: 'A story set in Cairo.',
    posterUrl: null,
  })
})

test('reveals the film panel with a native transition after a slow read', async ({ page }) => {
  await page.addInitScript(() => {
    const start = document.startViewTransition.bind(document)
    document.startViewTransition = (update) => {
      const transition = start(update)
      void transition.ready.then(() => {
        for (const animation of document.getAnimations()) {
          if (animation instanceof CSSAnimation && animation.animationName.startsWith('suspense-fade-')) {
            performance.mark(animation.animationName)
          }
        }
      }, () => {})
      return transition
    }
  })
  const responseGate = Promise.withResolvers<void>()
  await page.route('**/api/admin/films', async (route) => {
    await responseGate.promise
    await route.fulfill({ json: films })
  })

  try {
    await page.goto('/admin/films')
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: loadingText })).toBeVisible()
    await expect(page.getByLabel('عنوان الفيلم')).toHaveCount(0)
  } finally {
    responseGate.resolve()
  }

  await expect(page.getByText(films[0].title, { exact: true })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: loadingText })).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => [
    'suspense-fade-in',
    'suspense-fade-out',
  ].every((name) => performance.getEntriesByName(name).length > 0))).toBe(true)
})

test('prefetches films on link intent and opens the warm panel without a fallback', async ({ page }) => {
  let filmReads = 0
  await page.route('**/api/admin/films', async (route) => {
    filmReads += 1
    await route.fulfill({ json: films })
  })
  await page.route('**/api/admin/auditoriums', (route) => route.fulfill({ json: [] }))

  await page.goto('/admin/auditoriums')
  const openFilms = page.getByRole('link', { name: 'الأفلام', exact: true })
  const prefetched = page.waitForResponse((response) => response.url().endsWith('/api/admin/films'))
  await openFilms.hover()
  await (await prefetched).finished()
  await expect(page).toHaveURL(/\/admin\/auditoriums$/)
  await page.evaluate((text) => {
    const observer = new MutationObserver((records) => {
      if (records.some((record) => Array.from(record.addedNodes).some((node) => node.textContent?.includes(text)))) {
        performance.mark('film-panel-fallback-shown')
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
  }, loadingText)

  await openFilms.click()
  await expect(page.getByText(films[0].title, { exact: true })).toBeVisible()
  expect(await page.evaluate(() => performance.getEntriesByName('film-panel-fallback-shown').length)).toBe(0)
  expect(filmReads).toBe(1)
})

test('retries a failed read inside the panel with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  let retryResponse: Promise<void> | undefined
  await page.route('**/api/admin/films', async (route) => {
    if (!retryResponse) {
      return route.fulfill({ status: 503, json: { error: 'unavailable' } })
    }
    await retryResponse
    await route.fulfill({ json: films })
  })

  await page.goto('/admin/films')
  const error = page.getByRole('alert')
  await expect(error).toContainText('تعذر تحميل إدارة الأفلام.')
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await expect(page.getByLabel('عنوان الفيلم')).toHaveCount(0)
  const responseGate = Promise.withResolvers<void>()
  retryResponse = responseGate.promise

  try {
    await error.getByRole('button', { name: 'إعادة المحاولة' }).click()
    const skeleton = page.getByRole('status').locator('[data-slot="skeleton"]').first()
    await expect(skeleton).toHaveCSS('animation-name', 'none')
  } finally {
    responseGate.resolve()
  }

  await expect(page.getByText(films[0].title, { exact: true })).toBeVisible()
  await expect(error).toHaveCount(0)
})
