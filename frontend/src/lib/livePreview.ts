import katex from 'katex'
import hljs from 'highlight.js'

export type LineMode = 'source' | 'preview'

export type PreviewLineRender = {
  html: string
  className: string
}

export type PreviewBlockRender = {
  html: string
  className: string
}

export type PreviewBlockSpan = {
  fromLine: number
  toLine: number
  kind: 'code' | 'math' | 'table'
  content: string
  language?: string
}

export function computeLineModes(
  markdown: string,
  activeLineNumber: number,
): LineMode[] {
  const lines = markdown.split('\n')
  const tableLineNumbers = collectTableLineNumbers(lines)
  const modes: LineMode[] = []
  let insideFence = false

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ''
    const lineNumber = index + 1
    const trimmed = line.trim()
    const isCodeFence = trimmed.startsWith('```')
    const isMathFence = trimmed === '$$'
    const isFence = isCodeFence || isMathFence

    if (
      isFence ||
      insideFence ||
      tableLineNumbers.has(lineNumber) ||
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

export function collectPreviewBlocks(
  markdown: string,
  activeLineNumber: number,
): PreviewBlockSpan[] {
  const lines = markdown.split('\n')
  const blocks: PreviewBlockSpan[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ''
    const trimmed = line.trim()

    if (trimmed.startsWith('```')) {
      const startLine = index + 1
      const language = trimmed.slice(3).trim() || undefined
      const closingIndex = findClosingFence(lines, index + 1, '```')
      if (closingIndex < 0) {
        continue
      }

      const endLine = closingIndex + 1
      if (activeLineNumber >= startLine && activeLineNumber <= endLine) {
        index = closingIndex
        continue
      }

      const content = lines.slice(index + 1, closingIndex).join('\n')
      blocks.push({
        fromLine: startLine,
        toLine: endLine,
        kind: 'code',
        content,
        language,
      })
      index = closingIndex
      continue
    }

    if (trimmed === '$$') {
      const startLine = index + 1
      const closingIndex = findClosingFence(lines, index + 1, '$$')
      if (closingIndex < 0) {
        continue
      }

      const endLine = closingIndex + 1
      if (activeLineNumber >= startLine && activeLineNumber <= endLine) {
        index = closingIndex
        continue
      }

      const content = lines.slice(index + 1, closingIndex).join('\n')
      blocks.push({
        fromLine: startLine,
        toLine: endLine,
        kind: 'math',
        content,
      })
      index = closingIndex
      continue
    }

    const tableBlock = detectTableBlock(lines, index)
    if (tableBlock) {
      if (
        activeLineNumber >= tableBlock.fromLine &&
        activeLineNumber <= tableBlock.toLine
      ) {
        index = tableBlock.toLine - 1
        continue
      }

      blocks.push({
        ...tableBlock,
        kind: 'table',
      })
      index = tableBlock.toLine - 1
    }
  }

  return blocks
}

export function renderPreviewBlock(block: string): PreviewBlockRender {
  const lines = block.split('\n')
  const firstLine = lines[0]?.trim() ?? ''
  const lastLine = lines[lines.length - 1]?.trim() ?? ''

  if (isMarkdownTableBlock(lines)) {
    return {
      html: renderMarkdownTable(block),
      className: 'cm-live-preview-block cm-live-preview-block-table',
    }
  }

  if (firstLine.startsWith('```') && lastLine.startsWith('```')) {
    const language = firstLine.slice(3).trim()
    const code = lines.slice(1, -1).join('\n')

    const highlighted = renderHighlightedCode(code, language)
    return {
      html: `<pre class="cm-live-preview-code"><code class="hljs ${language ? `language-${escapeHTML(language)}` : ''}">${highlighted}</code></pre>`,
      className: 'cm-live-preview-block cm-live-preview-block-code',
    }
  }

  if (firstLine === '$$' && lastLine === '$$') {
    const expression = lines.slice(1, -1).join('\n').trim()
    return {
      html: katex.renderToString(expression, {
        displayMode: true,
        throwOnError: false,
      }),
      className: 'cm-live-preview-block cm-live-preview-block-math',
    }
  }

  return {
    html: '',
    className: 'cm-live-preview-block',
  }
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
  output = output.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  output = output.replace(/__(.*?)__/g, '$1')
  output = output.replace(/\*(.*?)\*/g, '<em>$1</em>')
  output = output.replace(/_(.*?)_/g, '$1')
  output = output.replace(/`([^`]+)`/g, '<code>$1</code>')
  output = output.replace(/\[\[([^\]]+)\]\]/g, '$1')

  const escaped = escapeHTML(output)
  return escaped.replace(/@@MATH(\d+)@@/g, (_, index: string) => {
    return mathTokens[Number(index)] ?? ''
  })
}

function renderMarkdownTable(markdown: string): string {
  const lines = markdown
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (!isMarkdownTableBlock(lines)) {
    return ''
  }

  const headerCells = splitTableCells(lines[0] ?? '')
  const alignments = parseTableAlignments(lines[1] ?? '', headerCells.length)
  const bodyLines = lines.slice(2)

  const header = headerCells
    .map((cell, index) => {
      return `<th${getAlignmentStyleAttr(alignments[index])}>${renderInlineHTML(cell)}</th>`
    })
    .join('')

  const body = bodyLines
    .map((line) => {
      const cells = normalizeTableCells(
        splitTableCells(line),
        headerCells.length,
      )
      const cols = cells
        .map((cell, index) => {
          return `<td${getAlignmentStyleAttr(alignments[index])}>${renderInlineHTML(cell)}</td>`
        })
        .join('')
      return `<tr>${cols}</tr>`
    })
    .join('')

  return `<div class="cm-live-preview-table-wrap"><table class="cm-live-preview-table"><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></div>`
}

function isMarkdownTableBlock(lines: string[]): boolean {
  if (lines.length < 2) {
    return false
  }

  const headerLine = (lines[0] ?? '').trim()
  const separatorLine = (lines[1] ?? '').trim()

  return isTableHeaderLine(headerLine) && isTableSeparatorLine(separatorLine)
}

function collectTableLineNumbers(lines: string[]): Set<number> {
  const tableLines = new Set<number>()

  for (let index = 0; index < lines.length; index += 1) {
    const tableBlock = detectTableBlock(lines, index)
    if (!tableBlock) {
      continue
    }

    for (
      let lineNumber = tableBlock.fromLine;
      lineNumber <= tableBlock.toLine;
      lineNumber += 1
    ) {
      tableLines.add(lineNumber)
    }

    index = tableBlock.toLine - 1
  }

  return tableLines
}

function detectTableBlock(
  lines: string[],
  startIndex: number,
): {
  fromLine: number
  toLine: number
  content: string
} | null {
  const headerLine = (lines[startIndex] ?? '').trim()
  const separatorLine = (lines[startIndex + 1] ?? '').trim()

  if (!isTableHeaderLine(headerLine) || !isTableSeparatorLine(separatorLine)) {
    return null
  }

  let endIndexExclusive = startIndex + 2
  while (endIndexExclusive < lines.length) {
    const line = (lines[endIndexExclusive] ?? '').trim()
    if (!isTableDataLine(line)) {
      break
    }
    endIndexExclusive += 1
  }

  return {
    fromLine: startIndex + 1,
    toLine: endIndexExclusive,
    content: lines.slice(startIndex, endIndexExclusive).join('\n'),
  }
}

function isTableHeaderLine(line: string): boolean {
  return line.includes('|') && splitTableCells(line).length > 1
}

function isTableDataLine(line: string): boolean {
  return (
    line.length > 0 && line.includes('|') && splitTableCells(line).length > 1
  )
}

function isTableSeparatorLine(line: string): boolean {
  if (!line.includes('|')) {
    return false
  }

  const cells = splitTableCells(line)
  if (cells.length === 0) {
    return false
  }

  return cells.every((cell) => /^:?-{3,}:?$/.test(cell))
}

function splitTableCells(line: string): string[] {
  const normalized = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return normalized.split('|').map((cell) => cell.trim())
}

function normalizeTableCells(cells: string[], width: number): string[] {
  const normalized = cells.slice(0, width)
  while (normalized.length < width) {
    normalized.push('')
  }
  return normalized
}

function parseTableAlignments(
  separatorLine: string,
  width: number,
): Array<'left' | 'center' | 'right' | null> {
  const cells = normalizeTableCells(splitTableCells(separatorLine), width)

  return cells.map((cell) => {
    const startsWithColon = cell.startsWith(':')
    const endsWithColon = cell.endsWith(':')

    if (startsWithColon && endsWithColon) {
      return 'center'
    }

    if (endsWithColon) {
      return 'right'
    }

    if (startsWithColon) {
      return 'left'
    }

    return null
  })
}

function getAlignmentStyleAttr(
  alignment: 'left' | 'center' | 'right' | null | undefined,
): string {
  if (!alignment) {
    return ''
  }

  return ` style="text-align:${alignment}"`
}

function escapeHTML(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderHighlightedCode(code: string, language: string): string {
  try {
    if (language && hljs.getLanguage(language)) {
      return hljs.highlight(code, { language, ignoreIllegals: true }).value
    }

    return hljs.highlightAuto(code).value
  } catch {
    return escapeHTML(code)
  }
}

function findClosingFence(
  lines: string[],
  startIndex: number,
  fence: string,
): number {
  for (let index = startIndex; index < lines.length; index += 1) {
    if (lines[index]?.trim().startsWith(fence)) {
      return index
    }
  }

  return -1
}
