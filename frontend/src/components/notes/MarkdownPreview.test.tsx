import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MarkdownPreview } from './MarkdownPreview'

describe('MarkdownPreview', () => {
  it('renders markdown tables', () => {
    render(
      <MarkdownPreview
        markdown={[
          '| Name | Score |',
          '| --- | ---: |',
          '| Ana | 10 |',
          '| Bob | 8 |',
        ].join('\n')}
      />,
    )

    const table = screen.getByRole('table')
    expect(table).not.toBeNull()
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeTruthy()
    expect(screen.getByRole('cell', { name: 'Ana' })).toBeTruthy()
    expect(screen.getByRole('cell', { name: '10' })).toBeTruthy()
  })

  it('renders math formulas', () => {
    render(<MarkdownPreview markdown={'Inline math: $x^2$'} />)

    expect(document.querySelector('.katex')).not.toBeNull()
  })

  it('renders highlighted code blocks', () => {
    render(
      <MarkdownPreview markdown={'```ts\nconst answer: number = 42\n```'} />,
    )

    expect(document.querySelector('code.hljs')).not.toBeNull()
  })

  it('renders converted internal links', () => {
    render(<MarkdownPreview markdown={'Read [[Limits]] first.'} />)

    expect(
      screen.getByRole('link', { name: 'Limits' }).getAttribute('href'),
    ).toBe('/?noteTitle=Limits')
  })
})
