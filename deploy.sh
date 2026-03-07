#!/usr/bin/env bash
# deploy.sh — Pull latest code, rebuild frontend, restart backend, reload nginx.
# Usage: ./deploy.sh
# Must be run from the project root: /home/dave/projects/hack-tech
# Requires sudo for nginx reload and frontend copy.

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
VENV_DIR="$BACKEND_DIR/.venv"
DEPLOY_DIR="/var/www/airport-companion"
UVICORN_PORT_MAIN=8000
UVICORN_PORT_DEBUG=8080

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[deploy]${NC} $*"; }
warn() { echo -e "${YELLOW}[deploy]${NC} $*"; }
err()  { echo -e "${RED}[deploy]${NC} $*" >&2; }

cd "$PROJECT_DIR"

# 1. Git pull
log "Pulling latest code..."
git pull --ff-only || { err "git pull failed — resolve conflicts first"; exit 1; }

# 2. Backend dependencies
log "Installing backend dependencies..."
if [ ! -d "$VENV_DIR" ]; then
    python3 -m venv "$VENV_DIR"
fi
source "$VENV_DIR/bin/activate"
pip install -q -r "$BACKEND_DIR/requirements.txt"

# 3. Frontend build
log "Installing frontend dependencies..."
cd "$FRONTEND_DIR"
npm install --silent
log "Building frontend..."
npm run build
cd "$PROJECT_DIR"

# 4. Deploy frontend to nginx root
log "Deploying frontend build to $DEPLOY_DIR..."
sudo mkdir -p "$DEPLOY_DIR"
sudo rm -rf "$DEPLOY_DIR"/*
sudo cp -r "$FRONTEND_DIR/dist/"* "$DEPLOY_DIR/"
log "Frontend deployed."

# 5. Reload nginx
log "Testing and reloading nginx..."
sudo nginx -t && sudo systemctl reload nginx
log "nginx reloaded."

# 6. Restart backend (kill old uvicorn processes, start new ones)
log "Restarting backend..."

# Kill existing uvicorn processes on our ports
for port in $UVICORN_PORT_MAIN $UVICORN_PORT_DEBUG; do
    pid=$(lsof -ti tcp:"$port" 2>/dev/null || true)
    if [ -n "$pid" ]; then
        log "Stopping uvicorn on port $port (PID $pid)..."
        kill "$pid" 2>/dev/null || true
        sleep 1
        # Force kill if still alive
        kill -9 "$pid" 2>/dev/null || true
    fi
done

sleep 1

# Start uvicorn on both ports
source "$VENV_DIR/bin/activate"
cd "$BACKEND_DIR"

nohup uvicorn main:app --host 0.0.0.0 --port $UVICORN_PORT_MAIN \
    > "$PROJECT_DIR/uvicorn-main.log" 2>&1 &
log "Started uvicorn on port $UVICORN_PORT_MAIN (PID $!)"

nohup uvicorn main:app --host 0.0.0.0 --port $UVICORN_PORT_DEBUG \
    > "$PROJECT_DIR/uvicorn-debug.log" 2>&1 &
log "Started uvicorn on port $UVICORN_PORT_DEBUG (PID $!)"

cd "$PROJECT_DIR"

# 7. Verify
sleep 2
FAIL=0
for port in $UVICORN_PORT_MAIN $UVICORN_PORT_DEBUG; do
    if ss -tlnp | grep -q ":$port "; then
        log "Port $port: OK"
    else
        err "Port $port: NOT LISTENING"
        FAIL=1
    fi
done

if [ $FAIL -eq 0 ]; then
    echo ""
    log "Deploy complete!"
    log "  https://d3v.ninja/           — App (HTTPS)"
    log "  http://109.102.207.134:8080/docs — Swagger (HTTP)"
else
    err "Deploy finished with errors — check logs:"
    err "  $PROJECT_DIR/uvicorn-main.log"
    err "  $PROJECT_DIR/uvicorn-debug.log"
    exit 1
fi
