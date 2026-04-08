# AGENTS.md

## Overview

Logos is a self-hosted, student-focused, Markdown-native note tool. The product goal is to keep writing friction near zero while treating Markdown as the primary storage and editing format.

Core principles:

- Notes are first-class Markdown files.
- Internal links use wiki syntax: [[target-note]].
- Study notes should support images, external links, code blocks with syntax highlighting, and math formulas rendered with KaTeX.
- Everything stays in English. Do not introduce i18n.
- New UI should preserve the monospaced visual identity.

## Agents

### GitHub Copilot

- Role: Primary coding agent for implementation, refactoring, and documentation updates.
- Inputs: Current task, workspace files, tests, error output, repo conventions, and relevant instructions.
- Outputs: Focused code changes, validated fixes, and concise progress summaries.
- Tools: File search, file reads, patches, tests, terminal commands, notebook tools when relevant.

### Explore

- Role: Read-only codebase exploration and question answering.
- Inputs: Target area, search goals, and desired thoroughness.
- Outputs: Relevant file locations, patterns, and concise findings.
- Tools: Search, file reads, and repository exploration.

### test-engineer

- Role: Test strategy, failing-test design, and coverage review.
- Inputs: Behavior changes, bug reports, and existing implementation details.
- Outputs: Test cases, edge cases, and validation guidance.
- Tools: Test files, error output, and targeted code inspection.

## Architecture

- Backend: Go HTTP JSON API.
- Frontend: React + TanStack Router + Tailwind + Vite.
- Storage: SQLite by default, with an optional file-backed store for Markdown files on local disk.
- The backend can migrate file-backed notes into SQLite when the database starts empty.

Environment knobs:

- `LOGOS_STORE=file|sqlite` selects the store implementation.
- `LOGOS_DATA_DIR` sets the file-store directory.
- `LOGOS_DB_PATH` sets the SQLite database path.
- `LOGOS_MIGRATE_FROM_DIR` sets the source directory used for SQLite migration.

Current backend contracts:

- GET /api/health
  - 200 {"status":"ok"}
- GET /api/notes
  - 200 Note[]
- GET /api/notes/{id}
  - 200 Note
  - 404 when the note is missing
- PUT /api/notes/{id}
  - Request body: {"title": string, "content": string}
  - 204 on success

Note shape:

- id: string
- title: string
- content: string
- links: string[] extracted from [[wikilinks]]
- updatedAt: string in RFC3339 format

Current frontend behavior:

- Workspace route is /.
- The header includes workspace navigation, an About page, and a theme toggle.
- Left panel shows the note list.
- Right panel is the Markdown editor.
- The workspace route should stay thin; move shared logic into `frontend/src/lib/` and UI into `frontend/src/components/`.
- The editor supports wiki-style autocompletion, autosave, and a read-only preview mode.
- Read-only preview is loaded lazily and uses `react-markdown`, `remark-gfm`, `remark-math`, `rehype-katex`, and `rehype-highlight`.
- A new note button creates a fresh note and opens it in the workspace.
- If the workspace is empty, the app seeds a starter note automatically.
- Internal links like [[Some Note]] resolve to /?note=some-note.

## Setup

Repository root commands:

- make
- go test ./...
- go run ./cmd/logos

Frontend commands:

- pnpm install
- pnpm dev
- pnpm test
- pnpm lint
- pnpm build

Development workflow:

1. Write failing tests first for behavior changes.
2. Implement the smallest change that makes the tests pass.
3. Refactor only with tests green.
4. Re-run the relevant checks before finishing.

## Behavior Rules

- Keep changes small, focused, and easy to review.
- Do not mix formatting-only edits with behavior changes.
- Preserve public API behavior unless the task explicitly changes it.
- Validate input at API boundaries.
- Do not add secrets to source code or version control.
- Prefer the lowest useful test level first.
- Keep copy and UI labels in English.
- Keep typography monospaced in new UI work unless product direction changes.
- Do not skip tests for behavior changes.
- Avoid adding non-route logic under `frontend/src/routes/`, because TanStack Router scans that directory.

## Tools

- Use Go tests for backend behavior.
- Use pnpm for frontend dependency and test workflows.
- Use terminal commands for builds, local runs, and verification.
- Use file search and targeted file reads before editing.
- Use patches for file edits.
- Use the test-engineer agent when test design or coverage review is the main task.
- Use Explore when you need quick codebase discovery without editing.

## Data Handling

- Treat note files as local Markdown content stored on disk.
- Keep extracted link data aligned with [[wikilinks]].
- Keep backend responses stable and explicit.
- When a note title changes, backlink references are rewritten to keep wiki links aligned.
- Do not invent new persisted fields without updating the documented contract.
- When expanding the API, update this file with the new endpoint contract.

## Evaluation

Preferred verification order:

1. Unit tests for logic changes.
2. Integration tests for API or data-flow changes.
3. Frontend tests for UI behavior.
4. Lint and build checks when the change touches app structure or shared code.

Acceptance criteria:

- The relevant tests pass.
- The implementation matches the documented contract.
- Error cases are handled intentionally, not by accident.
- No unrelated files are modified.

## Examples

Good task framing:

```text
TASK: Add validation to the note update endpoint
RELEVANT FILES:
- internal/logos/handler_test.go
- internal/logos/server.go
- internal/logos/note.go
CONSTRAINTS:
- Keep the response contract stable
- Add a failing test first
```

Good update pattern:

- Read the relevant source and test files first.
- Add or adjust the smallest test that proves the behavior.
- Implement the minimal code change.
- Re-run the targeted checks.

## Extending

- If you add a new backend endpoint, document the request and response shape here.
- If you introduce a dependency, justify it briefly in the summary or PR notes.
- If you change the frontend interaction model, update the current frontend behavior section.
- If you add a new workflow rule, keep it short and specific.

## Limitations

- The project intentionally keeps everything in English.
- The note model is file-backed, so edits should respect local disk storage semantics.
- The current backend contract only covers health, list, fetch, and update operations.
- The current frontend behavior is centered on a single workspace route.

## Changelog

- Reorganized the guidance into a persistent agent-facing structure.
- Preserved the current backend contracts and frontend behavior.
- Added explicit agent roles, setup commands, validation rules, and extension guidance.
