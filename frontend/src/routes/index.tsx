import { useEffect, useMemo, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { autocompletion } from '@codemirror/autocomplete'
import { markdown } from '@codemirror/lang-markdown'
import { EditorView } from '@codemirror/view'
import { createFileRoute } from '@tanstack/react-router'
import { createNoteID } from '../lib/noteId'
import { createDebouncedRunner } from '../lib/autoSave'
import { createWikiCompletionSource } from '../lib/wikiCompletion'
import { livePreviewStateField } from '../lib/livePreviewExtension'
import { MarkdownPreview } from '../components/notes/MarkdownPreview'
import { useUIStore } from '../lib/uiStore'

type Note = {
  id: string
  title: string
  content: string
  links: string[]
  updatedAt: string
}

type Search = {
  note?: string
  noteTitle?: string
}

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): Search => ({
    note: typeof search.note === 'string' ? search.note : undefined,
    noteTitle:
      typeof search.noteTitle === 'string' ? search.noteTitle : undefined,
  }),
  component: App,
})

function App() {
  const [notes, setNotes] = useState<Note[]>([])
  const [activeNote, setActiveNote] = useState<Note | null>(null)
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
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

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

    const data = (await response.json()) as Note[]
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

    const note = (await response.json()) as Note
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

    // Capture the response to get the updated note (backend may re-extract title from markdown)
    let updatedNote: Note | null = null
    try {
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        updatedNote = (await response.json()) as Note
      }
    } catch {
      // If response parsing fails, continue with local state
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

    const printInCurrentTab = () => {
      const existingRoot = document.getElementById('pdf-export-inline-root')
      const existingStyle = document.getElementById('pdf-export-inline-style')
      existingRoot?.remove()
      existingStyle?.remove()

      const style = document.createElement('style')
      style.id = 'pdf-export-inline-style'
      style.textContent = `
        @media print {
          body * {
            visibility: hidden !important;
          }

          #pdf-export-inline-root,
          #pdf-export-inline-root * {
            visibility: visible !important;
          }

          #pdf-export-inline-root {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 36px;
          }
        }
      `

      const root = document.createElement('main')
      root.id = 'pdf-export-inline-root'
      root.className = 'prose prose-slate dark:prose-invert max-w-none'
      root.innerHTML = previewRoot.innerHTML

      document.head.append(style)
      document.body.append(root)

      const cleanup = () => {
        root.remove()
        style.remove()
      }

      window.addEventListener('afterprint', cleanup, { once: true })
      window.print()
      setTimeout(cleanup, 1500)
    }

    const popup = window.open('', '_blank', 'noopener,noreferrer')
    if (!popup) {
      printInCurrentTab()
      setStatus('Popup blocked. Opened print dialog in current tab.')
      return
    }

    const rootClassName = document.documentElement.className
    const title = activeNote?.title?.trim() || 'Note'
    const exportDocument = popup.document

    exportDocument.documentElement.className = rootClassName
    exportDocument.head.replaceChildren()
    exportDocument.body.replaceChildren()

    const charsetMeta = exportDocument.createElement('meta')
    charsetMeta.setAttribute('charset', 'utf-8')

    const viewportMeta = exportDocument.createElement('meta')
    viewportMeta.setAttribute('name', 'viewport')
    viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1')

    const titleElement = exportDocument.createElement('title')
    titleElement.textContent = title

    exportDocument.head.append(charsetMeta, viewportMeta, titleElement)

    for (const node of document.querySelectorAll(
      'link[rel="stylesheet"], style',
    )) {
      exportDocument.head.append(node.cloneNode(true))
    }

    const exportStyle = exportDocument.createElement('style')
    exportStyle.textContent = `
      body {
        margin: 36px;
      }

      .pdf-export-actions {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 16px;
      }

      .pdf-export-btn {
        border: 1px solid #999;
        border-radius: 8px;
        background: #fff;
        font: 600 14px/1.2 system-ui, sans-serif;
        padding: 8px 12px;
        cursor: pointer;
      }

      .pdf-export-wrap {
        max-width: 960px;
        margin: 0 auto;
      }

      @media print {
        .pdf-export-actions {
          display: none;
        }
      }
    `
    exportDocument.head.append(exportStyle)

    const actions = exportDocument.createElement('div')
    actions.className = 'pdf-export-actions'

    const printButton = exportDocument.createElement('button')
    printButton.className = 'pdf-export-btn'
    printButton.type = 'button'
    printButton.textContent = 'Print / Save as PDF'
    printButton.addEventListener('click', () => {
      popup.focus()
      popup.print()
    })
    actions.append(printButton)
    exportDocument.body.append(actions)

    const main = exportDocument.createElement('main')
    main.className = 'pdf-export-wrap'
    main.innerHTML = previewRoot.innerHTML
    exportDocument.body.append(main)

    exportDocument.close()

    // Try immediate print while still in the user's click gesture.
    popup.focus()
    popup.print()

    // Fallback: try again after next paint if the browser ignored the first call.
    const runPrint = () => {
      popup.focus()
      popup.print()
    }
    if (typeof popup.requestAnimationFrame === 'function') {
      popup.requestAnimationFrame(runPrint)
    } else {
      setTimeout(runPrint, 120)
    }

    setStatus(
      'Export opened. If print does not start, click Print / Save as PDF in the new tab.',
    )
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

  return (
    <section className="rise-in" data-testid="workspace-editor-shell">
      <section className="page-wrap">
        <section
          className={`glass editor-panel ${isReadOnly ? 'editor-panel-readonly' : ''}`}
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="panel-title">Editor</h2>
            <div className="flex items-center gap-2">
              <span className="status-line m-0">
                {isReadOnly
                  ? 'Read-only mode'
                  : isAutoSaving
                    ? 'Autosave in 500ms...'
                    : 'Autosave enabled'}
              </span>
              {!isReadOnly && (
                <button
                  className="action-btn"
                  type="button"
                  onClick={saveCurrentNote}
                >
                  Save
                </button>
              )}
              {isReadOnly && (
                <button
                  className="action-btn"
                  type="button"
                  onClick={exportPreviewToPDF}
                >
                  Export PDF
                </button>
              )}
              <button
                className={`action-btn ${isReadOnly ? 'action-btn-readonly-active' : ''}`}
                type="button"
                title={
                  isReadOnly ? 'Exit read-only mode' : 'Enter read-only mode'
                }
                onClick={() => setIsReadOnly(!isReadOnly)}
              >
                {isReadOnly ? '👁️' : '✎'}
              </button>
            </div>
          </div>
          {isReadOnly ? (
            <div
              className="editor-wrap editor-wrap-preview"
              ref={previewContainerRef}
            >
              <MarkdownPreview markdown={draft} />
            </div>
          ) : (
            <div className="editor-wrap">
              <CodeMirror
                className="editor-cm"
                value={draft}
                height="64vh"
                extensions={editorExtensions}
                basicSetup={{
                  lineNumbers: false,
                  foldGutter: false,
                  highlightActiveLine: false,
                }}
                onChange={(value) => {
                  if (!isReadOnly) {
                    setDraft(value)
                  }
                }}
                placeholder="Write markdown... Type [[ to link notes"
                readOnly={isReadOnly}
              />
            </div>
          )}
        </section>
      </section>
    </section>
  )
}

function resolveNoteIDFromSearch(notes: Note[], search: Search): string {
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
