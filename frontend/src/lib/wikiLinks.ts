export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_/]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '')
}

export function extractWikiLinks(markdown: string): string[] {
  const matches = [...markdown.matchAll(/\[\[([^\]]+)\]\]/g)]
  const links: string[] = []
  const seen = new Set<string>()

  for (const match of matches) {
    const target = slugify(match[1])
    if (!target || seen.has(target)) {
      continue
    }

    seen.add(target)
    links.push(target)
  }

  return links
}

export function toMarkdownLinks(markdown: string): string {
  return markdown.replace(/\[\[([^\]]+)\]\]/g, (_, rawTitle: string) => {
    const label = rawTitle.trim()
    const slug = slugify(label)
    if (!slug) {
      return label
    }

    return `[${label}](/?note=${slug})`
  })
}
