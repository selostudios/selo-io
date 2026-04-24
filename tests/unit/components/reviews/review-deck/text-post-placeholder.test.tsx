import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TextPostPlaceholder } from '@/components/reviews/review-deck/text-post-placeholder'

describe('TextPostPlaceholder', () => {
  test('renders with expected testid and aspect-ratio class', () => {
    render(<TextPostPlaceholder />)
    const el = screen.getByTestId('text-post-placeholder')
    expect(el).toBeInTheDocument()
    expect(el.className).toMatch(/aspect-/)
  })
})
