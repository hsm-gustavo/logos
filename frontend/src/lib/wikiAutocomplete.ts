import Fuse from 'fuse.js'

export type WikiSuggestionContext = {
  query: string
  start: number
  end: number
}

export type WikiSuggestionApplyResult = {
  value: string
  cursor: number
}

export function findWikiSuggestionContext(
  value: string,
  cursor: number,
): WikiSuggestionContext | null {
  const beforeCursor = value.slice(0, cursor)
  const openIndex = beforeCursor.lastIndexOf('[[')
  if (openIndex < 0) {
    return null
  }

  const closedAfterOpen = beforeCursor.lastIndexOf(']]')
  if (closedAfterOpen > openIndex) {
    return null
  }

  const start = openIndex + 2
  const query = value.slice(start, cursor)
  if (query.includes(']') || query.includes('\n')) {
    return null
  }

  return {
    query,
    start,
    end: cursor,
  }
}

export function applyWikiSuggestion(
  value: string,
  context: WikiSuggestionContext,
  selectedTitle: string,
): WikiSuggestionApplyResult {
  const nextValue =
    value.slice(0, context.start) +
    selectedTitle +
    ']]' +
    value.slice(context.end)

  return {
    value: nextValue,
    cursor: context.start + selectedTitle.length + 2,
  }
}

export function searchWikiTitles(
  titles: string[],
  query: string,
  limit = 5,
): string[] {
  const cleanTitles = titles
    .map((title) => title.trim())
    .filter((title) => title.length > 0)

  if (cleanTitles.length === 0) {
    return []
  }

  if (query.trim() === '') {
    return cleanTitles.slice(0, limit)
  }

  const fuse = new Fuse(cleanTitles, {
    includeScore: true,
    threshold: 0.45,
  })

  return fuse
    .search(query)
    .filter((result) => (result.score ?? 1) <= 0.4)
    .slice(0, limit)
    .map((result) => result.item)
}
