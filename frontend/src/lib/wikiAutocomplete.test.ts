import { describe, expect, it } from 'vitest'
import {
  applyWikiSuggestion,
  findWikiSuggestionContext,
  searchWikiTitles,
} from './wikiAutocomplete'

describe('wiki autocomplete', () => {
  it('finds context when typing after [[', () => {
    const text = 'Read [[Alge'
    const ctx = findWikiSuggestionContext(text, text.length)

    expect(ctx).toEqual({ query: 'Alge', start: 7, end: 11 })
  })

  it('returns null when cursor is outside an open wiki link', () => {
    const text = 'Read [[Algebra]] and more text'
    const ctx = findWikiSuggestionContext(text, text.length)

    expect(ctx).toBeNull()
  })

  it('applies selected title and closes wikilink', () => {
    const text = 'Read [[Alge now'
    const ctx = findWikiSuggestionContext(text, 11)
    if (!ctx) {
      throw new Error('expected context')
    }

    const result = applyWikiSuggestion(text, ctx, 'Álgebra Linear')

    expect(result.value).toBe('Read [[Álgebra Linear]] now')
    expect(result.cursor).toBe('Read [[Álgebra Linear]]'.length)
  })

  it('returns fuzzy title matches', () => {
    const titles = ['Algebra Linear', 'Calculus I', 'Algorithms']

    expect(searchWikiTitles(titles, 'alg')).toEqual([
      'Algorithms',
      'Algebra Linear',
    ])
  })
})
