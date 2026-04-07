import { RangeSetBuilder } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  type ViewUpdate,
  ViewPlugin,
  WidgetType,
} from '@codemirror/view'
import { computeLineModes, renderPreviewLine } from './livePreview'

class PreviewLineWidget extends WidgetType {
  constructor(
    private readonly html: string,
    private readonly className: string,
  ) {
    super()
  }

  toDOM() {
    const wrap = document.createElement('span')
    wrap.className = this.className
    wrap.innerHTML = this.html
    return wrap
  }
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const doc = view.state.doc.toString()
  const active = view.state.doc.lineAt(view.state.selection.main.head).number
  const modes = computeLineModes(doc, active)

  for (let i = 0; i < modes.length; i += 1) {
    if (modes[i] !== 'preview') {
      continue
    }

    const line = view.state.doc.line(i + 1)
    const preview = renderPreviewLine(line.text)

    builder.add(
      line.from,
      line.to,
      Decoration.replace({
        widget: new PreviewLineWidget(preview.html, preview.className),
        inclusive: false,
      }),
    )
  }

  return builder.finish()
}

export const livePreviewExtension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildDecorations(update.view)
      }
    }
  },
  {
    decorations: (value) => value.decorations,
  },
)
