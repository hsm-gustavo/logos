import { EditorSelection, EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { livePreviewStateField } from './livePreviewExtension'

function collectDecorationSpecs(
  state: EditorState,
): Array<Record<string, unknown>> {
  const specs: Array<Record<string, unknown>> = []
  const decorations = state.field(livePreviewStateField)

  decorations.between(0, state.doc.length, (_from, _to, value) => {
    specs.push((value.spec ?? {}) as Record<string, unknown>)
  })

  return specs
}

describe('livePreviewStateField', () => {
  it('creates block decorations for fenced code when cursor is outside block', () => {
    const doc = ['# Title', '```go', 'package main', '```', 'tail'].join('\n')

    const state = EditorState.create({
      doc,
      selection: EditorSelection.cursor(1),
      extensions: [livePreviewStateField],
    })

    const specs = collectDecorationSpecs(state)

    expect(specs.some((spec) => spec.block === true)).toBe(true)
  })

  it('removes block decoration when cursor enters block', () => {
    const doc = ['# Title', '```go', 'package main', '```', 'tail'].join('\n')

    const initial = EditorState.create({
      doc,
      selection: EditorSelection.cursor(1),
      extensions: [livePreviewStateField],
    })

    const insidePos = initial.doc.line(3).from
    const next = initial.update({
      selection: EditorSelection.cursor(insidePos),
    }).state

    const specs = collectDecorationSpecs(next)

    expect(specs.some((spec) => spec.block === true)).toBe(false)
  })
})
