# AGENTS.md

This repository hosts Logos, a self-hosted, student-focused, Markdown-native note tool.

## Product Goals

- Keep writing friction near zero.
- Notes are Markdown first-class citizens.
- Internal note links use wiki syntax: [[target-note]].
- Support rich study notes:
  - Images
  - External links
  - Code blocks with syntax highlighting
  - Math formulas (KaTeX)
- Keep everything in English. Do not introduce i18n.
- Use a monospaced visual identity in the frontend.

## Architecture

- Backend: Go (HTTP JSON API)
- Frontend: React + TanStack Router + Tailwind + Vite
- Storage: markdown files on local disk (self-hosted model)

## Current Backend Contracts

- GET /api/health
  - 200 {"status":"ok"}
- GET /api/notes
  - 200 Note[]
- GET /api/notes/{id}
  - 200 Note
  - 404 when note is missing
- PUT /api/notes/{id}
  - Request: {"title": string, "content": string}
  - 204 on success

Note shape:

- id: string
- title: string
- content: string
- links: string[] (extracted from [[wikilinks]])
- updatedAt: string (RFC3339 in JSON)

## Current Frontend Behavior

- Workspace route at /.
- Left panel: note list.
- Middle panel: markdown editor.
- Right panel: rendered preview.
- Preview uses:
  - react-markdown
  - remark-gfm
  - remark-math
  - rehype-katex
  - rehype-highlight
- Internal links [[Some Note]] are converted to /?note=some-note.

## Development Workflow (Mandatory)

1. Write failing tests first (TDD / Prove-It pattern).
2. Implement the minimal code to pass.
3. Refactor safely with tests green.
4. Re-run checks.

Do not skip tests for behavior changes.

## Commands

From repository root:

- go test ./...
- go run ./cmd/logos

From frontend:

- pnpm install
- pnpm dev
- pnpm test
- pnpm lint
- pnpm build

## Code Quality Rules

- Keep changes small and focused.
- Do not mix formatting-only edits with behavior changes.
- Preserve public API behavior unless task explicitly requires changes.
- Validate all input at API boundaries.
- Do not add secrets to source code.

## Notes for Future Agents

- Prefer adding tests in the lowest useful level first.
- If you introduce a dependency, justify it briefly in PR/summary notes.
- Keep copy and UI labels in English.
- Keep typography monospaced in new UI work unless product direction changes.
- If you expand the API, update this file with endpoint contracts.

## Suggested Next Milestones

- Add create/delete endpoints and optimistic UI flows.
- Add note backlinks and graph view for linked notes.
- Add image upload endpoint (self-hosted local assets directory).
- Add search (title + content) with ranking for study workflows.
- Add autosave with debounce and conflict-safe writes.
