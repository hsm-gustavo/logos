package logos

import (
	"context"
	"path/filepath"
	"testing"
)

func TestMigrateFileStoreToStore(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	fileDir := t.TempDir()
	fileStore := NewFileStore(fileDir)

	if err := fileStore.Save(ctx, Note{
		ID:      "calculo-i",
		Title:   "Cálculo I",
		Content: "# Cálculo I\n\nLink [[Álgebra Linear]].",
	}); err != nil {
		t.Fatalf("seed file note: %v", err)
	}

	dbPath := filepath.Join(t.TempDir(), "logos.db")
	sqliteStore, err := NewSQLiteStore(dbPath)
	if err != nil {
		t.Fatalf("new sqlite store: %v", err)
	}

	if err := MigrateFileStoreToStore(ctx, fileDir, sqliteStore); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	got, err := sqliteStore.Get(ctx, "calculo-i")
	if err != nil {
		t.Fatalf("get migrated note: %v", err)
	}

	if got.Title != "Cálculo I" {
		t.Fatalf("title mismatch: got %q", got.Title)
	}

	if len(got.Links) != 1 || got.Links[0] != "Álgebra Linear" {
		t.Fatalf("links mismatch: got %#v", got.Links)
	}
}
