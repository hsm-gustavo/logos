import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Sidebar from './Sidebar'

vi.mock('./ThemeToggle', () => ({
  default: () => <button type="button">Theme</button>,
}))

describe('Sidebar', () => {
  afterEach(() => {
    cleanup()
  })

  it('uses a presentation-only contract and emits UI events', () => {
    const onSelect = vi.fn<(id: string) => void>()
    const onCreate = vi.fn<() => void>()
    const onToggleCollapse = vi.fn<() => void>()
    const onSearch = vi.fn<() => void>()
    const onConfig = vi.fn<() => void>()

    render(
      <Sidebar
        notes={[
          { id: 'n1', title: 'Calculus', linksCount: 3 },
          { id: 'n2', title: 'Physics', linksCount: 0 },
        ]}
        selectedId="n1"
        collapsed={false}
        canCreate
        statusText="Ready"
        onSelect={onSelect}
        onCreate={onCreate}
        onToggleCollapse={onToggleCollapse}
        onSearch={onSearch}
        onConfig={onConfig}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Search notes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sidebar settings' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Collapse notes sidebar' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'New' }))
    fireEvent.click(screen.getByRole('button', { name: /Calculus/ }))

    expect(onSearch).toHaveBeenCalledTimes(1)
    expect(onConfig).toHaveBeenCalledTimes(1)
    expect(onToggleCollapse).toHaveBeenCalledTimes(1)
    expect(onCreate).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('n1')
    expect(screen.getByText('3 links')).toBeTruthy()
  })

  it('does not render create button when creation is disabled', () => {
    render(
      <Sidebar
        notes={[]}
        collapsed={false}
        canCreate={false}
        onSelect={() => {}}
        onToggleCollapse={() => {}}
      />,
    )

    expect(screen.queryByRole('button', { name: 'New' })).toBeNull()
  })
})
