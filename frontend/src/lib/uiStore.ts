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

type UIState = {
  status: string
  setStatus: (status: string) => void
  workspaceSidebar: WorkspaceSidebarState | null
  setWorkspaceSidebar: (sidebar: WorkspaceSidebarState) => void
  clearWorkspaceSidebar: () => void
}

export const useUIStore = create<UIState>((set) => ({
  status: 'Loading notes...',
  setStatus: (status) => set({ status }),
  workspaceSidebar: null,
  setWorkspaceSidebar: (workspaceSidebar) => set({ workspaceSidebar }),
  clearWorkspaceSidebar: () => set({ workspaceSidebar: null }),
}))
