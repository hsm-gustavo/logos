import { queryOptions } from '@tanstack/react-query'

export type QueryWorkspaceNote = {
  id: string
  title: string
  content: string
  links: string[]
  folderId?: string
  state?: string
  updatedAt: string
}

export type QueryWorkspaceFolder = {
  id: string
  name: string
  updatedAt: string
}

export type QueryWorkspaceSearchResult = {
  note: {
    id: string
    title: string
    state?: string
  }
  score: number
  matchSource: 'title' | 'content' | 'both'
}

export function notesListQueryOptions() {
  return queryOptions({
    queryKey: ['notes'] as const,
    queryFn: async (): Promise<QueryWorkspaceNote[]> => {
      const response = await fetch('/api/notes')
      if (!response.ok) {
        throw new Error('Failed to list notes')
      }
      return (await response.json()) as QueryWorkspaceNote[]
    },
  })
}

export function noteByIdQueryOptions(noteID: string) {
  return queryOptions({
    queryKey: ['notes', noteID] as const,
    queryFn: async (): Promise<QueryWorkspaceNote> => {
      const response = await fetch(`/api/notes/${noteID}`)
      if (!response.ok) {
        throw new Error('Failed to read note')
      }
      return (await response.json()) as QueryWorkspaceNote
    },
  })
}

export function searchNotesQueryOptions(query: string) {
  return queryOptions({
    queryKey: ['search', query] as const,
    queryFn: async (): Promise<QueryWorkspaceSearchResult[]> => {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
      if (!response.ok) {
        throw new Error('Failed to search notes')
      }
      return (await response.json()) as QueryWorkspaceSearchResult[]
    },
  })
}

export function foldersListQueryOptions() {
  return queryOptions({
    queryKey: ['folders'] as const,
    queryFn: async (): Promise<QueryWorkspaceFolder[]> => {
      const response = await fetch('/api/folders')
      if (!response.ok) {
        throw new Error('Failed to list folders')
      }
      return (await response.json()) as QueryWorkspaceFolder[]
    },
  })
}
