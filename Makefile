# ─────────────────────────────────────────────────────────────────────────────
# juery.fr — Hugo site Makefile
# Run `make` or `make help` to list every target.
# ─────────────────────────────────────────────────────────────────────────────

# Pin the Hugo version used locally and in CI so builds are reproducible.
HUGO_VERSION ?= 0.161.1

# Local dev server settings (override on the CLI, e.g. `make serve PORT=8080`).
PORT         ?= 1313
BIND         ?= 127.0.0.1
BASEURL      ?= https://juery.fr/

HUGO         := hugo
PUBLIC_DIR   := public
THEME_DIR    := themes/modeline

# Use bash so recipes can rely on pipefail etc.
SHELL        := bash
.SHELLFLAGS  := -eu -o pipefail -c

.DEFAULT_GOAL := help

# ── Meta ─────────────────────────────────────────────────────────────────────

.PHONY: help
help: ## Show this help
	@echo "juery.fr — available targets:"
	@echo ""
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Variables: HUGO_VERSION=$(HUGO_VERSION)  PORT=$(PORT)  BASEURL=$(BASEURL)"

.PHONY: version
version: ## Print the installed and pinned Hugo versions
	@echo "pinned:    $(HUGO_VERSION)"
	@echo -n "installed: "; $(HUGO) version

.PHONY: check-hugo
check-hugo: ## Verify Hugo (extended) is installed
	@command -v $(HUGO) >/dev/null 2>&1 || { \
		echo "✗ hugo not found. Install the EXTENDED edition:"; \
		echo "    brew install hugo            # macOS"; \
		echo "    https://gohugo.io/installation/  # other platforms"; \
		exit 1; }
	@$(HUGO) version | grep -q extended || { \
		echo "✗ hugo is installed but NOT the extended edition (required for asset processing)."; \
		exit 1; }
	@echo "✓ hugo extended is installed"

# ── Development ───────────────────────────────────────────────────────────────

.PHONY: serve
serve: check-hugo ## Run the live-reload dev server (drafts + future posts shown)
	$(HUGO) server \
		--port $(PORT) --bind $(BIND) \
		--buildDrafts --buildFuture --navigateToChanged \
		--disableFastRender

.PHONY: serve-prod
serve-prod: check-hugo ## Preview a production build locally (no drafts)
	$(HUGO) server --port $(PORT) --bind $(BIND) --environment production

.PHONY: new
new: check-hugo ## Scaffold a new post: make new SLUG=my-post-title [MONTH=YYYY-MM]
	@test -n "$(SLUG)" || { echo "Usage: make new SLUG=my-post-title [MONTH=YYYY-MM]"; exit 1; }
	$(eval MONTH ?= $(shell date +%Y-%m))
	$(HUGO) new content posts/$(MONTH)/$(SLUG).md
	@echo "✓ created content/posts/$(MONTH)/$(SLUG).md (draft)"

# ── Build ─────────────────────────────────────────────────────────────────────

.PHONY: build
build: check-hugo clean ## Production build into ./public
	$(HUGO) --gc --minify --environment production --baseURL "$(BASEURL)"
	@echo "✓ built into $(PUBLIC_DIR)/"

.PHONY: build-preview
build-preview: check-hugo clean ## Build including drafts/future (for staging previews)
	$(HUGO) --gc --minify --buildDrafts --buildFuture --baseURL "$(BASEURL)"

# ── Quality ───────────────────────────────────────────────────────────────────

.PHONY: check
check: check-hugo ## Fail the build on broken refs / template errors (CI gate)
	$(HUGO) --gc --minify --environment production \
		--baseURL "$(BASEURL)" \
		--panicOnWarning --printPathWarnings
	@echo "✓ no warnings or broken references"

.PHONY: lint
lint: check ## Alias for `check`

# ── Housekeeping ──────────────────────────────────────────────────────────────

.PHONY: clean
clean: ## Remove build output and generated resources
	rm -rf $(PUBLIC_DIR) resources/_gen .hugo_build.lock
	@echo "✓ cleaned"

.PHONY: update-theme
update-theme: ## Pull the latest theme if it is a git submodule
	@if [ -f .gitmodules ]; then \
		git submodule update --remote --merge; \
		echo "✓ submodules updated"; \
	else \
		echo "· $(THEME_DIR) is vendored (no submodule) — nothing to update"; \
	fi

.PHONY: stats
stats: ## Count content files and words
	@echo "posts:   $$(find content/posts -name '*.md' -not -name '_index.md' | wc -l | tr -d ' ')"
	@echo "pages:   $$(find content -name '*.md' -not -path '*/posts/*' -not -name '_index.md' | wc -l | tr -d ' ')"
	@echo "words:   $$(cat content/**/*.md content/*.md 2>/dev/null | wc -w | tr -d ' ')"
