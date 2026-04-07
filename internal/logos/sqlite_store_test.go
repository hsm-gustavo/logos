package logos

import (
	"context"
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
