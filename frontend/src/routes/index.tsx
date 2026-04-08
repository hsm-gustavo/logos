import { createFileRoute } from '@tanstack/react-router'
import { WorkspaceEditorPanel } from '../components/workspace/WorkspaceEditorPanel'
import {
  type WorkspaceSearch,
  useWorkspaceRoute,
} from '../lib/useWorkspaceRoute'

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): WorkspaceSearch => ({
    note: typeof search.note === 'string' ? search.note : undefined,
    noteTitle:
      typeof search.noteTitle === 'string' ? search.noteTitle : undefined,
  }),
  component: App,
})

function App() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const {
    draft,
    editorExtensions,
    exportPreviewToPDF,
    isAutoSaving,
    isReadOnly,
    previewContainerRef,
    saveCurrentNote,
    setDraft,
    setIsReadOnly,
  } = useWorkspaceRoute({ search, navigate })

  return (
    <section className="rise-in" data-testid="workspace-editor-shell">
      <section className="page-wrap">
        <WorkspaceEditorPanel
          draft={draft}
          editorExtensions={editorExtensions}
          isAutoSaving={isAutoSaving}
          isReadOnly={isReadOnly}
          previewContainerRef={previewContainerRef}
          onDraftChange={(value) => {
            if (!isReadOnly) {
              setDraft(value)
            }
          }}
          onSave={saveCurrentNote}
          onToggleReadOnly={() => setIsReadOnly(!isReadOnly)}
          onExportPreview={exportPreviewToPDF}
        />
      </section>
    </section>
  )
}
