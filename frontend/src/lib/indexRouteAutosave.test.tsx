import { RouterProvider } from '@tanstack/react-router'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

vi.mock('../components/notes/MarkdownPreview', () => ({
  MarkdownPreview: ({ markdown }: { markdown: string }) => (
    <div data-testid="preview-mock">{markdown}</div>
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
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

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
  })

  it('collapses the notes sidebar and keeps Search/Config actions visible', async () => {
    const note = {
      id: 'n1',
      title: 'Note 1',
      content: '# Note 1\n\nBody',
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

        return new Response(null, { status: 404 })
      })

    vi.stubGlobal('fetch', fetchMock)

    const router = getRouter()
    render(<RouterProvider router={router} />)

    await screen.findByText('Note 1')

    const collapseButton = await screen.findByTitle('Collapse notes sidebar')
    fireEvent.click(collapseButton)

    expect(screen.queryByText('Note 1')).toBeNull()
    expect(screen.getByRole('button', { name: 'Search notes' })).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Sidebar settings' }),
    ).toBeTruthy()
  })

  it('renders sidebar outside editor shell and updates status from sidebar actions', async () => {
    const note = {
      id: 'n1',
      title: 'Note 1',
      content: '# Note 1\n\nBody',
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

        return new Response(null, { status: 404 })
      })

    vi.stubGlobal('fetch', fetchMock)

    const router = getRouter()
    render(<RouterProvider router={router} />)

    await screen.findByText('Note 1')

    const sidebar = screen.getByTestId('workspace-sidebar')
    const editorShell = screen.getByTestId('workspace-editor-shell')
    expect(editorShell.contains(sidebar)).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Search notes' }))
    expect(screen.getByText('Search is coming soon.')).toBeTruthy()
  })

  it('hides workspace sidebar on About route', async () => {
    const note = {
      id: 'n1',
      title: 'Note 1',
      content: '# Note 1\n\nBody',
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

        return new Response(null, { status: 404 })
      })

    vi.stubGlobal('fetch', fetchMock)

    const router = getRouter()
    render(<RouterProvider router={router} />)

    await screen.findByTestId('workspace-sidebar')
    await router.navigate({ to: '/about' })

    await screen.findByText('About Logos')
    expect(screen.queryByTestId('workspace-sidebar')).toBeNull()
  })

  it('exports read-only preview to PDF via print dialog', async () => {
    const note = {
      id: 'n1',
      title: 'Note 1',
      content: '# Note 1\n\nBody',
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

        return new Response(null, { status: 404 })
      })

    vi.stubGlobal('fetch', fetchMock)

    const printSpy = vi.fn()
    const closeSpy = vi.fn()
    const focusSpy = vi.fn()
    const popupDocument =
      document.implementation.createHTMLDocument('pdf-export')
    const documentCloseSpy = vi.spyOn(popupDocument, 'close')
    const openSpy = vi.fn().mockReturnValue({
      document: popupDocument,
      print: printSpy,
      close: closeSpy,
      focus: focusSpy,
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        callback(0)
        return 1
      },
      addEventListener: vi.fn(),
    })

    vi.stubGlobal('open', openSpy)

    const router = getRouter()
    await router.navigate({ to: '/' })
    render(<RouterProvider router={router} />)

    await screen.findByText('Note 1')

    fireEvent.click(screen.getByRole('button', { name: '✎' }))
    fireEvent.click(screen.getByRole('button', { name: 'Export PDF' }))

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalled()
      expect(documentCloseSpy).toHaveBeenCalled()
      expect(printSpy).toHaveBeenCalled()
      expect(popupDocument.title).toBe('Note 1')
    })
  })

  it('falls back to current-tab print when popup is blocked', async () => {
    const note = {
      id: 'n1',
      title: 'Note 1',
      content: '# Note 1\n\nBody',
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

        return new Response(null, { status: 404 })
      })

    vi.stubGlobal('fetch', fetchMock)

    const openSpy = vi.fn().mockReturnValue(null)
    const printSpy = vi.fn()

    vi.stubGlobal('open', openSpy)
    vi.stubGlobal('print', printSpy)

    const router = getRouter()
    await router.navigate({ to: '/' })
    render(<RouterProvider router={router} />)

    await screen.findByText('Note 1')

    fireEvent.click(screen.getByRole('button', { name: '✎' }))
    fireEvent.click(screen.getByRole('button', { name: 'Export PDF' }))

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalled()
      expect(printSpy).toHaveBeenCalled()
      expect(
        screen.getByText('Popup blocked. Opened print dialog in current tab.'),
      ).toBeTruthy()
    })
  })
})
