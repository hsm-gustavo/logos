import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Sidebar from './Sidebar'

type DragEndHandler = (result: {
  draggableId: string
  source: { droppableId: string; index: number }
  destination: { droppableId: string; index: number } | null
}) => void

let lastDragEndHandler: DragEndHandler | null = null
const draggableInteractiveFlags: boolean[] = []
let draggableIsDragging = false

vi.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({
    children,
    onDragEnd,
  }: {
    children: ReactNode
    onDragEnd: DragEndHandler
  }) => {
    lastDragEndHandler = onDragEnd
    return <div data-testid="dnd-context">{children}</div>
  },
  Droppable: ({
    children,
    droppableId,
  }: {
    children: (
      provided: {
        innerRef: (el: HTMLElement | null) => void
        droppableProps: Record<string, unknown>
        placeholder: ReactNode
      },
      snapshot: { isDraggingOver: boolean },
    ) => ReactNode
    droppableId: string
  }) =>
    children(
      {
        innerRef: () => {},
        droppableProps: { 'data-droppable-id': droppableId },
        placeholder: null,
      },
      { isDraggingOver: false },
    ),
  Draggable: ({
    children,
    draggableId,
    disableInteractiveElementBlocking,
  }: {
    children: (
      provided: {
        innerRef: (el: HTMLElement | null) => void
        draggableProps: Record<string, unknown>
        dragHandleProps: Record<string, unknown>
      },
      snapshot: { isDragging: boolean },
    ) => ReactNode
    draggableId: string
    index: number
    disableInteractiveElementBlocking?: boolean
  }) => (
    draggableInteractiveFlags.push(Boolean(disableInteractiveElementBlocking)),
    children(
      {
        innerRef: () => {},
        draggableProps: { 'data-draggable-id': draggableId },
        dragHandleProps: {},
      },
      { isDragging: draggableIsDragging },
    )
  ),
}))

vi.mock('./ThemeToggle', () => ({
  default: () => <button type="button">Theme</button>,
}))

describe('Sidebar', () => {
  afterEach(() => {
    cleanup()
    lastDragEndHandler = null
    draggableInteractiveFlags.length = 0
    draggableIsDragging = false
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

  it('calls folder drop handler when a note is dropped on a folder section', () => {
    const onMoveNoteToFolder =
      vi.fn<(noteId: string, folderId: string) => void>()

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

    act(() => {
      lastDragEndHandler?.({
        draggableId: 'n1',
        source: { droppableId: 'unfiled', index: 0 },
        destination: { droppableId: 'folder-math', index: 0 },
      })
    })

    expect(onMoveNoteToFolder).toHaveBeenCalledWith('n1', 'math')
  })

  it('allows dragging notes from interactive note buttons', () => {
    render(
      <Sidebar
        sections={[
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
      />,
    )

    expect(draggableInteractiveFlags).toContain(true)
  })

  it('applies dragging style while note is being dragged', () => {
    draggableIsDragging = true

    render(
      <Sidebar
        sections={[
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
      />,
    )

    const noteButton = screen.getByRole('button', { name: /Calculus/ })
    expect(noteButton.closest('li')?.className).toContain(
      'sidebar-note-dragging',
    )
  })
})
