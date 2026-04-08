import { Outlet, createRootRoute, useRouterState } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import Sidebar from '../components/Sidebar'
import { useUIStore } from '../lib/uiStore'

import '../styles.css'
import { ThemeProvider } from '#/components/ThemeProvider'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const workspaceSidebar = useUIStore((state) => state.workspaceSidebar)
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
              notes={workspaceSidebar.notes}
              selectedId={workspaceSidebar.selectedId}
              collapsed={workspaceSidebar.collapsed}
              canCreate={workspaceSidebar.canCreate}
              statusText={workspaceSidebar.statusText}
              onCreate={workspaceSidebar.onCreate}
              onSelect={workspaceSidebar.onSelect}
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
