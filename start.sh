#!/usr/bin/env bash
# ─── ForgeRoom — Launch All Services ───
# Starts: Orchestrator (:8000), Execution Bridge (:8001), WS Gateway (:8002), Frontend (:3000)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
VENV="$BACKEND_DIR/.venv"
PIDS=()

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

cleanup() {
  echo -e "\n${YELLOW}Shutting down all services...${NC}"
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null
  echo -e "${GREEN}All services stopped.${NC}"
}
trap cleanup EXIT INT TERM

# ─── Check venv ───
if [ ! -d "$VENV" ]; then
  echo -e "${RED}Python venv not found at $VENV${NC}"
  echo "Run: cd $BACKEND_DIR && uv venv && uv pip install -e '.[ai]'"
  exit 1
fi

PYTHON="$VENV/bin/python"
UVICORN="$VENV/bin/uvicorn"

if [ ! -f "$UVICORN" ]; then
  echo -e "${RED}uvicorn not found in venv. Installing...${NC}"
  "$VENV/bin/pip" install -e "$BACKEND_DIR[ai]"
fi

# ─── Load .env ───
if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a
  source "$SCRIPT_DIR/.env"
  set +a
  echo -e "${GREEN}✓ Loaded .env${NC}"
fi

echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║         ForgeRoom — Starting All         ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"

# ─── 1. Orchestrator (:8000) ───
echo -e "${GREEN}[1/4] Starting Orchestrator on :8000${NC}"
cd "$BACKEND_DIR"
"$UVICORN" forgeroom_backend.orchestrator.main:app \
  --host 0.0.0.0 --port 8000 --reload \
  --log-level info &
PIDS+=($!)

# ─── 2. Execution Bridge (:8001) ───
echo -e "${GREEN}[2/4] Starting Execution Bridge on :8001${NC}"
"$UVICORN" forgeroom_backend.execution.main:app \
  --host 0.0.0.0 --port 8001 --reload \
  --log-level info &
PIDS+=($!)

# ─── 3. WebSocket Gateway (:8002) ───
echo -e "${GREEN}[3/4] Starting WebSocket Gateway on :8002${NC}"
"$UVICORN" forgeroom_backend.websocket_gateway.main:app \
  --host 0.0.0.0 --port 8002 --reload \
  --log-level info &
PIDS+=($!)

# ─── 4. Frontend (:3000) ───
echo -e "${GREEN}[4/4] Starting Frontend on :3000${NC}"
cd "$FRONTEND_DIR"
npm run dev &
PIDS+=($!)

echo ""
echo -e "${CYAN}══════════════════════════════════════════${NC}"
echo -e "${GREEN}  Orchestrator:   http://localhost:8000${NC}"
echo -e "${GREEN}  Execution:      http://localhost:8001${NC}"
echo -e "${GREEN}  WebSocket:      ws://localhost:8002${NC}"
echo -e "${GREEN}  Frontend:       http://localhost:3000${NC}"
echo -e "${CYAN}══════════════════════════════════════════${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop all services.${NC}"
echo ""

# Wait for all background processes
wait
