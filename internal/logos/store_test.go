package logos

import (
	"context"
	"path/filepath"
	"strings"
	"testing"
)

func TestFileStoreSaveAndRead(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	store := NewFileStore(dir)

	note := Note{
		ID:      "linear-algebra",
		Title:   "Linear Algebra",
		Content: "# Linear Algebra\n\nSee [[vectors]] and [[matrices]].",
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

	if len(got.Links) != 2 {
		t.Fatalf("links len mismatch: got %d want 2", len(got.Links))
	}

	expectedPath := filepath.Join(dir, note.ID+".md")
	if got.Path != expectedPath {
		t.Fatalf("path mismatch: got %q want %q", got.Path, expectedPath)
	}
}

func TestFileStoreListSortedByUpdatedAt(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	store := NewFileStore(dir)

	if err := store.Save(context.Background(), Note{ID: "b-note", Title: "B", Content: "# B"}); err != nil {
		t.Fatalf("save b-note: %v", err)
	}

	if err := store.Save(context.Background(), Note{ID: "a-note", Title: "A", Content: "# A"}); err != nil {
		t.Fatalf("save a-note: %v", err)
	}

	list, err := store.List(context.Background())
	if err != nil {
		t.Fatalf("list notes: %v", err)
	}

	if len(list) != 2 {
		t.Fatalf("list len mismatch: got %d want 2", len(list))
	}

	if list[0].ID != "a-note" || list[1].ID != "b-note" {
		t.Fatalf("list order mismatch: got [%s, %s]", list[0].ID, list[1].ID)
	}
}

func TestFileStoreSaveUpdatesBacklinksOnTitleRename(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	store := NewFileStore(dir)
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

func TestFileStoreSearchRanksTitleBeforeContent(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	store := NewFileStore(dir)
	ctx := context.Background()

	if err := store.Save(ctx, Note{ID: "calculus", Content: "# Calculus\n\nLimits and derivatives."}); err != nil {
		t.Fatalf("save calculus note: %v", err)
	}

	if err := store.Save(ctx, Note{ID: "physics", Content: "# Physics\n\nThis note references calculus in the content."}); err != nil {
		t.Fatalf("save physics note: %v", err)
	}

	results, err := store.Search(ctx, "calc", 20)
	if err != nil {
		t.Fatalf("search notes: %v", err)
	}

	if len(results) < 2 {
		t.Fatalf("expected at least 2 results, got %d", len(results))
	}

	if results[0].Note.ID != "calculus" {
		t.Fatalf("expected title match first, got %q", results[0].Note.ID)
	}
}

func TestFileStorePersistsNoteStateAndRestore(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	store := NewFileStore(dir)
	ctx := context.Background()

	if err := store.Save(ctx, Note{ID: "archivable", Title: "Archivable", Content: "# Archivable", State: "archived"}); err != nil {
		t.Fatalf("save archived note: %v", err)
	}

	got, err := store.Get(ctx, "archivable")
	if err != nil {
		t.Fatalf("get archived note: %v", err)
	}

	if got.State != "archived" {
		t.Fatalf("state mismatch after archive: got %q want %q", got.State, "archived")
	}

	if err := store.Save(ctx, Note{ID: "archivable", Title: "Archivable", Content: "# Archivable", State: "active"}); err != nil {
		t.Fatalf("save restored note: %v", err)
	}

	restored, err := store.Get(ctx, "archivable")
	if err != nil {
		t.Fatalf("get restored note: %v", err)
	}

	if restored.State != "active" {
		t.Fatalf("state mismatch after restore: got %q want %q", restored.State, "active")
	}
}

func TestFileStoreFolderCRUDAndOrphaning(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	store := NewFileStore(dir)
	ctx := context.Background()

	folder := Folder{ID: "math", Name: "Math"}
	if err := store.SaveFolder(ctx, folder); err != nil {
		t.Fatalf("save folder: %v", err)
	}

	gotFolder, err := store.GetFolder(ctx, "math")
	if err != nil {
		t.Fatalf("get folder: %v", err)
	}

	if gotFolder.ID != "math" || gotFolder.Name != "Math" {
		t.Fatalf("folder mismatch: got %#v", gotFolder)
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

	folders, err := store.ListFolders(ctx)
	if err != nil {
		t.Fatalf("list folders: %v", err)
	}

	if len(folders) != 0 {
		t.Fatalf("expected folder list empty, got %#v", folders)
	}
}
