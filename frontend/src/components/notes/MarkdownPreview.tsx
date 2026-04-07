import Markdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { toMarkdownLinks } from '../../lib/wikiLinks'

type MarkdownPreviewProps = {
  markdown: string
}

export function MarkdownPreview({ markdown }: MarkdownPreviewProps) {
  return (
    <article className="prose prose-slate max-w-none prose-pre:rounded-md prose-code:before:content-none prose-code:after:content-none">
      <Markdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeHighlight]}
      >
        {toMarkdownLinks(markdown)}
      </Markdown>
    </article>
  )
}
