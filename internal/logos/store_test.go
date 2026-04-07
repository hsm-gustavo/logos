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
