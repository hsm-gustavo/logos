import { useEffect, useRef } from 'react'
import { Link } from '@tanstack/react-router'

type SearchResultNote = {
  id: string
  title: string
  state?: string
}

export type SearchResultItem = {
  note: SearchResultNote
  score: number
  matchSource: 'title' | 'content' | 'both'
}

type SearchModalProps = {
  isOpen: boolean
  query: string
  isLoading: boolean
  error: string | null
  results: SearchResultItem[]
  onClose: () => void
  onQueryChange: (value: string) => void
  onResultSelect: () => void
}

export function SearchModal({
  isOpen,
  query,
  isLoading,
  error,
  results,
  onClose,
  onQueryChange,
  onResultSelect,
}: SearchModalProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    inputRef.current?.focus()
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  return (
    <div
      className="search-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Search notes"
      onClick={onClose}
    >
      <div
        className="search-modal glass"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="search-modal-header">
          <h2 className="panel-title">Search Notes</h2>
          <button
            type="button"
            className="action-btn"
            aria-label="Close search"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <label htmlFor="search-notes-input" className="status-line">
          Type to search by title and content
        </label>
        <input
          id="search-notes-input"
          ref={inputRef}
          className="search-modal-input"
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.currentTarget.value)}
          placeholder="Search notes..."
          aria-label="Search notes input"
        />

        <section className="search-modal-results" aria-live="polite">
          {query.trim() === '' ? (
            <p className="status-line">Start typing to search your notes.</p>
          ) : isLoading ? (
            <div className="search-skeleton-list" aria-label="Searching notes">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="search-skeleton-row"
                  data-testid="search-skeleton-row"
                />
              ))}
            </div>
          ) : error ? (
            <p className="status-line">{error}</p>
          ) : results.length === 0 ? (
            <p className="status-line">No notes found.</p>
          ) : (
            <ul className="note-list">
              {results.map((result) => (
                <li key={result.note.id}>
                  <Link
                    to="/"
                    search={{
                      note: result.note.id,
                      noteTitle: result.note.title,
                    }}
                    className="note-item"
                    onClick={onResultSelect}
                  >
                    <span className="note-item-title">{result.note.title}</span>
                    <span className="note-item-meta">
                      {result.matchSource}
                      {result.note.state === 'archived' ? ' • archived' : ''}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
