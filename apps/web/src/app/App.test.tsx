import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the starter page and updates the counter', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: /get started/i })).toBeDefined()

    const button = screen.getByRole('button', { name: /count is 0/i })
    fireEvent.click(button)
    expect(screen.getByRole('button', { name: /count is 1/i })).toBeDefined()
  })
})
