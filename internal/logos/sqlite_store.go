package logos

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

type SQLiteStore struct {
	db *sql.DB
}

func NewSQLiteStore(dbPath string) (*SQLiteStore, error) {
	dsn := fmt.Sprintf("file:%s", dbPath)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}

	store := &SQLiteStore{db: db}
	if err := store.init(); err != nil {
		_ = db.Close()
		return nil, err
	}

	return store, nil
}

func (s *SQLiteStore) init() error {
	const schema = `
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`
	_, err := s.db.Exec(schema)
	return err
}

func (s *SQLiteStore) Save(ctx context.Context, note Note) error {
	id := slugify(note.ID)
	if id == "" {
		return errors.New("invalid note id")
	}

	newTitle := extractTitle(note.Content, note.Title)
	if strings.TrimSpace(note.Content) == "" {
		return errors.New("content is required")
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}

	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	prevTitle := ""
	var existingTitle string
	row := tx.QueryRowContext(ctx, `SELECT title FROM notes WHERE id = ?`, id)
	if scanErr := row.Scan(&existingTitle); scanErr == nil {
		prevTitle = existingTitle
	} else if !errors.Is(scanErr, sql.ErrNoRows) {
		return scanErr
	}

	now := nowUTC().Format(time.RFC3339)
	_, err = tx.ExecContext(
		ctx,
		`INSERT INTO notes (id, title, content, updated_at)
VALUES (?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  title = excluded.title,
  content = excluded.content,
  updated_at = excluded.updated_at`,
		id,
		newTitle,
		note.Content,
		now,
	)
	if err != nil {
		return err
	}

	if prevTitle != "" && strings.TrimSpace(prevTitle) != strings.TrimSpace(newTitle) {
		if err := s.updateBacklinksTx(ctx, tx, prevTitle, newTitle); err != nil {
			return err
		}
	}

	err = tx.Commit()
	if err != nil {
		return err
	}

	return nil
}

func (s *SQLiteStore) updateBacklinksTx(ctx context.Context, tx *sql.Tx, oldTitle, newTitle string) error {
	rows, err := tx.QueryContext(ctx, `SELECT id, content FROM notes`)
	if err != nil {
		return err
	}
	defer rows.Close()

	type rowData struct {
		id      string
		content string
	}

	updates := make([]rowData, 0)
	for rows.Next() {
		var noteID string
		var content string
		if err := rows.Scan(&noteID, &content); err != nil {
			return err
		}

		updated := replaceWikiLinkTargets(content, oldTitle, newTitle)
		if updated != content {
			updates = append(updates, rowData{id: noteID, content: updated})
		}
	}

	if err := rows.Err(); err != nil {
		return err
	}

	for _, upd := range updates {
		_, err := tx.ExecContext(
			ctx,
			`UPDATE notes SET content = ?, updated_at = ? WHERE id = ?`,
			upd.content,
			nowUTC().Format(time.RFC3339),
			upd.id,
		)
		if err != nil {
			return err
		}
	}

	return nil
}

func (s *SQLiteStore) Get(ctx context.Context, id string) (Note, error) {
	safeID := slugify(id)
	if safeID == "" {
		return Note{}, ErrNoteNotFound
	}

	row := s.db.QueryRowContext(
		ctx,
		`SELECT id, title, content, updated_at FROM notes WHERE id = ?`,
		safeID,
	)

	var note Note
	var updatedAtRaw string
	if err := row.Scan(&note.ID, &note.Title, &note.Content, &updatedAtRaw); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Note{}, ErrNoteNotFound
		}
		return Note{}, err
	}

	updatedAt, err := time.Parse(time.RFC3339, updatedAtRaw)
	if err != nil {
		return Note{}, err
	}

	note.UpdatedAt = updatedAt.UTC()
	note.Links = extractWikiLinks(note.Content)
	return note, nil
}

func (s *SQLiteStore) List(ctx context.Context) ([]Note, error) {
	rows, err := s.db.QueryContext(
		ctx,
		`SELECT id, title, content, updated_at FROM notes ORDER BY id ASC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	notes := make([]Note, 0)
	for rows.Next() {
		var n Note
		var updatedAtRaw string
		if err := rows.Scan(&n.ID, &n.Title, &n.Content, &updatedAtRaw); err != nil {
			return nil, err
		}

		updatedAt, err := time.Parse(time.RFC3339, updatedAtRaw)
		if err != nil {
			return nil, err
		}

		n.UpdatedAt = updatedAt.UTC()
		n.Links = extractWikiLinks(n.Content)
		notes = append(notes, n)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return notes, nil
}