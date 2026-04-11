import { describe, expect, it, vi } from 'vitest'
import {
  foldersListQueryOptions,
  noteByIdQueryOptions,
  notesListQueryOptions,
  searchNotesQueryOptions,
} from './notesQueries'

describe('notesQueries', () => {
  it('builds notes list query options', async () => {
    const fetchMock = vi
      .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValue(
        new Response(
          JSON.stringify([
            { id: 'n1', title: 'A', content: '', links: [], updatedAt: '' },
          ]),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )

    vi.stubGlobal('fetch', fetchMock)

    const opts = notesListQueryOptions()
    expect(opts.queryKey).toEqual(['notes'])

    const data = await opts.queryFn({} as never)
    expect(data).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/notes')
  })

  it('builds note by id query options', async () => {
    const fetchMock = vi
      .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            id: 'n2',
            title: 'B',
            content: '',
            links: [],
            updatedAt: '',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )

    vi.stubGlobal('fetch', fetchMock)

    const opts = noteByIdQueryOptions('n2')
    expect(opts.queryKey).toEqual(['notes', 'n2'])

    const data = await opts.queryFn({} as never)
    expect(data.id).toBe('n2')
    expect(fetchMock).toHaveBeenCalledWith('/api/notes/n2')
  })

  it('builds search query options', async () => {
    const fetchMock = vi
      .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValue(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )

    vi.stubGlobal('fetch', fetchMock)

    const opts = searchNotesQueryOptions('linear algebra')
    expect(opts.queryKey).toEqual(['search', 'linear algebra'])

    await opts.queryFn({} as never)
    expect(fetchMock).toHaveBeenCalledWith('/api/search?q=linear%20algebra')
  })

  it('builds folders list query options', async () => {
    const fetchMock = vi
      .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValue(
        new Response(
          JSON.stringify([
            {
              id: 'math',
              name: 'Math',
              updatedAt: new Date().toISOString(),
            },
          ]),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )

    vi.stubGlobal('fetch', fetchMock)

    const opts = foldersListQueryOptions()
    expect(opts.queryKey).toEqual(['folders'])

    const data = await opts.queryFn({} as never)
    expect(data).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/folders')
  })
})
