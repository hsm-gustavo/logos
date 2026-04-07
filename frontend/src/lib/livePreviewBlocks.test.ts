import { describe, expect, it } from 'vitest'
import { collectPreviewBlocks, computeLineModes } from './livePreview'

describe('livePreview blocks', () => {
  it('collects fenced code and display math blocks when cursor is outside', () => {
    const markdown = [
      '# Note',
      '```go',
      'package main',
      '```',
      '$$',
      'x = y^2',
      '$$',
    ].join('\n')

    const blocks = collectPreviewBlocks(markdown, 1)

    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toMatchObject({
      fromLine: 2,
      toLine: 4,
      kind: 'code',
      language: 'go',
    })
    expect(blocks[1]).toMatchObject({
      fromLine: 5,
      toLine: 7,
      kind: 'math',
    })
  })

  it('does not collect block that contains active cursor line', () => {
    const markdown = ['```go', 'package main', '```', 'tail'].join('\n')

    const outside = collectPreviewBlocks(markdown, 4)
    const inside = collectPreviewBlocks(markdown, 2)

    expect(outside).toHaveLength(1)
    expect(inside).toHaveLength(0)
  })

  it('keeps $$ fence lines as source in line modes', () => {
    const markdown = ['before', '$$', 'x = y^2', '$$', 'after'].join('\n')

    const modes = computeLineModes(markdown, 5)

    expect(modes).toEqual(['preview', 'source', 'source', 'source', 'source'])
  })
})
