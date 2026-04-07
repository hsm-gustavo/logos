ROOT_DIR := $(shell dirname $(realpath $(firstword $(MAKEFILE_LIST))))

run: all
	cd $(ROOT_DIR) && ./logos

frontend:
	cd $(ROOT_DIR)/frontend && pnpm install && pnpm build

server: frontend
	cd $(ROOT_DIR) && go build -o logos cmd/logos/main.go

all: server

clean:
	cd $(ROOT_DIR) && rm -f logos
	cd $(ROOT_DIR)/frontend && rm -rf node_modules dist

.PHONY: frontend server all clean