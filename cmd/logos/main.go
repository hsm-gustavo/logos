package main

import (
	"log"
	"net/http"
	"os"

	"github.com/hsm-gustavo/logos/internal/logos"
)

func main() {
	dataDir := os.Getenv("LOGOS_DATA_DIR")
	if dataDir == "" {
		dataDir = "./data/notes"
	}

	store := logos.NewFileStore(dataDir)
	server := logos.NewServer(store)

	addr := ":8080"
	log.Printf("Logos backend listening on %s", addr)
	if err := http.ListenAndServe(addr, server); err != nil {
		log.Fatal(err)
	}
}
