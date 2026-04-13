import { IoIosSearch } from 'react-icons/io'
import { BsGear } from 'react-icons/bs'
import { GoSidebarCollapse } from 'react-icons/go'
import { GoSidebarExpand } from 'react-icons/go'
import { FaPlus } from 'react-icons/fa6'
import { FaRegFolder } from 'react-icons/fa6'
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from '@hello-pangea/dnd'
import ThemeToggle from './ThemeToggle'

export type SidebarNote = {
  id: string
  title: string
  linksCount: number
}

export type SidebarSection = {
  id: string
  label: string
  kind: 'folder' | 'unfiled' | 'archived'
  expanded: boolean
  notes: SidebarNote[]
}

type SidebarProps = {
  sections: SidebarSection[]
  selectedId?: string
  collapsed: boolean
  canCreate?: boolean
  canCreateFolder?: boolean
  statusText?: string
  onCreate?: () => void
  onCreateFolder?: () => void
  onSelect: (noteId: string) => void
  onMoveNoteToFolder?: (noteId: string, folderId: string) => void
  onToggleSection: (sectionId: string) => void
  onToggleCollapse: () => void
  onSearch?: () => void
  onConfig?: () => void
}

export default function Sidebar({
  sections,
  selectedId,
  collapsed,
  canCreate,
  canCreateFolder,
  statusText,
  onCreate,
  onCreateFolder,
  onSelect,
  onMoveNoteToFolder,
  onToggleSection,
  onToggleCollapse,
  onSearch,
  onConfig,
}: SidebarProps) {
  function handleDragEnd(result: DropResult) {
    const destinationSectionId = result.destination?.droppableId
    if (
      !destinationSectionId ||
      !onMoveNoteToFolder ||
      !destinationSectionId.startsWith('folder-')
    ) {
      return
    }

    const folderId = destinationSectionId.replace(/^folder-/, '')
    if (!folderId) {
      return
    }

    onMoveNoteToFolder(result.draggableId, folderId)
  }

  return (
    <aside
      data-testid="workspace-sidebar"
      className={`glass note-list-panel workspace-sidebar ${collapsed ? 'note-list-panel-collapsed' : ''}`}
    >
      {/* header */}
      <header className="mx-auto">
        <h2 className="m-0 shrink-0 font-semibold tracking-tight text-base text-(--sea-ink)">
          <p className="inline-flex items-center gap-2 text-(--sea-ink)">
            <img src="/logo512.png" alt="logos" className="h-6 w-6" />
            {collapsed ? '' : 'logos'}
          </p>
        </h2>
      </header>
      {/* actions */}
      <div
        className={`mb-4 flex flex-col gap-2 ${collapsed ? 'justify-center' : 'justify-between'}`}
      >
        <div className="sidebar-actions">
          <button
            className="action-btn action-btn-icon"
            type="button"
            aria-label="Search notes"
            title="Search notes (coming soon)"
            onClick={() => onSearch?.()}
          >
            <IoIosSearch size={'15px'} /> {collapsed ? '' : 'Search'}
          </button>
          <button
            className="action-btn action-btn-icon"
            type="button"
            aria-label="Sidebar settings"
            title="Sidebar settings (coming soon)"
            onClick={() => onConfig?.()}
          >
            <BsGear size={'15px'} /> {collapsed ? '' : 'Config'}
          </button>
          <button
            className="action-btn action-btn-icon"
            type="button"
            aria-label={
              collapsed ? 'Expand notes sidebar' : 'Collapse notes sidebar'
            }
            title={
              collapsed ? 'Expand notes sidebar' : 'Collapse notes sidebar'
            }
            onClick={onToggleCollapse}
          >
            {collapsed ? (
              <>
                <GoSidebarExpand size={'15px'} />
              </>
            ) : (
              <>
                <GoSidebarCollapse size={'15px'} /> Collapse
              </>
            )}
          </button>
          {!collapsed && canCreate && onCreate && (
            <button
              className="action-btn action-btn-icon"
              type="button"
              onClick={onCreate}
            >
              <FaPlus size={'15px'} /> New
            </button>
          )}
          {!collapsed && canCreateFolder && onCreateFolder && (
            <button
              className="action-btn action-btn-icon"
              type="button"
              onClick={onCreateFolder}
            >
              <FaRegFolder size={'15px'} /> Folder
            </button>
          )}
        </div>
        {!collapsed && <h2 className="panel-title">Notes</h2>}
      </div>
      {/* content */}
      <section className="sidebar-content">
        {!collapsed ? (
          <DragDropContext onDragEnd={handleDragEnd}>
            <p className="status-line">{statusText}</p>
            {sections.map((section) => (
              <Droppable key={section.id} droppableId={section.id}>
                {(dropProvided, dropSnapshot) => (
                  <div
                    ref={dropProvided.innerRef}
                    {...dropProvided.droppableProps}
                    className={`sidebar-section ${section.kind === 'folder' ? 'sidebar-section-droppable' : ''} ${dropSnapshot.isDraggingOver && section.kind === 'folder' ? 'sidebar-section-droppable-active' : ''}`}
                  >
                    <button
                      type="button"
                      className={`sidebar-section-toggle sidebar-section-toggle-${section.kind}`}
                      aria-label={`Toggle ${section.label} section`}
                      onClick={() => onToggleSection(section.id)}
                    >
                      <span aria-hidden="true">
                        {section.expanded ? '▾' : '▸'}
                      </span>{' '}
                      {section.label}
                    </button>
                    {section.expanded && (
                      <ul className="note-list">
                        {section.notes.map((note, index) => (
                          <Draggable
                            key={note.id}
                            draggableId={note.id}
                            index={index}
                            disableInteractiveElementBlocking
                          >
                            {(dragProvided, dragSnapshot) => (
                              <li
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                className={
                                  dragSnapshot.isDragging
                                    ? 'sidebar-note-dragging'
                                    : undefined
                                }
                              >
                                <button
                                  type="button"
                                  className={
                                    note.id === selectedId
                                      ? 'note-item note-item-active'
                                      : 'note-item'
                                  }
                                  onClick={() => onSelect(note.id)}
                                >
                                  <span className="note-item-title">
                                    {note.title}
                                  </span>
                                  <span className="note-item-meta">
                                    {note.linksCount} links
                                  </span>
                                </button>
                              </li>
                            )}
                          </Draggable>
                        ))}
                        {dropProvided.placeholder}
                      </ul>
                    )}
                  </div>
                )}
              </Droppable>
            ))}
          </DragDropContext>
        ) : (
          <div className="sidebar-content-spacer" aria-hidden="true" />
        )}
      </section>
      {/* footer */}
      <footer
        className={`border-t border-(--chip-line) pt-5  flex flex-col gap-2 ${collapsed ? 'justify-center' : 'justify-between'}`}
      >
        <div className="sidebar-actions">
          <ThemeToggle collapsed={collapsed} />
        </div>
      </footer>
    </aside>
  )
}
