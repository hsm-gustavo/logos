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
    const onCreateFolder = vi.fn<() => void>()
    const onToggleCollapse = vi.fn<() => void>()
    const onSearch = vi.fn<() => void>()
    const onConfig = vi.fn<() => void>()

    render(
      <Sidebar
        sections={[
          {
            id: 'folder-math',
            label: 'Math',
            kind: 'folder',
            expanded: true,
            notes: [{ id: 'n1', title: 'Calculus', linksCount: 3 }],
          },
          {
            id: 'unfiled',
            label: 'Unfiled',
            kind: 'unfiled',
            expanded: true,
            notes: [{ id: 'n2', title: 'Physics', linksCount: 0 }],
          },
        ]}
        selectedId="n1"
        collapsed={false}
        canCreate
        canCreateFolder
        statusText="Ready"
        onSelect={onSelect}
        onToggleSection={() => {}}
        onCreate={onCreate}
        onCreateFolder={onCreateFolder}
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
    fireEvent.click(screen.getByRole('button', { name: 'Folder' }))
    fireEvent.click(screen.getByRole('button', { name: /Calculus/ }))

    expect(onSearch).toHaveBeenCalledTimes(1)
    expect(onConfig).toHaveBeenCalledTimes(1)
    expect(onToggleCollapse).toHaveBeenCalledTimes(1)
    expect(onCreate).toHaveBeenCalledTimes(1)
    expect(onCreateFolder).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('n1')
    expect(screen.getByText('3 links')).toBeTruthy()
  })

  it('does not render create button when creation is disabled', () => {
    render(
      <Sidebar
        sections={[]}
        collapsed={false}
        canCreate={false}
        canCreateFolder={false}
        onSelect={() => {}}
        onToggleSection={() => {}}
        onToggleCollapse={() => {}}
      />,
    )

    expect(screen.queryByRole('button', { name: 'New' })).toBeNull()
  })

  it('toggles section visibility through callback', () => {
    const onToggleSection = vi.fn<(sectionId: string) => void>()

    render(
      <Sidebar
        sections={[
          {
            id: 'folder-math',
            label: 'Math',
            kind: 'folder',
            expanded: false,
            notes: [{ id: 'n1', title: 'Calculus', linksCount: 3 }],
          },
        ]}
        collapsed={false}
        onSelect={() => {}}
        onToggleSection={onToggleSection}
        onToggleCollapse={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Toggle Math section' }))

    expect(onToggleSection).toHaveBeenCalledWith('folder-math')
    expect(screen.queryByRole('button', { name: /Calculus/ })).toBeNull()
  })

  it('does not render create folder button when folder creation is disabled', () => {
    render(
      <Sidebar
        sections={[]}
        collapsed={false}
        canCreateFolder={false}
        onSelect={() => {}}
        onToggleSection={() => {}}
        onToggleCollapse={() => {}}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Folder' })).toBeNull()
  })

  it('calls folder drop handler when a note is dropped on a section', () => {
    const onMoveNoteToFolder =
      vi.fn<(noteId: string, folderId: string) => void>()
    const dataTransfer = {
      store: new Map<string, string>(),
      setData(type: string, value: string) {
        this.store.set(type, value)
      },
      getData(type: string) {
        return this.store.get(type) ?? ''
      },
    }

    render(
      <Sidebar
        sections={[
          {
            id: 'folder-math',
            label: 'Math',
            kind: 'folder',
            expanded: true,
            notes: [],
          },
          {
            id: 'unfiled',
            label: 'Unfiled',
            kind: 'unfiled',
            expanded: true,
            notes: [{ id: 'n1', title: 'Calculus', linksCount: 3 }],
          },
        ]}
        collapsed={false}
        onSelect={() => {}}
        onToggleSection={() => {}}
        onToggleCollapse={() => {}}
        onMoveNoteToFolder={onMoveNoteToFolder}
      />,
    )

    const section = screen.getByRole('button', { name: 'Toggle Math section' })
      .parentElement as HTMLElement

    fireEvent.dragStart(screen.getByRole('button', { name: /Calculus/ }), {
      dataTransfer,
    })
    fireEvent.drop(section, { dataTransfer })

    expect(onMoveNoteToFolder).toHaveBeenCalledWith('n1', 'math')
  })
})
