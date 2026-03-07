#!/usr/bin/env bash
# dev.sh — Start all services for local development.
# Usage: ./dev.sh
#
# Starts:
#   1. PostgreSQL (docker compose)
#   2. FastAPI backend with --reload (port 8000)
#   3. Vite dev server (port 5173, proxies /api + /ws to 8000)
#
# Press Ctrl+C to stop all services.

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
VENV_DIR="$BACKEND_DIR/.venv"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[dev]${NC} $*"; }
warn() { echo -e "${YELLOW}[dev]${NC} $*"; }

PIDS=()

cleanup() {
    echo ""
    log "Shutting down..."
    for pid in "${PIDS[@]}"; do
        kill "$pid" 2>/dev/null || true
    done
    wait 2>/dev/null
    log "Done."
}
trap cleanup EXIT INT TERM

cd "$PROJECT_DIR"

# 1. PostgreSQL
log "Starting PostgreSQL..."
docker compose up -d
sleep 1

# Wait for postgres to be ready
for i in {1..15}; do
    if docker compose exec -T postgres pg_isready -U postgres >/dev/null 2>&1; then
        log "PostgreSQL is ready."
        break
    fi
    if [ "$i" -eq 15 ]; then
        warn "PostgreSQL not ready after 15s — continuing anyway."
    fi
    sleep 1
done

# 2. Backend venv
if [ ! -d "$VENV_DIR" ]; then
    log "Creating Python venv..."
    python3 -m venv "$VENV_DIR"
fi
source "$VENV_DIR/bin/activate"
pip install -q -r "$BACKEND_DIR/requirements.txt"

# 3. Frontend deps
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    log "Installing frontend dependencies..."
    cd "$FRONTEND_DIR" && npm install --silent && cd "$PROJECT_DIR"
fi

# 4. Start backend (with reload)
log "Starting FastAPI backend on :8000..."
cd "$BACKEND_DIR"
uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
PIDS+=($!)
cd "$PROJECT_DIR"

# 5. Start frontend dev server
log "Starting Vite dev server on :5173..."
cd "$FRONTEND_DIR"
npm run dev &
PIDS+=($!)
cd "$PROJECT_DIR"

echo ""
log "All services running:"
log "  Frontend:  http://localhost:5173"
log "  Backend:   http://localhost:8000"
log "  Swagger:   http://localhost:8000/docs"
log "  Postgres:  localhost:5432"
echo ""
log "Press Ctrl+C to stop everything."
echo ""

# Wait for any child to exit
wait
