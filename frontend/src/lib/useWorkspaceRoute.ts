import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { Extension } from '@codemirror/state'
import { autocompletion } from '@codemirror/autocomplete'
import { markdown } from '@codemirror/lang-markdown'
import { EditorView } from '@codemirror/view'
import { useReactToPrint } from 'react-to-print'
import { createDebouncedRunner } from './autoSave'
import { createNoteID } from './noteId'
import { createWikiCompletionSource } from './wikiCompletion'
import { livePreviewStateField } from './livePreviewExtension'
import { useUIStore } from './uiStore'

export type WorkspaceNote = {
  id: string
  title: string
  content: string
  links: string[]
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
  isReadOnly: boolean
  previewContainerRef: RefObject<HTMLDivElement | null>
  saveCurrentNote: () => Promise<void>
  setDraft: (value: string) => void
  setIsReadOnly: (value: boolean | ((current: boolean) => boolean)) => void
}

export function useWorkspaceRoute({
  search,
  navigate,
}: UseWorkspaceRouteArgs): WorkspaceRouteState {
  const [notes, setNotes] = useState<WorkspaceNote[]>([])
  const [activeNote, setActiveNote] = useState<WorkspaceNote | null>(null)
  const [draft, setDraft] = useState('')
  const [isAutoSaving, setIsAutoSaving] = useState(false)
  const [isReadOnly, setIsReadOnly] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const status = useUIStore((state) => state.status)
  const setStatus = useUIStore((state) => state.setStatus)
  const setWorkspaceSidebar = useUIStore((state) => state.setWorkspaceSidebar)
  const clearWorkspaceSidebar = useUIStore(
    (state) => state.clearWorkspaceSidebar,
  )
  const autoSaveRunnerRef = useRef(createDebouncedRunner(500))
  const previewContainerRef = useRef<HTMLDivElement | null>(null)

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
    return resolveNoteIDFromSearch(notes, search)
  }, [notes, search])

  const sidebarNotes = useMemo(
    () =>
      notes.map((note) => ({
        id: note.id,
        title: note.title,
        linksCount: note.links.length,
      })),
    [notes],
  )

  useEffect(() => {
    void loadNotes()
  }, [])

  useEffect(() => {
    if (!selectedNoteId || notes.length === 0) {
      return
    }

    void openNote(selectedNoteId)
  }, [selectedNoteId, notes.length])

  useEffect(() => {
    return () => {
      autoSaveRunnerRef.current.cancel()
    }
  }, [])

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
      notes: sidebarNotes,
      selectedId: activeNote?.id,
      collapsed: isSidebarCollapsed,
      canCreate: !isReadOnly,
      statusText: status,
      onCreate: () => {
        void createNote()
      },
      onSelect: (noteId: string) => {
        void (async () => {
          await navigate({ search: { note: noteId } })
          await openNote(noteId)
        })()
      },
      onToggleCollapse: () => setIsSidebarCollapsed((current) => !current),
      onSearch: () => setStatus('Search is coming soon.'),
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
    sidebarNotes,
    status,
  ])

  async function loadNotes() {
    const response = await fetch('/api/notes')
    if (!response.ok) {
      setStatus('Backend unavailable. Start Go API on :8080.')
      return
    }

    const data = (await response.json()) as WorkspaceNote[]
    setNotes(data)

    if (data.length === 0) {
      const seed = await createStarterNote()
      setNotes([seed])
      setActiveNote(seed)
      setDraft(seed.content)
      setStatus('Created your first note. Start writing.')
      await navigate({ search: { note: seed.id } })
      return
    }

    const initialId = resolveNoteIDFromSearch(data, search) || data[0]?.id
    if (initialId) {
      await openNote(initialId)
    }
  }

  async function openNote(noteID: string) {
    const response = await fetch(`/api/notes/${noteID}`)
    if (!response.ok) {
      setStatus('Could not open that note.')
      return
    }

    const note = (await response.json()) as WorkspaceNote
    setActiveNote(note)
    setDraft(note.content)
    setStatus(`Editing ${note.title}`)
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

    setNotes((current) =>
      current.map((note) =>
        note.id === noteID
          ? updatedNote || {
              ...note,
              content,
              updatedAt: new Date().toISOString(),
            }
          : note,
      ),
    )

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
    await loadNotes()
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
    await loadNotes()
    await navigate({ search: { note: nextID } })
    setStatus('New note created.')
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
