import katex from 'katex'

export type LineMode = 'source' | 'preview'

export type PreviewLineRender = {
  html: string
  className: string
}

export function computeLineModes(
  markdown: string,
  activeLineNumber: number,
): LineMode[] {
  const lines = markdown.split('\n')
  const modes: LineMode[] = []
  let insideFence = false

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ''
    const lineNumber = index + 1
    const trimmed = line.trim()
    const isFence = trimmed.startsWith('```')

    if (
      isFence ||
      insideFence ||
      lineNumber === activeLineNumber ||
      trimmed === ''
    ) {
      modes.push('source')
    } else {
      modes.push('preview')
    }

    if (isFence) {
      insideFence = !insideFence
    }
  }

  return modes
}

export function renderPreviewText(line: string): string {
  return renderPreviewLine(line).html.replace(/<[^>]+>/g, '')
}

export function renderPreviewLine(line: string): PreviewLineRender {
  const headingMatch = line.match(/^(\s{0,3})(#{1,6})\s+(.*)$/)
  const trimmed = line.trim()

  if (
    trimmed.startsWith('$$') &&
    trimmed.endsWith('$$') &&
    trimmed.length > 4
  ) {
    const expression = trimmed.slice(2, -2).trim()
    return {
      html: katex.renderToString(expression, {
        displayMode: true,
        throwOnError: false,
      }),
      className: 'cm-live-preview-line cm-live-preview-math-display',
    }
  }

  const content = headingMatch ? (headingMatch[3] ?? '') : line
  const classNames = ['cm-live-preview-line']

  if (headingMatch) {
    const level = headingMatch[2]?.length ?? 1
    classNames.push(`cm-live-preview-heading-${level}`)
  }

  const html = renderInlineHTML(content)
  return {
    html,
    className: classNames.join(' '),
  }
}

function renderInlineHTML(input: string): string {
  const mathTokens: string[] = []

  let output = input.replace(/(?<!\\)\$(.+?)(?<!\\)\$/g, (_, expr: string) => {
    const token = `@@MATH${mathTokens.length}@@`
    mathTokens.push(
      katex.renderToString(expr, {
        displayMode: false,
        throwOnError: false,
      }),
    )
    return token
  })

  output = output.replace(/^\s*[-*+]\s+/, '• ')
  output = output.replace(/^\s*\d+\.\s+/, '')
  output = output.replace(/^\s*>\s+/, '')
  output = output.replace(/\*\*(.*?)\*\*/g, '$1')
  output = output.replace(/__(.*?)__/g, '$1')
  output = output.replace(/\*(.*?)\*/g, '$1')
  output = output.replace(/_(.*?)_/g, '$1')
  output = output.replace(/`([^`]+)`/g, '$1')
  output = output.replace(/\[\[([^\]]+)\]\]/g, '$1')

  const escaped = escapeHTML(output)
  return escaped.replace(/@@MATH(\d+)@@/g, (_, index: string) => {
    return mathTokens[Number(index)] ?? ''
  })
}

function escapeHTML(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
