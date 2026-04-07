import { RouterProvider } from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getRouter } from '../router'

vi.mock('@uiw/react-codemirror', () => ({
  default: (props: { value: string; onChange: (value: string) => void }) => (
    <textarea
      data-testid="cm-mock"
      value={props.value}
      onChange={(event) => props.onChange(event.currentTarget.value)}
    />
  ),
}))

vi.mock('@tanstack/react-devtools', () => ({
  TanStackDevtools: () => null,
}))

vi.mock('@tanstack/react-router-devtools', () => ({
  TanStackRouterDevtoolsPanel: () => null,
}))

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('index route autosave', () => {
  beforeEach(() => {
    vi.useRealTimers()

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: '(prefers-color-scheme: dark)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    Object.defineProperty(window, 'scrollTo', {
      writable: true,
      value: vi.fn(),
    })
  })

  it('auto-saves after 500ms debounce', async () => {
    const note = {
      id: 'n1',
      title: 'Note 1',
      content: '# Note 1\\n\\nBody',
      links: [],
      updatedAt: new Date().toISOString(),
    }

    const fetchMock = vi
      .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockImplementation(async (input, init) => {
        const url = String(input)
        const method = init?.method ?? 'GET'

        if (url === '/api/notes' && method === 'GET') {
          return jsonResponse([note])
        }

        if (url === '/api/notes/n1' && method === 'GET') {
          return jsonResponse(note)
        }

        if (url === '/api/notes/n1' && method === 'PUT') {
          const payload = JSON.parse(String(init?.body ?? '{}')) as {
            content?: string
          }
          note.content = payload.content ?? note.content
          return new Response(null, { status: 204 })
        }

        return new Response(null, { status: 404 })
      })

    vi.stubGlobal('fetch', fetchMock)

    const router = getRouter()
    render(<RouterProvider router={router} />)

    const editor = await screen.findByTestId('cm-mock')

    await waitFor(() => {
      expect((editor as HTMLTextAreaElement).value).toContain('# Note 1')
    })

    fireEvent.change(editor, {
      target: { value: '# Note 1\\n\\nUpdated body' },
    })

    await waitFor(
      () => {
        expect(
          fetchMock.mock.calls.some(
            ([url, init]) =>
              String(url) === '/api/notes/n1' && init?.method === 'PUT',
          ),
        ).toBe(true)
      },
      { timeout: 2500 },
    )

    vi.unstubAllGlobals()
  })
})
