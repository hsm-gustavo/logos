package logos

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
)

type Server struct {
	mux   *http.ServeMux
	store Store
}

type upsertNoteRequest struct {
	Title   string `json:"title"`
	Content string `json:"content"`
}

func NewServer(store Store) *Server {
	s := &Server{
		mux:   http.NewServeMux(),
		store: store,
	}

	s.routes()
	return s
}

func (s *Server) routes() {
	s.mux.HandleFunc("GET /api/health", s.handleHealth)
	s.mux.HandleFunc("GET /api/notes", s.handleListNotes)
	s.mux.HandleFunc("GET /api/notes/{id}", s.handleGetNote)
	s.mux.HandleFunc("PUT /api/notes/{id}", s.handlePutNote)
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

	writeJSON(w, http.StatusOK, notes)
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

	note := Note{
		ID:      id,
		Title:   extractTitle(content, payload.Title),
		Content: payload.Content,
	}

	if err := s.store.Save(r.Context(), note); err != nil {
		http.Error(w, "failed to save note", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func writeJSON(w http.ResponseWriter, statusCode int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(data)
}
