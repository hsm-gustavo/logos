import { Suspense, lazy, type RefObject } from 'react'
import type { Extension } from '@codemirror/state'
import CodeMirror from '@uiw/react-codemirror'
import { AiOutlineEdit } from 'react-icons/ai'
import { GoBook } from 'react-icons/go'
import { MdOutlinePrint } from 'react-icons/md'
import { IoSaveOutline } from 'react-icons/io5'

const MarkdownPreview = lazy(() =>
  import('../../components/notes/MarkdownPreview').then((module) => ({
    default: module.MarkdownPreview,
  })),
)

type WorkspaceEditorPanelProps = {
  draft: string
  editorExtensions: Extension[]
  isAutoSaving: boolean
  isReadOnly: boolean
  previewContainerRef: RefObject<HTMLDivElement | null>
  onDraftChange: (value: string) => void
  onSave: () => void
  onToggleReadOnly: () => void
  onExportPreview: () => void
}

export function WorkspaceEditorPanel({
  draft,
  editorExtensions,
  isAutoSaving,
  isReadOnly,
  previewContainerRef,
  onDraftChange,
  onSave,
  onToggleReadOnly,
  onExportPreview,
}: WorkspaceEditorPanelProps) {
  return (
    <section
      className={`glass editor-panel ${isReadOnly ? 'editor-panel-readonly' : ''}`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="panel-title">Editor</h2>
        <div className="flex items-center gap-2">
          <span className="status-line m-0 inline-flex items-center gap-1">
            {isReadOnly ? (
              'Read-only mode'
            ) : isAutoSaving ? (
              <>
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-t border-(--chip-line)" />
                Autosave in 500ms...
              </>
            ) : (
              'Autosave enabled'
            )}
          </span>
          {!isReadOnly && (
            <button className="action-btn" type="button" onClick={onSave}>
              <IoSaveOutline /> Save
            </button>
          )}
          {isReadOnly && (
            <button
              className="action-btn"
              type="button"
              onClick={onExportPreview}
            >
              <MdOutlinePrint /> Print / Save as PDF
            </button>
          )}
          <button
            className={`action-btn ${isReadOnly ? 'action-btn-readonly-active' : ''}`}
            type="button"
            aria-label={isReadOnly ? 'Edit' : '✎'}
            title={isReadOnly ? 'Exit read-only mode' : 'Enter read-only mode'}
            onClick={onToggleReadOnly}
          >
            {isReadOnly ? <AiOutlineEdit /> : <GoBook />}
            {isReadOnly ? 'Edit' : 'Read'}
          </button>
        </div>
      </div>
      {isReadOnly ? (
        <div
          className="editor-wrap editor-wrap-preview"
          ref={previewContainerRef}
        >
          <Suspense
            fallback={<div className="status-line">Loading preview...</div>}
          >
            <MarkdownPreview markdown={draft} />
          </Suspense>
        </div>
      ) : (
        <div className="editor-wrap">
          <CodeMirror
            className="editor-cm"
            value={draft}
            height="64vh"
            width="744px"
            extensions={editorExtensions}
            basicSetup={{
              lineNumbers: false,
              foldGutter: false,
              highlightActiveLine: false,
            }}
            onChange={onDraftChange}
            placeholder="Write markdown... Type [[ to link notes"
            readOnly={isReadOnly}
          />
        </div>
      )}
    </section>
  )
}
