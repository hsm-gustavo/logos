package logos

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sort"
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
  folder_id TEXT,
  state TEXT NOT NULL DEFAULT 'active',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`
	_, err := s.db.Exec(schema)
	if err != nil {
		return err
	}

	_, err = s.db.Exec(`ALTER TABLE notes ADD COLUMN folder_id TEXT`)
	if err != nil && !strings.Contains(err.Error(), "duplicate column name") {
		return err
	}

	_, err = s.db.Exec(`ALTER TABLE notes ADD COLUMN state TEXT NOT NULL DEFAULT 'active'`)
	if err != nil && !strings.Contains(err.Error(), "duplicate column name") {
		return err
	}
	return nil
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

	state := strings.TrimSpace(note.State)
	if state == "" {
		var existingState string
		row := tx.QueryRowContext(ctx, `SELECT state FROM notes WHERE id = ?`, id)
		if scanErr := row.Scan(&existingState); scanErr == nil {
			state = strings.TrimSpace(existingState)
		} else if !errors.Is(scanErr, sql.ErrNoRows) {
			return scanErr
		}
	}
	if state == "" {
		state = "active"
	}
	folderID := note.FolderID
	if folderID == nil {
		var existingFolderID sql.NullString
		row := tx.QueryRowContext(ctx, `SELECT folder_id FROM notes WHERE id = ?`, id)
		if scanErr := row.Scan(&existingFolderID); scanErr == nil && existingFolderID.Valid {
			value := strings.TrimSpace(existingFolderID.String)
			if value != "" {
				folderID = &value
			}
		} else if scanErr != nil && !errors.Is(scanErr, sql.ErrNoRows) {
			return scanErr
		}
	}

	now := nowUTC().Format(time.RFC3339)
	_, err = tx.ExecContext(
		ctx,
		`INSERT INTO notes (id, title, content, folder_id, state, updated_at)
VALUES (?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  title = excluded.title,
  content = excluded.content,
  folder_id = excluded.folder_id,
  state = excluded.state,
  updated_at = excluded.updated_at`,
		id,
		newTitle,
		note.Content,
		folderID,
		state,
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
		`SELECT id, title, content, folder_id, state, updated_at FROM notes WHERE id = ?`,
		safeID,
	)

	var note Note
	var folderID sql.NullString
	var updatedAtRaw string
	if err := row.Scan(&note.ID, &note.Title, &note.Content, &folderID, &note.State, &updatedAtRaw); err != nil {
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
	if folderID.Valid && strings.TrimSpace(folderID.String) != "" {
		value := strings.TrimSpace(folderID.String)
		note.FolderID = &value
	}
	return note, nil
}

func (s *SQLiteStore) List(ctx context.Context) ([]Note, error) {
	rows, err := s.db.QueryContext(
		ctx,
		`SELECT id, title, content, folder_id, state, updated_at FROM notes ORDER BY id ASC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	notes := make([]Note, 0)
	for rows.Next() {
		var n Note
		var folderID sql.NullString
		var updatedAtRaw string
		if err := rows.Scan(&n.ID, &n.Title, &n.Content, &folderID, &n.State, &updatedAtRaw); err != nil {
			return nil, err
		}

		updatedAt, err := time.Parse(time.RFC3339, updatedAtRaw)
		if err != nil {
			return nil, err
		}

		n.UpdatedAt = updatedAt.UTC()
		n.Links = extractWikiLinks(n.Content)
		if folderID.Valid && strings.TrimSpace(folderID.String) != "" {
			value := strings.TrimSpace(folderID.String)
			n.FolderID = &value
		}
		notes = append(notes, n)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return notes, nil
}

func (s *SQLiteStore) Search(ctx context.Context, query string, limit int) ([]SearchResult, error) {
	notes, err := s.List(ctx)
	if err != nil {
		return nil, err
	}

	return rankNotesForQuery(notes, query, limit), nil
}

func (s *SQLiteStore) SaveFolder(ctx context.Context, folder Folder) error {
	id := slugify(folder.ID)
	if id == "" {
		id = slugify(folder.Name)
	}
	if id == "" {
		return errors.New("invalid folder id")
	}

	name := strings.TrimSpace(folder.Name)
	if name == "" {
		return errors.New("folder name is required")
	}

	_, err := s.db.ExecContext(
		ctx,
		`INSERT INTO folders (id, name, updated_at)
VALUES (?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  updated_at = excluded.updated_at`,
		id,
		name,
		nowUTC().Format(time.RFC3339),
	)
	return err
}

func (s *SQLiteStore) GetFolder(ctx context.Context, id string) (Folder, error) {
	safeID := slugify(id)
	if safeID == "" {
		return Folder{}, ErrFolderNotFound
	}

	row := s.db.QueryRowContext(ctx, `SELECT id, name, updated_at FROM folders WHERE id = ?`, safeID)
	var folder Folder
	var updatedAtRaw string
	if err := row.Scan(&folder.ID, &folder.Name, &updatedAtRaw); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Folder{}, ErrFolderNotFound
		}
		return Folder{}, err
	}

	updatedAt, err := time.Parse(time.RFC3339, updatedAtRaw)
	if err != nil {
		return Folder{}, err
	}

	folder.UpdatedAt = updatedAt.UTC()
	return folder, nil
}

func (s *SQLiteStore) ListFolders(ctx context.Context) ([]Folder, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id, name, updated_at FROM folders ORDER BY name ASC, id ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	folders := make([]Folder, 0)
	for rows.Next() {
		var folder Folder
		var updatedAtRaw string
		if err := rows.Scan(&folder.ID, &folder.Name, &updatedAtRaw); err != nil {
			return nil, err
		}

		updatedAt, err := time.Parse(time.RFC3339, updatedAtRaw)
		if err != nil {
			return nil, err
		}

		folder.UpdatedAt = updatedAt.UTC()
		folders = append(folders, folder)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	sort.Slice(folders, func(i, j int) bool {
		if strings.EqualFold(folders[i].Name, folders[j].Name) {
			return folders[i].ID < folders[j].ID
		}
		return strings.ToLower(folders[i].Name) < strings.ToLower(folders[j].Name)
	})

	return folders, nil
}

func (s *SQLiteStore) DeleteFolder(ctx context.Context, id string) error {
	safeID := slugify(id)
	if safeID == "" {
		return ErrFolderNotFound
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

	result, err := tx.ExecContext(ctx, `DELETE FROM folders WHERE id = ?`, safeID)
	if err != nil {
		return err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return ErrFolderNotFound
	}

	_, err = tx.ExecContext(ctx, `UPDATE notes SET folder_id = NULL, updated_at = ? WHERE folder_id = ?`, nowUTC().Format(time.RFC3339), safeID)
	if err != nil {
		return err
	}

	err = tx.Commit()
	if err != nil {
		return err
	}

	return nil
}
