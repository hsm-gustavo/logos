package logos

import (
	"context"
	"embed"
	"encoding/json"
	"errors"
	"io"
	"io/fs"
	"net/http"
	"strconv"
	"strings"
)

type Server struct {
	mux        *http.ServeMux
	store      Store
	frontendFS embed.FS
}

type upsertNoteRequest struct {
	Title    string  `json:"title"`
	Content  string  `json:"content"`
	FolderID *string `json:"folderId"`
}

type upsertFolderRequest struct {
	Name string `json:"name"`
}

func NewServer(store Store, frontendFS embed.FS) *Server {
	s := &Server{
		mux:        http.NewServeMux(),
		store:      store,
		frontendFS: frontendFS,
	}

	s.routes()
	return s
}

func (s *Server) routes() {
	s.mux.HandleFunc("GET /api/health", s.handleHealth)
	s.mux.HandleFunc("GET /api/notes", s.handleListNotes)
	s.mux.HandleFunc("GET /api/notes/{id}", s.handleGetNote)
	s.mux.HandleFunc("DELETE /api/notes/{id}", s.handleArchiveNote)
	s.mux.HandleFunc("POST /api/notes/{id}/restore", s.handleRestoreNote)
	s.mux.HandleFunc("PUT /api/notes/{id}", s.handlePutNote)
	s.mux.HandleFunc("GET /api/search", s.handleSearch)
	s.mux.HandleFunc("GET /api/folders", s.handleListFolders)
	s.mux.HandleFunc("POST /api/folders", s.handleCreateFolder)
	s.mux.HandleFunc("PUT /api/folders/{id}", s.handleUpdateFolder)
	s.mux.HandleFunc("DELETE /api/folders/{id}", s.handleDeleteFolder)

	public, _ := fs.Sub(s.frontendFS, "dist")
	s.mux.Handle("/", http.FileServer(http.FS(public)))
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.mux.ServeHTTP(w, r)
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleListNotes(w http.ResponseWriter, r *http.Request) {
	notes, err := s.store.List(r.Context())
	if err != nil {
		http.Error(w, "failed to list notes", http.StatusInternalServerError)
		return
	}

	state := strings.TrimSpace(r.URL.Query().Get("state"))
	filtered := filterNotesByState(notes, state)

	writeJSON(w, http.StatusOK, filtered)
}

func (s *Server) handleGetNote(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	note, err := s.store.Get(r.Context(), id)
	if err != nil {
		if errors.Is(err, ErrNoteNotFound) {
			http.Error(w, "note not found", http.StatusNotFound)
			return
		}
		http.Error(w, "failed to read note", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, note)
}

func (s *Server) handlePutNote(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	var payload upsertNoteRequest
	if err := json.Unmarshal(body, &payload); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}

	id := slugify(r.PathValue("id"))
	if id == "" {
		http.Error(w, "invalid note id", http.StatusBadRequest)
		return
	}

	content := strings.TrimSpace(payload.Content)
	if content == "" {
		http.Error(w, "content is required", http.StatusBadRequest)
		return
	}

	var existingFolderID *string
	if existing, err := s.store.Get(r.Context(), id); err == nil {
		existingFolderID = existing.FolderID
	} else if err != nil && !errors.Is(err, ErrNoteNotFound) {
		http.Error(w, "failed to read note", http.StatusInternalServerError)
		return
	}

	folderID, err := s.resolveFolderID(r.Context(), payload.FolderID, existingFolderID)
	if err != nil {
		if errors.Is(err, ErrFolderNotFound) {
			http.Error(w, "folder not found", http.StatusBadRequest)
			return
		}
		http.Error(w, "failed to resolve folder", http.StatusInternalServerError)
		return
	}

	note := Note{
		ID:       id,
		Title:    extractTitle(content, payload.Title),
		Content:  payload.Content,
		FolderID: folderID,
	}

	if err := s.store.Save(r.Context(), note); err != nil {
		http.Error(w, "failed to save note", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleListFolders(w http.ResponseWriter, r *http.Request) {
	folders, err := s.store.ListFolders(r.Context())
	if err != nil {
		http.Error(w, "failed to list folders", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, folders)
}

func (s *Server) handleCreateFolder(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	var payload upsertFolderRequest
	if err := json.Unmarshal(body, &payload); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}

	name := strings.TrimSpace(payload.Name)
	if name == "" {
		http.Error(w, "name is required", http.StatusBadRequest)
		return
	}

	folder := Folder{ID: slugify(name), Name: name}
	if folder.ID == "" {
		http.Error(w, "invalid folder id", http.StatusBadRequest)
		return
	}

	if err := s.store.SaveFolder(r.Context(), folder); err != nil {
		http.Error(w, "failed to save folder", http.StatusInternalServerError)
		return
	}

	created, err := s.store.GetFolder(r.Context(), folder.ID)
	if err != nil {
		http.Error(w, "failed to read folder", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusCreated, created)
}

func (s *Server) handleUpdateFolder(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if _, err := s.store.GetFolder(r.Context(), id); err != nil {
		if errors.Is(err, ErrFolderNotFound) {
			http.Error(w, "folder not found", http.StatusNotFound)
			return
		}
		http.Error(w, "failed to read folder", http.StatusInternalServerError)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	var payload upsertFolderRequest
	if err := json.Unmarshal(body, &payload); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}

	name := strings.TrimSpace(payload.Name)
	if name == "" {
		http.Error(w, "name is required", http.StatusBadRequest)
		return
	}

	folder := Folder{ID: id, Name: name}
	if err := s.store.SaveFolder(r.Context(), folder); err != nil {
		http.Error(w, "failed to save folder", http.StatusInternalServerError)
		return
	}

	updated, err := s.store.GetFolder(r.Context(), id)
	if err != nil {
		http.Error(w, "failed to read folder", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) handleDeleteFolder(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := s.store.DeleteFolder(r.Context(), id); err != nil {
		if errors.Is(err, ErrFolderNotFound) {
			http.Error(w, "folder not found", http.StatusNotFound)
			return
		}
		http.Error(w, "failed to delete folder", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleArchiveNote(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	note, err := s.store.Get(r.Context(), id)
	if err != nil {
		if errors.Is(err, ErrNoteNotFound) {
			http.Error(w, "note not found", http.StatusNotFound)
			return
		}
		http.Error(w, "failed to read note", http.StatusInternalServerError)
		return
	}

	note.State = "archived"
	if err := s.store.Save(r.Context(), note); err != nil {
		http.Error(w, "failed to archive note", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleRestoreNote(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	note, err := s.store.Get(r.Context(), id)
	if err != nil {
		if errors.Is(err, ErrNoteNotFound) {
			http.Error(w, "note not found", http.StatusNotFound)
			return
		}
		http.Error(w, "failed to read note", http.StatusInternalServerError)
		return
	}

	note.State = "active"
	if err := s.store.Save(r.Context(), note); err != nil {
		http.Error(w, "failed to restore note", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, note)
}

func (s *Server) handleSearch(w http.ResponseWriter, r *http.Request) {
	query := strings.TrimSpace(r.URL.Query().Get("q"))
	if query == "" {
		writeJSON(w, http.StatusOK, []SearchResult{})
		return
	}

	limit := 20
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed <= 0 {
			http.Error(w, "invalid limit", http.StatusBadRequest)
			return
		}
		limit = parsed
	}

	if limit > 50 {
		limit = 50
	}

	results, err := s.store.Search(r.Context(), query, limit)
	if err != nil {
		http.Error(w, "failed to search notes", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, results)
}

func filterNotesByState(notes []Note, state string) []Note {
	switch strings.ToLower(strings.TrimSpace(state)) {
	case "archived":
		filtered := make([]Note, 0)
		for _, note := range notes {
			if strings.EqualFold(strings.TrimSpace(note.State), "archived") {
				filtered = append(filtered, note)
			}
		}
		return filtered
	case "all":
		return notes
	default:
		filtered := make([]Note, 0, len(notes))
		for _, note := range notes {
			if !strings.EqualFold(strings.TrimSpace(note.State), "archived") {
				filtered = append(filtered, note)
			}
		}
		return filtered
	}
}

func (s *Server) resolveFolderID(ctx context.Context, requested *string, existing *string) (*string, error) {
	if requested == nil {
		return existing, nil
	}

	trimmed := strings.TrimSpace(*requested)
	if trimmed == "" {
		return nil, nil
	}

	folder, err := s.store.GetFolder(ctx, trimmed)
	if err != nil {
		return nil, err
	}

	id := folder.ID
	return &id, nil
}

func writeJSON(w http.ResponseWriter, statusCode int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(data)
}
