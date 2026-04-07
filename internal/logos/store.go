package logos

import (
	"context"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

var ErrNoteNotFound = errors.New("note not found")

type Store interface {
	Save(ctx context.Context, note Note) error
	Get(ctx context.Context, id string) (Note, error)
	List(ctx context.Context) ([]Note, error)
}

type FileStore struct {
	dir string
}

func NewFileStore(dir string) *FileStore {
	return &FileStore{dir: dir}
}

func (s *FileStore) Save(_ context.Context, note Note) error {
	if err := os.MkdirAll(s.dir, 0o755); err != nil {
		return err
	}

	id := slugify(note.ID)
	if id == "" {
		return errors.New("invalid note id")
	}

	path := filepath.Join(s.dir, id+".md")
	return os.WriteFile(path, []byte(note.Content), 0o644)
}

func (s *FileStore) Get(_ context.Context, id string) (Note, error) {
	safeID := slugify(id)
	if safeID == "" {
		return Note{}, ErrNoteNotFound
	}

	path := filepath.Join(s.dir, safeID+".md")
	raw, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return Note{}, ErrNoteNotFound
		}
		return Note{}, err
	}

	stat, err := os.Stat(path)
	if err != nil {
		return Note{}, err
	}

	content := string(raw)
	return Note{
		ID:        safeID,
		Title:     extractTitle(content, safeID),
		Content:   content,
		Links:     extractWikiLinks(content),
		UpdatedAt: stat.ModTime().UTC(),
		Path:      path,
	}, nil
}

func (s *FileStore) List(ctx context.Context) ([]Note, error) {
	if err := os.MkdirAll(s.dir, 0o755); err != nil {
		return nil, err
	}

	entries, err := os.ReadDir(s.dir)
	if err != nil {
		return nil, err
	}

	notes := make([]Note, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".md") {
			continue
		}

		id := strings.TrimSuffix(entry.Name(), ".md")
		note, getErr := s.Get(ctx, id)
		if getErr != nil {
			if errors.Is(getErr, fs.ErrNotExist) {
				continue
			}
			return nil, getErr
		}
		notes = append(notes, note)
	}

	sort.Slice(notes, func(i, j int) bool {
		return notes[i].ID < notes[j].ID
	})

	return notes, nil
}

func nowUTC() time.Time {
	return time.Now().UTC()
}
