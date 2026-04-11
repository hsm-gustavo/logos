import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { Extension } from '@codemirror/state'
import { autocompletion } from '@codemirror/autocomplete'
import { markdown } from '@codemirror/lang-markdown'
import { EditorView } from '@codemirror/view'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useReactToPrint } from 'react-to-print'
import { createDebouncedRunner } from './autoSave'
import { createNoteID } from './noteId'
import { createWikiCompletionSource } from './wikiCompletion'
import { livePreviewStateField } from './livePreviewExtension'
import {
  foldersListQueryOptions,
  noteByIdQueryOptions,
  notesListQueryOptions,
  searchNotesQueryOptions,
} from './notesQueries'
import { useUIStore } from './uiStore'

export type WorkspaceSearchResult = {
  note: {
    id: string
    title: string
    state?: string
  }
  score: number
  matchSource: 'title' | 'content' | 'both'
}

export type WorkspaceNote = {
  id: string
  title: string
  content: string
  links: string[]
  folderId?: string
  state?: string
  updatedAt: string
}

type WorkspaceFolder = {
  id: string
  name: string
  updatedAt: string
}

export type WorkspaceSearch = {
  note?: string
  noteTitle?: string
}

type NavigateFn = (options: {
  search: { note: string }
}) => void | Promise<void>

type UseWorkspaceRouteArgs = {
  search: WorkspaceSearch
  navigate: NavigateFn
}

type WorkspaceRouteState = {
  activeNote: WorkspaceNote | null
  draft: string
  editorExtensions: Extension[]
  exportPreviewToPDF: () => void
  isAutoSaving: boolean
  isSearchLoading: boolean
  isSearchOpen: boolean
  isReadOnly: boolean
  previewContainerRef: RefObject<HTMLDivElement | null>
  searchError: string | null
  searchQuery: string
  searchResults: WorkspaceSearchResult[]
  setIsSearchOpen: (value: boolean) => void
  setSearchQuery: (value: string) => void
  saveCurrentNote: () => Promise<void>
  setDraft: (value: string) => void
  setIsReadOnly: (value: boolean | ((current: boolean) => boolean)) => void
}

export function useWorkspaceRoute({
  search,
  navigate,
}: UseWorkspaceRouteArgs): WorkspaceRouteState {
  const [activeNote, setActiveNote] = useState<WorkspaceNote | null>(null)
  const [draft, setDraft] = useState('')
  const [isAutoSaving, setIsAutoSaving] = useState(false)
  const [isReadOnly, setIsReadOnly] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const status = useUIStore((state) => state.status)
  const setStatus = useUIStore((state) => state.setStatus)
  const setWorkspaceSidebar = useUIStore((state) => state.setWorkspaceSidebar)
  const clearWorkspaceSidebar = useUIStore(
    (state) => state.clearWorkspaceSidebar,
  )
  const sidebarSectionsExpanded = useUIStore(
    (state) => state.sidebarSectionsExpanded,
  )
  const toggleSidebarSectionExpanded = useUIStore(
    (state) => state.toggleSidebarSectionExpanded,
  )
  const workspaceSearch = useUIStore((state) => state.workspaceSearch)
  const setWorkspaceSearch = useUIStore((state) => state.setWorkspaceSearch)
  const clearWorkspaceSearch = useUIStore((state) => state.clearWorkspaceSearch)
  const queryClient = useQueryClient()
  const notesQuery = useQuery(notesListQueryOptions())
  const foldersQuery = useQuery(foldersListQueryOptions())
  const autoSaveRunnerRef = useRef(createDebouncedRunner(500))
  const hasSeededWorkspaceRef = useRef(false)
  const previewContainerRef = useRef<HTMLDivElement | null>(null)

  const notes = notesQuery.data ?? []
  const folders = (foldersQuery.data ?? []) as WorkspaceFolder[]

  const searchQuery = useQuery({
    ...searchNotesQueryOptions(debouncedSearchQuery),
    enabled: workspaceSearch.isOpen && debouncedSearchQuery.trim() !== '',
  })

  const printPreview = useReactToPrint({
    contentRef: previewContainerRef,
    documentTitle: activeNote?.title?.trim() || 'Note',
    pageStyle: `
      @page {
        margin: 36px;
      }

      html, body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      body {
        margin: 0;
      }
    `,
    onPrintError: () => {
      setStatus('Could not open print dialog.')
    },
  })

  const editorExtensions = useMemo(() => {
    const titles = notes.map((note) => note.title)
    return [
      markdown(),
      EditorView.lineWrapping,
      livePreviewStateField,
      autocompletion({
        override: [createWikiCompletionSource(titles)],
      }),
    ]
  }, [notes])

  const selectedNoteId = useMemo(() => {
    return resolveNoteIDFromSearch(notes, search) || notes[0]?.id || ''
  }, [notes, search])

  const sidebarSections = useMemo(() => {
    const activeNotes = notes.filter((note) => note.state !== 'archived')
    const archivedNotes = notes.filter((note) => note.state === 'archived')

    const folderSections = folders.map((folder) => {
      const sectionID = `folder-${folder.id}`
      const grouped = activeNotes
        .filter((note) => note.folderId === folder.id)
        .map((note) => ({
          id: note.id,
          title: note.title,
          linksCount: note.links.length,
        }))

      return {
        id: sectionID,
        label: folder.name,
        kind: 'folder' as const,
        expanded: sidebarSectionsExpanded[sectionID] ?? true,
        notes: grouped,
      }
    })

    const unfiledSectionID = 'unfiled'
    const unfiledSection = {
      id: unfiledSectionID,
      label: 'Unfiled',
      kind: 'unfiled' as const,
      expanded: sidebarSectionsExpanded[unfiledSectionID] ?? true,
      notes: activeNotes
        .filter((note) => !note.folderId)
        .map((note) => ({
          id: note.id,
          title: note.title,
          linksCount: note.links.length,
        })),
    }

    const archivedSectionID = 'archived'
    const archivedSection = {
      id: archivedSectionID,
      label: 'Archived',
      kind: 'archived' as const,
      expanded: sidebarSectionsExpanded[archivedSectionID] ?? false,
      notes: archivedNotes.map((note) => ({
        id: note.id,
        title: note.title,
        linksCount: note.links.length,
      })),
    }

    return [...folderSections, unfiledSection, archivedSection]
  }, [folders, notes, sidebarSectionsExpanded])

  useEffect(() => {
    if (notesQuery.isError) {
      setStatus('Backend unavailable. Start Go API on :8080.')
    }
  }, [notesQuery.isError, setStatus])

  useEffect(() => {
    if (foldersQuery.isError) {
      setStatus('Could not load folders.')
    }
  }, [foldersQuery.isError, setStatus])

  useEffect(() => {
    if (workspaceSearch.query.trim() === '') {
      setDebouncedSearchQuery('')
      return
    }

    const timer = window.setTimeout(() => {
      setDebouncedSearchQuery(workspaceSearch.query.trim())
    }, 300)

    return () => {
      window.clearTimeout(timer)
    }
  }, [workspaceSearch.query])

  useEffect(() => {
    if (!selectedNoteId || notes.length === 0) {
      return
    }

    void openNote(selectedNoteId)
  }, [selectedNoteId, notes.length])

  useEffect(() => {
    if (
      notesQuery.isLoading ||
      notes.length > 0 ||
      hasSeededWorkspaceRef.current
    ) {
      return
    }

    hasSeededWorkspaceRef.current = true
    void (async () => {
      const seed = await createStarterNote()
      setActiveNote(seed)
      setDraft(seed.content)
      setStatus('Created your first note. Start writing.')
      await queryClient.invalidateQueries({ queryKey: ['notes'] })
      await navigate({ search: { note: seed.id } })
    })()
  }, [navigate, notes.length, notesQuery.isLoading, queryClient, setStatus])

  useEffect(() => {
    return () => {
      autoSaveRunnerRef.current.cancel()
      clearWorkspaceSearch()
    }
  }, [clearWorkspaceSearch])

  useEffect(() => {
    if (!workspaceSearch.isOpen || workspaceSearch.query.trim() === '') {
      setWorkspaceSearch((current) => ({
        ...current,
        results: [],
        error: null,
        isLoading: false,
      }))
      return
    }

    setWorkspaceSearch((current) => ({
      ...current,
      isLoading: searchQuery.isFetching,
      error: searchQuery.isError ? 'Could not search notes.' : null,
      results: (searchQuery.data ?? []) as WorkspaceSearchResult[],
    }))
  }, [
    searchQuery.data,
    searchQuery.isError,
    searchQuery.isFetching,
    setWorkspaceSearch,
    workspaceSearch.isOpen,
    workspaceSearch.query,
  ])

  useEffect(() => {
    if (!activeNote || isReadOnly) {
      return
    }

    if (draft === activeNote.content) {
      return
    }

    setIsAutoSaving(true)
    autoSaveRunnerRef.current.schedule(() => {
      void persistNote(activeNote.id, activeNote.title, draft, true)
    })
  }, [activeNote, draft, isReadOnly])

  useEffect(() => {
    setWorkspaceSidebar({
      sections: sidebarSections,
      selectedId: activeNote?.id,
      collapsed: isSidebarCollapsed,
      canCreate: !isReadOnly,
      canCreateFolder: !isReadOnly,
      statusText: status,
      onCreate: () => {
        void createNote()
      },
      onCreateFolder: () => {
        void createFolder()
      },
      onSelect: (noteId: string) => {
        void (async () => {
          await navigate({ search: { note: noteId } })
          await openNote(noteId)
        })()
      },
      onMoveNoteToFolder: (noteId: string, folderId: string) => {
        void moveNoteToFolder(noteId, folderId)
      },
      onToggleSection: (sectionId: string) => {
        toggleSidebarSectionExpanded(sectionId)
      },
      onToggleCollapse: () => setIsSidebarCollapsed((current) => !current),
      onSearch: () => {
        setWorkspaceSearch((current) => ({
          ...current,
          isOpen: true,
        }))
        setStatus('Search open.')
      },
      onConfig: () => setStatus('Sidebar settings are coming soon.'),
    })

    return () => {
      clearWorkspaceSidebar()
    }
  }, [
    activeNote?.id,
    clearWorkspaceSidebar,
    isReadOnly,
    isSidebarCollapsed,
    navigate,
    setStatus,
    setWorkspaceSidebar,
    sidebarSections,
    status,
    toggleSidebarSectionExpanded,
  ])

  async function openNote(noteID: string) {
    try {
      const note = (await queryClient.fetchQuery(
        noteByIdQueryOptions(noteID),
      )) as WorkspaceNote
      setActiveNote(note)
      setDraft(note.content)
      setStatus(`Editing ${note.title}`)
    } catch {
      setStatus('Could not open that note.')
    }
  }

  async function persistNote(
    noteID: string,
    noteTitle: string,
    content: string,
    silent: boolean,
  ) {
    const response = await fetch(`/api/notes/${noteID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: noteTitle,
        content,
      }),
    })

    if (!response.ok) {
      setIsAutoSaving(false)
      if (!silent) {
        setStatus('Save failed.')
      }
      return false
    }

    let updatedNote: WorkspaceNote | null = null
    try {
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        updatedNote = (await response.json()) as WorkspaceNote
      }
    } catch {
      // Keep the local draft if the backend response is empty or malformed.
    }

    setActiveNote((current) => {
      if (!current || current.id !== noteID) return current
      return updatedNote || { ...current, content }
    })

    queryClient.setQueryData(
      noteByIdQueryOptions(noteID).queryKey,
      (current: WorkspaceNote | undefined) => {
        if (!current) {
          return (
            updatedNote || {
              id: noteID,
              title: noteTitle,
              content,
              links: [],
              updatedAt: new Date().toISOString(),
            }
          )
        }

        return (
          updatedNote || {
            ...current,
            content,
            updatedAt: new Date().toISOString(),
          }
        )
      },
    )
    await queryClient.invalidateQueries({ queryKey: ['notes'] })

    setIsAutoSaving(false)

    if (!silent) {
      setStatus('Saved.')
    } else {
      setStatus('Auto-saved.')
    }

    return true
  }

  async function saveCurrentNote() {
    if (!activeNote) {
      return
    }

    autoSaveRunnerRef.current.cancel()
    const ok = await persistNote(activeNote.id, activeNote.title, draft, false)
    if (!ok) {
      return
    }

    await openNote(activeNote.id)
    await queryClient.invalidateQueries({ queryKey: ['notes'] })
  }

  function exportPreviewToPDF() {
    if (!isReadOnly) {
      return
    }

    const previewRoot = previewContainerRef.current
    if (!previewRoot) {
      setStatus('Preview not ready for export.')
      return
    }

    setStatus('Print dialog opened. Choose Save as PDF.')
    printPreview()
  }

  async function createNote() {
    const baseName = `note-${notes.length + 1}`
    const nextID = createNoteID()
    const content = `# ${baseName}\n\nStart here.`
    await upsertNote(nextID, content)
    await queryClient.invalidateQueries({ queryKey: ['notes'] })
    await navigate({ search: { note: nextID } })
    setStatus('New note created.')
  }

  async function createFolder() {
    const folderName = window.prompt('Folder name')?.trim()
    if (!folderName) {
      return
    }

    const response = await fetch('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: folderName }),
    })

    if (!response.ok) {
      setStatus('Could not create folder.')
      return
    }

    await queryClient.invalidateQueries({ queryKey: ['folders'] })
    setStatus(`Folder ${folderName} created.`)
  }

  async function moveNoteToFolder(noteID: string, folderID: string) {
    try {
      const note = (await queryClient.fetchQuery(
        noteByIdQueryOptions(noteID),
      )) as WorkspaceNote

      const response = await fetch(`/api/notes/${noteID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: note.title,
          content: note.content,
          folderId: folderID,
        }),
      })

      if (!response.ok) {
        setStatus('Could not move note.')
        return
      }

      queryClient.setQueryData(
        noteByIdQueryOptions(noteID).queryKey,
        (current: WorkspaceNote | undefined) =>
          current ? { ...current, folderId: folderID } : current,
      )
      await queryClient.invalidateQueries({ queryKey: ['notes'] })

      if (activeNote?.id === noteID) {
        setActiveNote((current) =>
          current ? { ...current, folderId: folderID } : current,
        )
      }

      setStatus(`Moved ${note.title} to folder.`)
    } catch {
      setStatus('Could not move note.')
    }
  }

  async function createStarterNote() {
    const starterID = 'welcome-to-logos'
    const starter = `# Welcome to Logos

This note-taking workspace is Markdown native.

## Essentials

- Internal links: [[calculus-i]]
- Math: $\\int_0^1 x^2 dx = 1/3$
- Code:

\`\`\`go
func greet() string {
  return "hello"
}
\`\`\`

![Diagram](https://images.unsplash.com/photo-1513258496099-48168024aec0?auto=format&fit=crop&w=1000&q=80)
`
    await upsertNote(starterID, starter)

    return {
      id: starterID,
      title: 'Welcome to Logos',
      content: starter,
      links: ['calculus-i'],
      updatedAt: new Date().toISOString(),
    }
  }

  async function upsertNote(id: string, content: string) {
    await fetch(`/api/notes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: id,
        content,
      }),
    })
  }

  return {
    activeNote,
    draft,
    editorExtensions,
    exportPreviewToPDF,
    isAutoSaving,
    isReadOnly,
    previewContainerRef,
    searchError: workspaceSearch.error,
    searchQuery: workspaceSearch.query,
    searchResults: workspaceSearch.results,
    isSearchOpen: workspaceSearch.isOpen,
    isSearchLoading: workspaceSearch.isLoading,
    setIsSearchOpen: (value: boolean) =>
      setWorkspaceSearch((current) => ({
        ...current,
        isOpen: value,
        ...(value
          ? {}
          : { query: '', results: [], error: null, isLoading: false }),
      })),
    setSearchQuery: (value: string) =>
      setWorkspaceSearch((current) => ({
        ...current,
        query: value,
      })),
    saveCurrentNote,
    setDraft,
    setIsReadOnly,
  }
}

export function resolveNoteIDFromSearch(
  notes: WorkspaceNote[],
  search: WorkspaceSearch,
): string {
  const noteID = search.note?.trim()
  if (noteID) {
    return noteID
  }

  const rawTitle = search.noteTitle?.trim()
  if (!rawTitle) {
    return ''
  }

  const title = rawTitle.toLocaleLowerCase()
  const match = notes.find(
    (note) => note.title.trim().toLocaleLowerCase() === title,
  )
  return match?.id ?? ''
}
