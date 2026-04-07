import { describe, expect, it } from 'vitest'
import { extractWikiLinks, toMarkdownLinks } from './wikiLinks'

describe('wiki links', () => {
  it('extracts links and normalizes slugs', () => {
    const links = extractWikiLinks('Review [[Linear Algebra]] and [[limits]].')

    expect(links).toEqual(['linear-algebra', 'limits'])
  })

  it('converts wiki links into markdown links', () => {
    const content = 'See [[Linear Algebra]] for details.'

    expect(toMarkdownLinks(content)).toBe(
      'See [Linear Algebra](/?note=linear-algebra) for details.',
    )
  })
})
