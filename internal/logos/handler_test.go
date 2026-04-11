package logos

import (
	"bytes"
	"embed"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAPIFlow(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	server := NewServer(NewFileStore(dir), embed.FS{})

	putBody := map[string]string{
		"title":   "Calculus I",
		"content": "# Calculus I\n\nDerivative of x^2 is 2x. See [[limits]].",
	}

	rawPutBody, err := json.Marshal(putBody)
	if err != nil {
		t.Fatalf("marshal put body: %v", err)
	}

	req := httptest.NewRequest(http.MethodPut, "/api/notes/calculus-i", bytes.NewReader(rawPutBody))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	server.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status mismatch for put: got %d want %d", rec.Code, http.StatusNoContent)
	}

	getReq := httptest.NewRequest(http.MethodGet, "/api/notes/calculus-i", nil)
	getRec := httptest.NewRecorder()
	server.ServeHTTP(getRec, getReq)

	if getRec.Code != http.StatusOK {
		t.Fatalf("status mismatch for get: got %d want %d", getRec.Code, http.StatusOK)
	}

	var note Note
	if err := json.Unmarshal(getRec.Body.Bytes(), &note); err != nil {
		t.Fatalf("unmarshal get note: %v", err)
	}

	if note.Title != "Calculus I" {
		t.Fatalf("title mismatch: got %q", note.Title)
	}

	if len(note.Links) != 1 || note.Links[0] != "limits" {
		t.Fatalf("links mismatch: got %v", note.Links)
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/notes", nil)
	listRec := httptest.NewRecorder()
	server.ServeHTTP(listRec, listReq)

	if listRec.Code != http.StatusOK {
		t.Fatalf("status mismatch for list: got %d want %d", listRec.Code, http.StatusOK)
	}

	var notes []Note
	if err := json.Unmarshal(listRec.Body.Bytes(), &notes); err != nil {
		t.Fatalf("unmarshal list notes: %v", err)
	}

	if len(notes) != 1 || notes[0].ID != "calculus-i" {
		t.Fatalf("list mismatch: got %#v", notes)
	}
}

type searchResultResponse struct {
	Note        Note    `json:"note"`
	Score       float64 `json:"score"`
	MatchSource string  `json:"matchSource"`
}

func TestSearchAPIRanksTitleMatchesAboveContentMatches(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	server := NewServer(NewFileStore(dir), embed.FS{})

	putNote(t, server, "calculus-foundations", "Calculus Foundations", "# Calculus Foundations\n\nLimits and derivatives.")
	putNote(t, server, "physics-intro", "Physics Intro", "# Physics Intro\n\nThis note mentions calculus in content.")

	req := httptest.NewRequest(http.MethodGet, "/api/search?q=calc", nil)
	rec := httptest.NewRecorder()
	server.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status mismatch for search: got %d want %d", rec.Code, http.StatusOK)
	}

	var got []searchResultResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("unmarshal search response: %v", err)
	}

	if len(got) < 2 {
		t.Fatalf("expected at least 2 results, got %d", len(got))
	}

	if got[0].Note.ID != "calculus-foundations" {
		t.Fatalf("expected title match first, got first result %q", got[0].Note.ID)
	}
}

func TestSearchAPIEmptyQueryReturnsEmptyList(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	server := NewServer(NewFileStore(dir), embed.FS{})

	req := httptest.NewRequest(http.MethodGet, "/api/search?q=", nil)
	rec := httptest.NewRecorder()
	server.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status mismatch for search empty query: got %d want %d", rec.Code, http.StatusOK)
	}

	var got []searchResultResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("unmarshal empty query response: %v", err)
	}

	if len(got) != 0 {
		t.Fatalf("expected empty result, got %d", len(got))
	}
}

func TestSearchAPIAppliesDefaultAndMaxLimit(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	server := NewServer(NewFileStore(dir), embed.FS{})

	for i := 1; i <= 60; i++ {
		id := fmt.Sprintf("calc-note-%d", i)
		title := fmt.Sprintf("Calc Note %d", i)
		content := fmt.Sprintf("# %s\n\nSearch corpus item.", title)
		putNote(t, server, id, title, content)
	}

	defaultReq := httptest.NewRequest(http.MethodGet, "/api/search?q=calc", nil)
	defaultRec := httptest.NewRecorder()
	server.ServeHTTP(defaultRec, defaultReq)

	if defaultRec.Code != http.StatusOK {
		t.Fatalf("status mismatch for default limit: got %d want %d", defaultRec.Code, http.StatusOK)
	}

	var defaultResults []searchResultResponse
	if err := json.Unmarshal(defaultRec.Body.Bytes(), &defaultResults); err != nil {
		t.Fatalf("unmarshal default limit response: %v", err)
	}

	if len(defaultResults) != 20 {
		t.Fatalf("default limit mismatch: got %d want %d", len(defaultResults), 20)
	}

	maxReq := httptest.NewRequest(http.MethodGet, "/api/search?q=calc&limit=200", nil)
	maxRec := httptest.NewRecorder()
	server.ServeHTTP(maxRec, maxReq)

	if maxRec.Code != http.StatusOK {
		t.Fatalf("status mismatch for max limit: got %d want %d", maxRec.Code, http.StatusOK)
	}

	var maxResults []searchResultResponse
	if err := json.Unmarshal(maxRec.Body.Bytes(), &maxResults); err != nil {
		t.Fatalf("unmarshal max limit response: %v", err)
	}

	if len(maxResults) != 50 {
		t.Fatalf("max limit mismatch: got %d want %d", len(maxResults), 50)
	}
}

func TestArchiveFlowKeepsArchivedNotesResolvableAndRestorable(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	server := NewServer(NewFileStore(dir), embed.FS{})

	putNote(t, server, "linear-algebra", "Linear Algebra", "# Linear Algebra\n\nSee [[vectors]].")

	archiveReq := httptest.NewRequest(http.MethodDelete, "/api/notes/linear-algebra", nil)
	archiveRec := httptest.NewRecorder()
	server.ServeHTTP(archiveRec, archiveReq)

	if archiveRec.Code != http.StatusNoContent {
		t.Fatalf("status mismatch for archive: got %d want %d", archiveRec.Code, http.StatusNoContent)
	}

	getReq := httptest.NewRequest(http.MethodGet, "/api/notes/linear-algebra", nil)
	getRec := httptest.NewRecorder()
	server.ServeHTTP(getRec, getReq)

	if getRec.Code != http.StatusOK {
		t.Fatalf("status mismatch for archived get: got %d want %d", getRec.Code, http.StatusOK)
	}

	var archived Note
	if err := json.Unmarshal(getRec.Body.Bytes(), &archived); err != nil {
		t.Fatalf("unmarshal archived note: %v", err)
	}

	if archived.State != "archived" {
		t.Fatalf("state mismatch after archive: got %q want %q", archived.State, "archived")
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/notes", nil)
	listRec := httptest.NewRecorder()
	server.ServeHTTP(listRec, listReq)

	if listRec.Code != http.StatusOK {
		t.Fatalf("status mismatch for list after archive: got %d want %d", listRec.Code, http.StatusOK)
	}

	var notes []Note
	if err := json.Unmarshal(listRec.Body.Bytes(), &notes); err != nil {
		t.Fatalf("unmarshal note list after archive: %v", err)
	}

	if len(notes) != 0 {
		t.Fatalf("expected archived note to be hidden from default list, got %#v", notes)
	}

	allReq := httptest.NewRequest(http.MethodGet, "/api/notes?state=all", nil)
	allRec := httptest.NewRecorder()
	server.ServeHTTP(allRec, allReq)

	if allRec.Code != http.StatusOK {
		t.Fatalf("status mismatch for list all: got %d want %d", allRec.Code, http.StatusOK)
	}

	var allNotes []Note
	if err := json.Unmarshal(allRec.Body.Bytes(), &allNotes); err != nil {
		t.Fatalf("unmarshal all notes: %v", err)
	}

	if len(allNotes) != 1 || allNotes[0].State != "archived" {
		t.Fatalf("expected archived note in state=all list, got %#v", allNotes)
	}

	restoreReq := httptest.NewRequest(http.MethodPost, "/api/notes/linear-algebra/restore", nil)
	restoreRec := httptest.NewRecorder()
	server.ServeHTTP(restoreRec, restoreReq)

	if restoreRec.Code != http.StatusOK {
		t.Fatalf("status mismatch for restore: got %d want %d", restoreRec.Code, http.StatusOK)
	}

	var restored Note
	if err := json.Unmarshal(restoreRec.Body.Bytes(), &restored); err != nil {
		t.Fatalf("unmarshal restored note: %v", err)
	}

	if restored.State != "active" {
		t.Fatalf("state mismatch after restore: got %q want %q", restored.State, "active")
	}

	finalListReq := httptest.NewRequest(http.MethodGet, "/api/notes", nil)
	finalListRec := httptest.NewRecorder()
	server.ServeHTTP(finalListRec, finalListReq)

	if finalListRec.Code != http.StatusOK {
		t.Fatalf("status mismatch for list after restore: got %d want %d", finalListRec.Code, http.StatusOK)
	}

	var finalNotes []Note
	if err := json.Unmarshal(finalListRec.Body.Bytes(), &finalNotes); err != nil {
		t.Fatalf("unmarshal note list after restore: %v", err)
	}

	if len(finalNotes) != 1 || finalNotes[0].ID != "linear-algebra" {
		t.Fatalf("expected restored note in default list, got %#v", finalNotes)
	}
}

func TestFolderFlowSupportsOptionalOrganization(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	server := NewServer(NewFileStore(dir), embed.FS{})

	folderID := createFolder(t, server, "Math")

	putNoteWithFolder(t, server, "algebra-1", "Algebra 1", "# Algebra 1\n\nSee [[vectors]].", folderID)

	note := getNote(t, server, "algebra-1")
	if note.FolderID == nil || *note.FolderID != folderID {
		t.Fatalf("folder mismatch after assignment: got %#v want %q", note.FolderID, folderID)
	}

	folders := listFolders(t, server)
	if len(folders) != 1 || folders[0].ID != folderID {
		t.Fatalf("folder list mismatch: got %#v", folders)
	}

	deleteReq := httptest.NewRequest(http.MethodDelete, "/api/folders/"+folderID, nil)
	deleteRec := httptest.NewRecorder()
	server.ServeHTTP(deleteRec, deleteReq)

	if deleteRec.Code != http.StatusNoContent {
		t.Fatalf("status mismatch for folder delete: got %d want %d", deleteRec.Code, http.StatusNoContent)
	}

	afterDelete := getNote(t, server, "algebra-1")
	if afterDelete.FolderID != nil {
		t.Fatalf("expected note to be orphaned after folder delete, got %#v", afterDelete.FolderID)
	}
}

func createFolder(t *testing.T, server *Server, name string) string {
	t.Helper()

	body := map[string]string{"name": name}
	rawBody, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal folder body: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/folders", bytes.NewReader(rawBody))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	server.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("status mismatch for folder create: got %d want %d", rec.Code, http.StatusCreated)
	}

	var folder Folder
	if err := json.Unmarshal(rec.Body.Bytes(), &folder); err != nil {
		t.Fatalf("unmarshal folder create: %v", err)
	}

	if folder.ID == "" {
		t.Fatalf("expected folder id to be set")
	}

	return folder.ID
}

func putNoteWithFolder(t *testing.T, server *Server, id, title, content, folderID string) {
	t.Helper()

	body := map[string]any{
		"title":    title,
		"content":  content,
		"folderId": folderID,
	}

	rawBody, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal put body with folder: %v", err)
	}

	req := httptest.NewRequest(http.MethodPut, "/api/notes/"+id, bytes.NewReader(rawBody))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	server.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status mismatch for put note with folder %q: got %d want %d", id, rec.Code, http.StatusNoContent)
	}
}

func getNote(t *testing.T, server *Server, id string) Note {
	t.Helper()

	req := httptest.NewRequest(http.MethodGet, "/api/notes/"+id, nil)
	rec := httptest.NewRecorder()
	server.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status mismatch for get note %q: got %d want %d", id, rec.Code, http.StatusOK)
	}

	var note Note
	if err := json.Unmarshal(rec.Body.Bytes(), &note); err != nil {
		t.Fatalf("unmarshal note %q: %v", id, err)
	}

	return note
}

func listFolders(t *testing.T, server *Server) []Folder {
	t.Helper()

	req := httptest.NewRequest(http.MethodGet, "/api/folders", nil)
	rec := httptest.NewRecorder()
	server.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status mismatch for folder list: got %d want %d", rec.Code, http.StatusOK)
	}

	var folders []Folder
	if err := json.Unmarshal(rec.Body.Bytes(), &folders); err != nil {
		t.Fatalf("unmarshal folder list: %v", err)
	}

	return folders
}

func putNote(t *testing.T, server *Server, id, title, content string) {
	t.Helper()

	body := map[string]string{
		"title":   title,
		"content": content,
	}

	rawBody, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal put body: %v", err)
	}

	req := httptest.NewRequest(http.MethodPut, "/api/notes/"+id, bytes.NewReader(rawBody))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	server.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status mismatch for put %q: got %d want %d", id, rec.Code, http.StatusNoContent)
	}
}
