.PHONY: help install dev build test test-watch test-one typecheck check ci sweep sweep-baseline preview clean

# Balance sweep size (seeds per cell) and output path.
SWEEP_N ?= 100
SWEEP_OUT ?= /tmp/balance_sweep.txt

help: ## Show this help
	@grep -E '^[a-z-]+: .*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ": .*## "}; {printf "  %-14s %s\n", $$1, $$2}'

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

test-one: ## Run a single test file: make test-one F=src/game/rules/healing.test.ts
	@test -n "$(F)" || { echo "usage: make test-one F=<path/to/file.test.ts>"; exit 1; }
	npx vitest run $(F)

typecheck: ## Typecheck only
	npm run typecheck

check: ## Typecheck + full test suite (local CI gate)
	npm run typecheck
	npm test

ci: ## Clean install from lockfile + typecheck + tests (CI entrypoint)
	npm ci
	npm run typecheck
	npm test

sweep: ## Balance self-play sweep (SWEEP_N=100 -> /tmp/balance_sweep.txt; override SWEEP_N=/SWEEP_OUT=)
	SWEEP_N=$(SWEEP_N) SWEEP_OUT=$(SWEEP_OUT) npx vitest run src/game/ai/balanceSweep.test.ts

sweep-baseline: ## Regenerate the committed sweep report (specs/balance_sweep_baseline.txt)
	SWEEP_N=100 SWEEP_OUT=specs/balance_sweep_baseline.txt npx vitest run src/game/ai/balanceSweep.test.ts

preview: ## Preview production build
	npm run preview

clean: ## Remove build artifacts
	rm -rf dist coverage
