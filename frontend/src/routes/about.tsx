import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <main className="page-wrap px-4 py-10">
      <section className="glass rounded-xl p-6">
        <p className="kicker mb-2">About Logos</p>
        <h1 className="mb-4 text-3xl font-bold text-[var(--sea-ink)] sm:text-4xl">
          A self-hosted notebook for students who think in Markdown.
        </h1>
        <p className="m-0 max-w-3xl text-sm leading-7 text-[var(--sea-ink-soft)]">
          Logos combines a Go backend and a React workspace to keep notes local,
          fast and linkable. It supports formulas, code highlighting, images,
          external links, and wiki-style note references inspired by graph-based
          tools.
        </p>
      </section>
    </main>
  )
}
