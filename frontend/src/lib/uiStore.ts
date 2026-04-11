import { create } from 'zustand'

type SidebarNote = {
  id: string
  title: string
  linksCount: number
}

type WorkspaceSidebarState = {
  notes: SidebarNote[]
  selectedId?: string
  collapsed: boolean
  canCreate: boolean
  statusText: string
  onCreate?: () => void
  onSelect: (noteId: string) => void
  onToggleCollapse: () => void
  onSearch?: () => void
  onConfig?: () => void
}

type SearchResultNote = {
  id: string
  title: string
  state?: string
}

type SearchResultItem = {
  note: SearchResultNote
  score: number
  matchSource: 'title' | 'content' | 'both'
}

type WorkspaceSearchState = {
  isOpen: boolean
  query: string
  isLoading: boolean
  error: string | null
  results: SearchResultItem[]
}

type UIState = {
  status: string
  setStatus: (status: string) => void
  workspaceSidebar: WorkspaceSidebarState | null
  setWorkspaceSidebar: (sidebar: WorkspaceSidebarState) => void
  clearWorkspaceSidebar: () => void
  workspaceSearch: WorkspaceSearchState
  setWorkspaceSearch: (
    search:
      | WorkspaceSearchState
      | ((current: WorkspaceSearchState) => WorkspaceSearchState),
  ) => void
  clearWorkspaceSearch: () => void
}

export const useUIStore = create<UIState>((set) => ({
  status: 'Loading notes...',
  setStatus: (status) => set({ status }),
  workspaceSidebar: null,
  setWorkspaceSidebar: (workspaceSidebar) => set({ workspaceSidebar }),
  clearWorkspaceSidebar: () => set({ workspaceSidebar: null }),
  workspaceSearch: {
    isOpen: false,
    query: '',
    isLoading: false,
    error: null,
    results: [],
  },
  setWorkspaceSearch: (workspaceSearch) =>
    set((state) => ({
      workspaceSearch:
        typeof workspaceSearch === 'function'
          ? workspaceSearch(state.workspaceSearch)
          : workspaceSearch,
    })),
  clearWorkspaceSearch: () =>
    set({
      workspaceSearch: {
        isOpen: false,
        query: '',
        isLoading: false,
        error: null,
        results: [],
      },
    }),
}))
