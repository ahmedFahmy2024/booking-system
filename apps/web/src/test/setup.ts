import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll } from 'vitest'
import '../app/providers/locale/i18n'

// TanStack Router restores scroll on navigation; jsdom has no implementation.
beforeAll(() => {
  window.scrollTo = () => {}
})

afterEach(() => {
  cleanup()
})
