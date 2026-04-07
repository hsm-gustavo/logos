import { describe, expect, it } from 'vitest'
import { extractWikiLinks, toMarkdownLinks } from './wikiLinks'

describe('wiki links', () => {
  it('extracts links preserving targets', () => {
    const links = extractWikiLinks('Review [[Linear Algebra]] and [[limits]].')

    expect(links).toEqual(['Linear Algebra', 'limits'])
  })

  it('extracts links with special characters', () => {
    const links = extractWikiLinks(
      'Review [[Álgebra Linear]] and [[Cálculo I]].',
    )

    expect(links).toEqual(['Álgebra Linear', 'Cálculo I'])
  })

  it('converts wiki links into markdown links using encoded titles', () => {
    const content = 'See [[Linear Algebra]] for details.'

    expect(toMarkdownLinks(content)).toBe(
      'See [Linear Algebra](/?noteTitle=Linear%20Algebra) for details.',
    )
  })

  it('encodes special chars in wiki links', () => {
    const content = 'See [[Álgebra Linear]] for details.'

    expect(toMarkdownLinks(content)).toBe(
      'See [Álgebra Linear](/?noteTitle=%C3%81lgebra%20Linear) for details.',
    )
  })
})
