# Logos

A self-hosted, student-focused, Markdown-native note-taking workspace.

## How to use

1. Clone the repository
2. Build and run the backend server (`go build -o logos ./internal/logos && ./logos`)
3. Build and run the frontend (`cd frontend && pnpm install && pnpm build && pnpm preview`)
4. Open `http://localhost:4173` in your browser

or simply run `make` from the repository root to do all of the above, and open `http://localhost:8080` in your browser.

## Things that are missing / TODO

- Note deletion
- Git diffing and history
- Image support
- Note Search
- Slash commands (maybe)
- Graph View
- Folders
- Outline View (like a summary of headings in a side panel)
- Add pinning of notes
