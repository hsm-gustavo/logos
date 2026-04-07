import { StateField, RangeSetBuilder } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  WidgetType,
} from '@codemirror/view'
import {
  collectPreviewBlocks,
  computeLineModes,
  renderPreviewBlock,
  renderPreviewLine,
} from './livePreview'

class PreviewLineWidget extends WidgetType {
  constructor(
    private readonly html: string,
    private readonly className: string,
  ) {
    super()
  }

  ignoreEvent() {
    return false
  }

  toDOM() {
    const wrap = document.createElement(
      this.className.includes('cm-live-preview-block') ? 'div' : 'span',
    )
    wrap.className = this.className
    wrap.innerHTML = this.html
    return wrap
  }
}

function buildDecorations(state: any): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const docString = state.doc.toString()
  const activeLineNum = state.doc.lineAt(state.selection.main.head).number

  const modes = computeLineModes(docString, activeLineNum)
  const blocks = collectPreviewBlocks(docString, activeLineNum)

  let i = 0
  while (i < modes.length) {
    const lineNum = i + 1
    const block = blocks.find((b) => b.fromLine === lineNum)

    if (block) {
      const from = state.doc.line(block.fromLine).from
      const to = state.doc.line(block.toLine).to
      const rawBlock = state.doc.sliceString(from, to)
      const rendered = renderPreviewBlock(rawBlock)

      builder.add(
        from,
        to,
        Decoration.replace({
          widget: new PreviewLineWidget(rendered.html, rendered.className),
          inclusive: true,
          block: true,
        }),
      )
      i = block.toLine // Skip lines inside the block
      continue
    }

    if (modes[i] === 'preview') {
      const line = state.doc.line(lineNum)
      const preview = renderPreviewLine(line.text)

      builder.add(
        line.from,
        line.to,
        Decoration.replace({
          widget: new PreviewLineWidget(preview.html, preview.className),
          block: false,
          inclusive: true,
        }),
      )
    }
    i++
  }

  return builder.finish()
}

const clickHandler = EditorView.domEventHandlers({
  mousedown(event, view) {
    const target = event.target as HTMLElement
    const previewEl = target.closest(
      '.cm-live-preview-line, .cm-live-preview-block',
    )

    if (previewEl) {
      const pos = view.posAtDOM(previewEl)
      view.dispatch({
        selection: { anchor: pos, head: pos },
        scrollIntoView: true,
      })
      return true
    }
  },
})

// 1. Define the StateField
export const livePreviewStateField = StateField.define<DecorationSet>({
  create(state) {
    return buildDecorations(state)
  },
  update(value, tr) {
    // Only re-calculate if the doc or selection (cursor) changes
    if (tr.docChanged || tr.selection) {
      return buildDecorations(tr.state)
    }
    return value.map(tr.changes)
  },
  provide: (f) => [EditorView.decorations.from(f), clickHandler],
})
