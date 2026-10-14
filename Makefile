.PHONY: help install dev build test test-watch typecheck preview clean

help: ## Show this help
	@grep -E '^[a-z-]+: .*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ": .*## "}; {printf "  %-12s %s\n", $$1, $$2}'

install: ## Install dependencies
	npm install

dev: ## Start dev server
	npm run dev

build: ## Typecheck + production build
	npm run build

test: ## Run tests once
	npm test

test-watch: ## Run tests in watch mode
	npm run test:watch

typecheck: ## Typecheck only
	npm run typecheck

preview: ## Preview production build
	npm run preview

clean: ## Remove build artifacts
	rm -rf dist coverage
