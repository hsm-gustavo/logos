package logos

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"
	"testing"
)

func TestSQLiteStoreSaveAndRead(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	dbPath := filepath.Join(dir, "logos.db")
	store, err := NewSQLiteStore(dbPath)
	if err != nil {
		t.Fatalf("new sqlite store: %v", err)
	}

	note := Note{
		ID:      "s9k1z2",
		Title:   "\u00c1lgebra Linear",
		Content: "# \u00c1lgebra Linear\n\nSee [[C\u00e1lculo I]].",
	}

	if err := store.Save(context.Background(), note); err != nil {
		t.Fatalf("save note: %v", err)
	}

	got, err := store.Get(context.Background(), note.ID)
	if err != nil {
		t.Fatalf("get note: %v", err)
	}

	if got.ID != note.ID {
		t.Fatalf("id mismatch: got %q want %q", got.ID, note.ID)
	}

	if got.Title != "\u00c1lgebra Linear" {
		t.Fatalf("title mismatch: got %q", got.Title)
	}

	if len(got.Links) != 1 || got.Links[0] != "C\u00e1lculo I" {
		t.Fatalf("links mismatch: got %#v", got.Links)
	}
}

func TestSQLiteStoreSaveUpdatesBacklinksOnTitleRename(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	dbPath := filepath.Join(dir, "logos.db")
	store, err := NewSQLiteStore(dbPath)
	if err != nil {
		t.Fatalf("new sqlite store: %v", err)
	}
	ctx := context.Background()

	target := Note{
		ID:      "n1abc",
		Title:   "\u00c1lgebra Linear",
		Content: "# \u00c1lgebra Linear\n\nBase note.",
	}

	ref := Note{
		ID:      "n2xyz",
		Title:   "Reference",
		Content: "# Reference\n\nSee [[\u00c1lgebra Linear]].",
	}

	if err := store.Save(ctx, target); err != nil {
		t.Fatalf("save target: %v", err)
	}

	if err := store.Save(ctx, ref); err != nil {
		t.Fatalf("save ref: %v", err)
	}

	target.Content = "# Algebra Linear Revisao\n\nUpdated."
	target.Title = "Algebra Linear Revisao"
	if err := store.Save(ctx, target); err != nil {
		t.Fatalf("save renamed target: %v", err)
	}

	gotRef, err := store.Get(ctx, ref.ID)
	if err != nil {
		t.Fatalf("get ref: %v", err)
	}

	if !strings.Contains(gotRef.Content, "[[Algebra Linear Revisao]]") {
		t.Fatalf("expected backlink update, got content: %q", gotRef.Content)
	}

	if strings.Contains(gotRef.Content, "[[\u00c1lgebra Linear]]") {
		t.Fatalf("old backlink should be removed, got content: %q", gotRef.Content)
	}
}

func TestSQLiteStoreSearchAppliesDefaultAndMaxLimit(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	dbPath := filepath.Join(dir, "logos.db")
	store, err := NewSQLiteStore(dbPath)
	if err != nil {
		t.Fatalf("new sqlite store: %v", err)
	}
	ctx := context.Background()

	for i := 1; i <= 60; i++ {
		title := fmt.Sprintf("Calc Note %d", i)
		note := Note{
			ID:      fmt.Sprintf("calc-%d", i),
			Title:   title,
			Content: fmt.Sprintf("# %s\n\nBody", title),
		}
		if err := store.Save(ctx, note); err != nil {
			t.Fatalf("save note %d: %v", i, err)
		}
	}

	defaultResults, err := store.Search(ctx, "calc", 0)
	if err != nil {
		t.Fatalf("search with default limit: %v", err)
	}

	if len(defaultResults) != 20 {
		t.Fatalf("default limit mismatch: got %d want %d", len(defaultResults), 20)
	}

	maxResults, err := store.Search(ctx, "calc", 200)
	if err != nil {
		t.Fatalf("search with max cap: %v", err)
	}

	if len(maxResults) != 50 {
		t.Fatalf("max cap mismatch: got %d want %d", len(maxResults), 50)
	}
}

func TestSQLiteStorePersistsArchivedAndActiveState(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	dbPath := filepath.Join(dir, "logos.db")
	store, err := NewSQLiteStore(dbPath)
	if err != nil {
		t.Fatalf("new sqlite store: %v", err)
	}
	ctx := context.Background()

	if err := store.Save(ctx, Note{ID: "archived-note", Title: "Archived Note", Content: "# Archived Note", State: "archived"}); err != nil {
		t.Fatalf("save archived note: %v", err)
	}

	archived, err := store.Get(ctx, "archived-note")
	if err != nil {
		t.Fatalf("get archived note: %v", err)
	}

	if archived.State != "archived" {
		t.Fatalf("archived state mismatch: got %q want %q", archived.State, "archived")
	}

	if err := store.Save(ctx, Note{ID: "archived-note", Title: "Archived Note", Content: "# Archived Note", State: "active"}); err != nil {
		t.Fatalf("restore active note: %v", err)
	}

	restored, err := store.Get(ctx, "archived-note")
	if err != nil {
		t.Fatalf("get restored note: %v", err)
	}

	if restored.State != "active" {
		t.Fatalf("restored state mismatch: got %q want %q", restored.State, "active")
	}
}

func TestSQLiteStoreFolderCRUDAndOrphaning(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	dbPath := filepath.Join(dir, "logos.db")
	store, err := NewSQLiteStore(dbPath)
	if err != nil {
		t.Fatalf("new sqlite store: %v", err)
	}
	ctx := context.Background()

	folder := Folder{ID: "math", Name: "Math"}
	if err := store.SaveFolder(ctx, folder); err != nil {
		t.Fatalf("save folder: %v", err)
	}

	folders, err := store.ListFolders(ctx)
	if err != nil {
		t.Fatalf("list folders: %v", err)
	}

	if len(folders) != 1 || folders[0].ID != "math" {
		t.Fatalf("folder list mismatch: got %#v", folders)
	}

	if err := store.Save(ctx, Note{ID: "algebra-1", Title: "Algebra 1", Content: "# Algebra 1", FolderID: &folder.ID}); err != nil {
		t.Fatalf("save note with folder: %v", err)
	}

	if err := store.DeleteFolder(ctx, "math"); err != nil {
		t.Fatalf("delete folder: %v", err)
	}

	orphaned, err := store.Get(ctx, "algebra-1")
	if err != nil {
		t.Fatalf("get orphaned note: %v", err)
	}

	if orphaned.FolderID != nil {
		t.Fatalf("expected orphaned note folder to be nil, got %#v", orphaned.FolderID)
	}
}
