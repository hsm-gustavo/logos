import { describe, expect, it } from 'vitest'
import { computeLineModes, renderPreviewLine } from './livePreview'

describe('live preview line modes', () => {
  it('keeps active line as source and previous line as preview', () => {
    const markdown = '# Title\nSecond line'

    const modes = computeLineModes(markdown, 2)

    expect(modes).toEqual(['preview', 'source'])
  })

  it('keeps blank lines as source', () => {
    const markdown = '# Title\n\nParagraph'

    const modes = computeLineModes(markdown, 3)

    expect(modes).toEqual(['preview', 'source', 'source'])
  })

  it('keeps fenced code block lines as source', () => {
    const markdown = '```ts\nconst n = 1\n```\nAfter'

    const modes = computeLineModes(markdown, 4)

    expect(modes).toEqual(['source', 'source', 'source', 'source'])
  })

  it('adds heading classes for heading lines', () => {
    const rendered = renderPreviewLine('# Big Title')

    expect(rendered.className).toContain('cm-live-preview-heading-1')
    expect(rendered.html).toContain('Big Title')
  })

  it('renders katex markup for inline math', () => {
    const rendered = renderPreviewLine('Energy $E = mc^2$')

    expect(rendered.html).toContain('katex')
    expect(rendered.html).toContain('mc')
  })
})
