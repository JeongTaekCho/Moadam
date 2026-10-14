SHELL := /bin/sh
PYTHON ?= python3.12
RAG_PYTHON ?= $(CURDIR)/rag/.venv/bin/python
MVN ?= mvn

.PHONY: setup format check test qa frontend-check backend-check rag-check conventions api-types

setup:
	cd frontend && pnpm install --frozen-lockfile
	$(PYTHON) -m venv rag/.venv
	$(RAG_PYTHON) -m pip install -r rag/requirements-dev.txt

format:
	cd frontend && pnpm format
	cd frontend && pnpm exec prettier --write ../AGENTS.md ../backend/AGENTS.md ../rag/AGENTS.md ../supabase/AGENTS.md ../docs/development/*.md ../.github/workflows/*.yml ../scripts/*.mjs
	cd backend && $(MVN) spotless:apply
	$(RAG_PYTHON) -m ruff check rag scripts --config rag/pyproject.toml --fix
	$(RAG_PYTHON) -m ruff format rag scripts --config rag/pyproject.toml

check: frontend-check backend-check rag-check conventions

frontend-check:
	cd frontend && pnpm check
	cd frontend && pnpm exec prettier --check ../AGENTS.md ../backend/AGENTS.md ../rag/AGENTS.md ../supabase/AGENTS.md ../docs/development/*.md ../.github/workflows/*.yml ../scripts/*.mjs

backend-check:
	cd backend && $(MVN) spotless:check

rag-check:
	$(RAG_PYTHON) -m ruff check rag scripts --config rag/pyproject.toml
	$(RAG_PYTHON) -m ruff format --check rag scripts --config rag/pyproject.toml

conventions:
	$(RAG_PYTHON) scripts/check-conventions.py
	$(RAG_PYTHON) scripts/check-migrations.py
	$(RAG_PYTHON) scripts/check-rag-dependencies.py

test:
	cd frontend && pnpm test:cache && pnpm test:ai-usage && pnpm test:markdown && pnpm test:db && pnpm test:events
	cd backend && $(MVN) verify
	cd rag && $(RAG_PYTHON) -m unittest discover -s tests -v

qa:
	cd frontend && pnpm build && pnpm test:oauth && pnpm test:chat-stream && pnpm test:ai-errors && pnpm test:performance && pnpm test:events-ui && pnpm test:discussion-ui && pnpm test:documents-ui

api-types:
	cd backend && $(MVN) -Dtest=ContractTest -DexportOpenApi=true test
	cd frontend && pnpm api:types
