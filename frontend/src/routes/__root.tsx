import {
  Outlet,
  createRootRouteWithContext,
  useRouterState,
} from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import Sidebar from '../components/Sidebar'
import { SearchModal } from '../components/search/SearchModal'
import { useUIStore } from '../lib/uiStore'

import '../styles.css'
import { ThemeProvider } from '#/components/ThemeProvider'

type RouterContext = {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
})

function RootComponent() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const workspaceSidebar = useUIStore((state) => state.workspaceSidebar)
  const workspaceSearch = useUIStore((state) => state.workspaceSearch)
  const setWorkspaceSearch = useUIStore((state) => state.setWorkspaceSearch)
  const isWorkspaceRoute = pathname === '/'

  return (
    <ThemeProvider>
      {isWorkspaceRoute ? (
        <div
          className={
            workspaceSidebar?.collapsed
              ? 'workspace-layout workspace-layout-collapsed'
              : 'workspace-layout'
          }
        >
          {workspaceSidebar && (
            <Sidebar
              sections={workspaceSidebar.sections}
              selectedId={workspaceSidebar.selectedId}
              collapsed={workspaceSidebar.collapsed}
              canCreate={workspaceSidebar.canCreate}
              canCreateFolder={workspaceSidebar.canCreateFolder}
              statusText={workspaceSidebar.statusText}
              onCreate={workspaceSidebar.onCreate}
              onCreateFolder={workspaceSidebar.onCreateFolder}
              onSelect={workspaceSidebar.onSelect}
              onMoveNoteToFolder={workspaceSidebar.onMoveNoteToFolder}
              onToggleSection={workspaceSidebar.onToggleSection}
              onToggleCollapse={workspaceSidebar.onToggleCollapse}
              onSearch={workspaceSidebar.onSearch}
              onConfig={workspaceSidebar.onConfig}
            />
          )}
          <main className="workspace-content pb-10 pt-8">
            <Outlet />
          </main>
        </div>
      ) : (
        <Outlet />
      )}
      <SearchModal
        isOpen={workspaceSearch.isOpen}
        query={workspaceSearch.query}
        isLoading={workspaceSearch.isLoading}
        error={workspaceSearch.error}
        results={workspaceSearch.results}
        onClose={() =>
          setWorkspaceSearch((current) => ({
            ...current,
            isOpen: false,
            query: '',
            results: [],
            error: null,
            isLoading: false,
          }))
        }
        onQueryChange={(value) =>
          setWorkspaceSearch((current) => ({
            ...current,
            query: value,
          }))
        }
        onResultSelect={() =>
          setWorkspaceSearch((current) => ({
            ...current,
            isOpen: false,
            query: '',
            results: [],
            error: null,
            isLoading: false,
          }))
        }
      />
      <TanStackDevtools
        config={{
          position: 'bottom-right',
        }}
        plugins={[
          {
            name: 'TanStack Router',
            render: <TanStackRouterDevtoolsPanel />,
          },
        ]}
      />
    </ThemeProvider>
  )
}
