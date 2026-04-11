import { create } from 'zustand'

type SidebarNote = {
  id: string
  title: string
  linksCount: number
}

type SidebarSection = {
  id: string
  label: string
  kind: 'folder' | 'unfiled' | 'archived'
  expanded: boolean
  notes: SidebarNote[]
}

type WorkspaceSidebarState = {
  sections: SidebarSection[]
  selectedId?: string
  collapsed: boolean
  canCreate: boolean
  canCreateFolder: boolean
  statusText: string
  onCreate?: () => void
  onCreateFolder?: () => void
  onSelect: (noteId: string) => void
  onMoveNoteToFolder?: (noteId: string, folderId: string) => void
  onToggleSection: (sectionId: string) => void
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
  sidebarSectionsExpanded: Record<string, boolean>
  setSidebarSectionExpanded: (sectionId: string, expanded: boolean) => void
  toggleSidebarSectionExpanded: (sectionId: string) => void
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
  sidebarSectionsExpanded: {},
  setSidebarSectionExpanded: (sectionId, expanded) =>
    set((state) => ({
      sidebarSectionsExpanded: {
        ...state.sidebarSectionsExpanded,
        [sectionId]: expanded,
      },
    })),
  toggleSidebarSectionExpanded: (sectionId) =>
    set((state) => ({
      sidebarSectionsExpanded: {
        ...state.sidebarSectionsExpanded,
        [sectionId]: !(state.sidebarSectionsExpanded[sectionId] ?? true),
      },
    })),
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
