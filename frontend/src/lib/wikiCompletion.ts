import type {
  Completion,
  CompletionContext,
  CompletionSource,
} from '@codemirror/autocomplete'
import {
  applyWikiSuggestion,
  findWikiSuggestionContext,
  searchWikiTitles,
} from './wikiAutocomplete'

export function createWikiCompletionSource(titles: string[]): CompletionSource {
  return (context: CompletionContext) => {
    const content = context.state.doc.toString()
    const suggestionCtx = findWikiSuggestionContext(content, context.pos)
    if (!suggestionCtx) {
      return null
    }

    const results = searchWikiTitles(titles, suggestionCtx.query)
    if (results.length === 0) {
      return null
    }

    const options: Completion[] = results.map((title) => ({
      label: title,
      type: 'text',
      apply(view, _completion, from, to) {
        const current = view.state.doc.toString()
        const next = applyWikiSuggestion(
          current,
          {
            query: current.slice(from, to),
            start: from,
            end: to,
          },
          title,
        )

        view.dispatch({
          changes: {
            from: 0,
            to: current.length,
            insert: next.value,
          },
          selection: {
            anchor: next.cursor,
          },
        })
      },
    }))

    return {
      from: suggestionCtx.start,
      to: suggestionCtx.end,
      options,
      validFor: /^[^\]\n]*$/,
    }
  }
}
