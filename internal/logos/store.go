package logos

import (
	"context"
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

var ErrNoteNotFound = errors.New("note not found")
var ErrFolderNotFound = errors.New("folder not found")

type Store interface {
	Save(ctx context.Context, note Note) error
	Get(ctx context.Context, id string) (Note, error)
	List(ctx context.Context) ([]Note, error)
	Search(ctx context.Context, query string, limit int) ([]SearchResult, error)
	SaveFolder(ctx context.Context, folder Folder) error
	GetFolder(ctx context.Context, id string) (Folder, error)
	ListFolders(ctx context.Context) ([]Folder, error)
	DeleteFolder(ctx context.Context, id string) error
}

type FileStore struct {
	dir string
}

func NewFileStore(dir string) *FileStore {
	return &FileStore{dir: dir}
}

func (s *FileStore) Save(ctx context.Context, note Note) error {
	if err := os.MkdirAll(s.dir, 0o755); err != nil {
		return err
	}

	id := slugify(note.ID)
	if id == "" {
		return errors.New("invalid note id")
	}

	existing, existingErr := s.Get(ctx, id)
	prevTitle := ""
	prevState := ""
	var prevFolderID *string
	if existingErr == nil {
		prevTitle = existing.Title
		prevState = existing.State
		prevFolderID = existing.FolderID
	} else if !errors.Is(existingErr, ErrNoteNotFound) {
		return existingErr
	}
	state := strings.TrimSpace(note.State)
	if state == "" {
		state = prevState
	}
	if state == "" {
		state = "active"
	}
	folderID := note.FolderID
	if folderID == nil {
		folderID = prevFolderID
	}

	path := filepath.Join(s.dir, id+".md")
	if err := os.WriteFile(path, []byte(note.Content), 0o644); err != nil {
		return err
	}

	metaPath := filepath.Join(s.dir, id+".meta.json")
	meta := noteMetadata{State: state, FolderID: folderID}
	rawMeta, err := json.Marshal(meta)
	if err != nil {
		return err
	}
	if err := os.WriteFile(metaPath, rawMeta, 0o644); err != nil {
		return err
	}

	newTitle := extractTitle(note.Content, note.Title)
	if prevTitle == "" || strings.TrimSpace(prevTitle) == strings.TrimSpace(newTitle) {
		return nil
	}

	return s.updateBacklinks(prevTitle, newTitle)
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
	state := "active"
	var folderID *string
	if meta, err := s.readMetadata(safeID); err == nil && strings.TrimSpace(meta.State) != "" {
		state = strings.TrimSpace(meta.State)
		folderID = meta.FolderID
	}
	return Note{
		ID:        safeID,
		Title:     extractTitle(content, safeID),
		Content:   content,
		State:     state,
		FolderID:  folderID,
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

func (s *FileStore) Search(ctx context.Context, query string, limit int) ([]SearchResult, error) {
	notes, err := s.List(ctx)
	if err != nil {
		return nil, err
	}

	return rankNotesForQuery(notes, query, limit), nil
}

func (s *FileStore) SaveFolder(_ context.Context, folder Folder) error {
	if err := os.MkdirAll(s.dir, 0o755); err != nil {
		return err
	}

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

	folders, err := s.readFolders()
	if err != nil {
		return err
	}

	now := nowUTC()
	updated := make([]Folder, 0, len(folders)+1)
	found := false
	for _, existing := range folders {
		if existing.ID == id {
			updated = append(updated, Folder{ID: id, Name: name, UpdatedAt: now})
			found = true
			continue
		}
		updated = append(updated, existing)
	}
	if !found {
		updated = append(updated, Folder{ID: id, Name: name, UpdatedAt: now})
	}

	return s.writeFolders(updated)
}

func (s *FileStore) GetFolder(_ context.Context, id string) (Folder, error) {
	folders, err := s.readFolders()
	if err != nil {
		return Folder{}, err
	}

	safeID := slugify(id)
	for _, folder := range folders {
		if folder.ID == safeID {
			return folder, nil
		}
	}

	return Folder{}, ErrFolderNotFound
}

func (s *FileStore) ListFolders(_ context.Context) ([]Folder, error) {
	folders, err := s.readFolders()
	if err != nil {
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

func (s *FileStore) DeleteFolder(_ context.Context, id string) error {
	safeID := slugify(id)
	if safeID == "" {
		return ErrFolderNotFound
	}

	folders, err := s.readFolders()
	if err != nil {
		return err
	}

	kept := make([]Folder, 0, len(folders))
	found := false
	for _, folder := range folders {
		if folder.ID == safeID {
			found = true
			continue
		}
		kept = append(kept, folder)
	}
	if !found {
		return ErrFolderNotFound
	}

	if err := s.writeFolders(kept); err != nil {
		return err
	}

	entries, err := os.ReadDir(s.dir)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".md") {
			continue
		}

		id := strings.TrimSuffix(entry.Name(), ".md")
		meta, metaErr := s.readMetadata(id)
		if metaErr != nil && !errors.Is(metaErr, os.ErrNotExist) {
			return metaErr
		}
		if meta.FolderID == nil || slugify(*meta.FolderID) != safeID {
			continue
		}
		meta.FolderID = nil
		if err := s.writeMetadata(id, meta); err != nil {
			return err
		}
	}

	return nil
}

type noteMetadata struct {
	State    string  `json:"state"`
	FolderID *string `json:"folderId"`
}

func (s *FileStore) readMetadata(id string) (noteMetadata, error) {
	metaPath := filepath.Join(s.dir, id+".meta.json")
	raw, err := os.ReadFile(metaPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return noteMetadata{}, os.ErrNotExist
		}
		return noteMetadata{}, err
	}

	var meta noteMetadata
	if err := json.Unmarshal(raw, &meta); err != nil {
		return noteMetadata{}, err
	}

	return meta, nil
}

func (s *FileStore) writeMetadata(id string, meta noteMetadata) error {
	metaPath := filepath.Join(s.dir, id+".meta.json")
	rawMeta, err := json.Marshal(meta)
	if err != nil {
		return err
	}

	return os.WriteFile(metaPath, rawMeta, 0o644)
}

func (s *FileStore) readFolders() ([]Folder, error) {
	path := filepath.Join(s.dir, "folders.json")
	raw, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return []Folder{}, nil
		}
		return nil, err
	}

	if len(raw) == 0 {
		return []Folder{}, nil
	}

	var folders []Folder
	if err := json.Unmarshal(raw, &folders); err != nil {
		return nil, err
	}

	for i := range folders {
		folders[i].ID = slugify(folders[i].ID)
	}

	return folders, nil
}

func (s *FileStore) writeFolders(folders []Folder) error {
	path := filepath.Join(s.dir, "folders.json")
	raw, err := json.Marshal(folders)
	if err != nil {
		return err
	}

	return os.WriteFile(path, raw, 0o644)
}

func nowUTC() time.Time {
	return time.Now().UTC()
}

func (s *FileStore) updateBacklinks(oldTitle, newTitle string) error {
	entries, err := os.ReadDir(s.dir)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".md") {
			continue
		}

		path := filepath.Join(s.dir, entry.Name())
		raw, readErr := os.ReadFile(path)
		if readErr != nil {
			return readErr
		}

		updated := replaceWikiLinkTargets(string(raw), oldTitle, newTitle)
		if updated == string(raw) {
			continue
		}

		if writeErr := os.WriteFile(path, []byte(updated), 0o644); writeErr != nil {
			return writeErr
		}
	}

	return nil
}
