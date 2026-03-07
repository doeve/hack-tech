#!/usr/bin/env bash
# seed.sh — Seed the database with schema and initial data.
# Usage: ./seed.sh
#
# Requires PostgreSQL to be running (start with: docker compose up -d)

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
VENV_DIR="$BACKEND_DIR/.venv"

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[seed]${NC} $*"; }
err() { echo -e "${RED}[seed]${NC} $*" >&2; }

cd "$PROJECT_DIR"

# Ensure postgres is running
if ! docker compose exec -T postgres pg_isready -U postgres >/dev/null 2>&1; then
    log "Starting PostgreSQL..."
    docker compose up -d
    for i in {1..15}; do
        if docker compose exec -T postgres pg_isready -U postgres >/dev/null 2>&1; then
            break
        fi
        if [ "$i" -eq 15 ]; then
            err "PostgreSQL not ready after 15s — is Docker running?"
            exit 1
        fi
        sleep 1
    done
fi
log "PostgreSQL is ready."

# Ensure venv + deps
if [ ! -d "$VENV_DIR" ]; then
    log "Creating Python venv..."
    python3 -m venv "$VENV_DIR"
fi
source "$VENV_DIR/Scripts/activate"
pip install -q -r "$BACKEND_DIR/requirements.txt"

# Run seed
log "Seeding database with schema_v3.sql..."
cd "$BACKEND_DIR"
python seed.py

log "Done! Demo credentials: demo / hackathon2024"
