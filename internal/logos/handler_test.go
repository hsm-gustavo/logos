package logos

import (
	"bytes"
	"embed"
	"encoding/json"
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
