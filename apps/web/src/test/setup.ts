import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll } from 'vitest'

// TanStack Router restores scroll on navigation; jsdom has no implementation.
beforeAll(() => {
  window.scrollTo = () => {}
})

afterEach(() => {
  cleanup()
})
