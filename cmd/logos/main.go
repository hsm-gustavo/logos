package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/hsm-gustavo/logos/frontend"
	"github.com/hsm-gustavo/logos/internal/logos"
)

func main() {
	storeKind := os.Getenv("LOGOS_STORE")
	if storeKind == "" {
		storeKind = "sqlite"
	}

	var store logos.Store
	switch storeKind {
	case "file":
		dataDir := os.Getenv("LOGOS_DATA_DIR")
		if dataDir == "" {
			dataDir = "./data/notes"
		}
		store = logos.NewFileStore(dataDir)
		log.Printf("using file store at %s", dataDir)
	default:
		dbPath := os.Getenv("LOGOS_DB_PATH")
		if dbPath == "" {
			dbPath = "./data/logos.db"
		}

		if err := os.MkdirAll(filepath.Dir(dbPath), 0o755); err != nil {
			log.Fatal(err)
		}

		sqliteStore, err := logos.NewSQLiteStore(dbPath)
		if err != nil {
			log.Fatal(err)
		}

		existingNotes, err := sqliteStore.List(context.Background())
		if err != nil {
			log.Fatal(err)
		}

		if len(existingNotes) == 0 {
			migrateDir := os.Getenv("LOGOS_MIGRATE_FROM_DIR")
			if migrateDir == "" {
				migrateDir = "./data/notes"
			}

			if err := logos.MigrateFileStoreToStore(context.Background(), migrateDir, sqliteStore); err != nil {
				log.Printf("migration skipped: %v", err)
			} else {
				log.Printf("migration completed from %s", migrateDir)
			}
		}

		store = sqliteStore
		log.Printf("using sqlite store at %s", dbPath)
	}
	server := logos.NewServer(store, frontend.FrontendFS)

	addr := ":8080"
	log.Printf("Logos backend listening on %s", addr)
	if err := http.ListenAndServe(addr, server); err != nil {
		log.Fatal(err)
	}
}
