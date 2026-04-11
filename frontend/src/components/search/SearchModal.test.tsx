import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SearchModal } from './SearchModal'

describe('SearchModal', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders skeleton rows while loading search results', () => {
    render(
      <SearchModal
        isOpen
        query="calc"
        isLoading
        error={null}
        results={[]}
        onClose={() => {}}
        onQueryChange={() => {}}
        onResultSelect={() => {}}
      />,
    )

    expect(screen.queryByText('Searching...')).toBeNull()
    expect(screen.getAllByTestId('search-skeleton-row')).toHaveLength(3)
  })

  it('closes on backdrop click and keeps inner clicks inside', () => {
    const onClose = vi.fn<() => void>()

    render(
      <SearchModal
        isOpen
        query=""
        isLoading={false}
        error={null}
        results={[]}
        onClose={onClose}
        onQueryChange={() => {}}
        onResultSelect={() => {}}
      />,
    )

    fireEvent.click(screen.getByLabelText('Search notes input'))
    expect(onClose).toHaveBeenCalledTimes(0)

    fireEvent.click(screen.getByRole('dialog', { name: 'Search notes' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
