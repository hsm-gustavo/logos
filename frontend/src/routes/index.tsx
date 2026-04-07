import { useEffect, useMemo, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { autocompletion } from '@codemirror/autocomplete'
import { markdown } from '@codemirror/lang-markdown'
import { EditorView } from '@codemirror/view'
import { createFileRoute } from '@tanstack/react-router'
import { MarkdownPreview } from '../components/notes/MarkdownPreview'
import { createNoteID } from '../lib/noteId'
import { createDebouncedRunner } from '../lib/autoSave'
import { createWikiCompletionSource } from '../lib/wikiCompletion'

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
  const [status, setStatus] = useState('Loading notes...')
  const autoSaveRunnerRef = useRef(createDebouncedRunner(500))
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  const editorExtensions = useMemo(() => {
    const titles = notes.map((note) => note.title)
    return [
      markdown(),
      EditorView.lineWrapping,
      autocompletion({
        override: [createWikiCompletionSource(titles)],
      }),
    ]
  }, [notes])

  const selectedNoteId = useMemo(() => {
    return resolveNoteIDFromSearch(notes, search)
  }, [notes, search])

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
    if (!activeNote) {
      return
    }

    if (draft === activeNote.content) {
      return
    }

    setIsAutoSaving(true)
    autoSaveRunnerRef.current.schedule(() => {
      void persistNote(activeNote.id, activeNote.title, draft, true)
    })
  }, [activeNote, draft])

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

    setActiveNote((current) =>
      current && current.id === noteID ? { ...current, content } : current,
    )
    setNotes((current) =>
      current.map((note) =>
        note.id === noteID
          ? {
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
    <main className="page-wrap pb-10 pt-8">
      <section className="panel-grid rise-in">
        <aside className="glass note-list-panel">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="panel-title">Notes</h2>
            <button className="action-btn" type="button" onClick={createNote}>
              New
            </button>
          </div>
          <p className="status-line">{status}</p>
          <ul className="note-list">
            {notes.map((note) => (
              <li key={note.id}>
                <button
                  type="button"
                  className={
                    note.id === activeNote?.id
                      ? 'note-item note-item-active'
                      : 'note-item'
                  }
                  onClick={async () => {
                    await navigate({ search: { note: note.id } })
                    await openNote(note.id)
                  }}
                >
                  <span className="note-item-title">{note.title}</span>
                  <span className="note-item-meta">
                    {note.links.length} links
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="glass editor-panel">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="panel-title">Editor</h2>
            <div className="flex items-center gap-2">
              <span className="status-line m-0">
                {isAutoSaving ? 'Autosave in 500ms...' : 'Autosave enabled'}
              </span>
              <button
                className="action-btn"
                type="button"
                onClick={saveCurrentNote}
              >
                Save
              </button>
            </div>
          </div>
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
                setDraft(value)
              }}
              placeholder="Write markdown... Type [[ to link notes"
            />
          </div>
        </section>

        <section className="glass preview-panel">
          <h2 className="panel-title mb-3">Preview</h2>
          <MarkdownPreview markdown={draft} />
        </section>
      </section>
    </main>
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
