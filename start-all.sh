#!/bin/bash

# =============================================
#  GasGuard - Start All Services
# =============================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# PID tracking
PIDS=()

cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down all services...${NC}"
    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null
        fi
    done
    wait 2>/dev/null
    echo -e "${GREEN}All services stopped.${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

log() {
    echo -e "${CYAN}[$(date '+%H:%M:%S')]${NC} $1"
}

wait_for_service() {
    local url=$1
    local name=$2
    local max_attempts=30

    for i in $(seq 1 $max_attempts); do
        if curl -s "$url" > /dev/null 2>&1; then
            echo -e "  ${GREEN}✓ $name is ready${NC}"
            return 0
        fi
        sleep 1
    done

    echo -e "  ${RED}✗ $name failed to start (timeout)${NC}"
    return 1
}

echo ""
echo -e "${CYAN}=====================================================${NC}"
echo -e "${CYAN}          GasGuard - Starting All Services            ${NC}"
echo -e "${CYAN}=====================================================${NC}"
echo ""

# --------------------------------------------------
# 1. ML Service (Port 5000)
# --------------------------------------------------
log "Starting ML Service (port 5000)..."

cd "$ROOT_DIR/ml-service"
if [ ! -d "venv" ]; then
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirement.txt --quiet
else
    source venv/bin/activate
fi

python app.py > "$ROOT_DIR/logs/ml-service.log" 2>&1 &
PIDS+=($!)
deactivate 2>/dev/null

wait_for_service "http://localhost:5000/health" "ML Service"

# --------------------------------------------------
# 2. Blockchain Service (Port 3002)
# --------------------------------------------------
log "Starting Blockchain Service (port 3002)..."

cd "$ROOT_DIR/blockchain-service"
if [ ! -d "node_modules" ]; then
    npm install --silent
fi

node server.js > "$ROOT_DIR/logs/blockchain.log" 2>&1 &
PIDS+=($!)

wait_for_service "http://localhost:3002/health" "Blockchain Service"

# --------------------------------------------------
# 3. Backend API (Port 3001)
# --------------------------------------------------
log "Starting Backend API (port 3001)..."

cd "$ROOT_DIR/backend-new"
if [ ! -d "node_modules" ]; then
    npm install --silent
fi

node server.js > "$ROOT_DIR/logs/backend.log" 2>&1 &
PIDS+=($!)

wait_for_service "http://localhost:3001/api/health" "Backend API"

# --------------------------------------------------
# 4. Frontend Dashboard (Port 3000)
# --------------------------------------------------
log "Starting Frontend Dashboard (port 3000)..."

cd "$ROOT_DIR/frontend"
if [ ! -d "node_modules" ]; then
    npm install --silent
fi

PORT=3000 BROWSER=none npm start > "$ROOT_DIR/logs/frontend.log" 2>&1 &
PIDS+=($!)

wait_for_service "http://localhost:3000" "Frontend Dashboard"

# --------------------------------------------------
# 5. Simulator Service (Port 5001)
# --------------------------------------------------
log "Starting Simulator Service (port 5001)..."

cd "$ROOT_DIR/simulator-service"
if [ ! -d "venv" ]; then
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt --quiet
else
    source venv/bin/activate
fi

python app.py > "$ROOT_DIR/logs/simulator-service.log" 2>&1 &
PIDS+=($!)
deactivate 2>/dev/null

wait_for_service "http://localhost:5001/health" "Simulator Service"

# --------------------------------------------------
# 6. Scenario Dashboard (Port 3003)
# --------------------------------------------------
log "Starting Scenario Dashboard (port 3003)..."

cd "$ROOT_DIR/scenario-dashboard"
if [ ! -d "node_modules" ]; then
    npm install --silent
fi

PORT=3003 BROWSER=none npm start > "$ROOT_DIR/logs/scenario-dashboard.log" 2>&1 &
PIDS+=($!)

wait_for_service "http://localhost:3003" "Scenario Dashboard"

# --------------------------------------------------
# Summary
# --------------------------------------------------
cd "$ROOT_DIR"

echo ""
echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}          All Services Running                        ${NC}"
echo -e "${GREEN}=====================================================${NC}"
echo ""
echo -e "  ${CYAN}Backend API:${NC}          http://localhost:3001"
echo -e "  ${CYAN}ML Service:${NC}           http://localhost:5000"
echo -e "  ${CYAN}Blockchain Service:${NC}   http://localhost:3002"
echo -e "  ${CYAN}Frontend Dashboard:${NC}   http://localhost:3000"
echo -e "  ${CYAN}Simulator Service:${NC}    http://localhost:5001"
echo -e "  ${CYAN}Scenario Dashboard:${NC}   http://localhost:3003"
echo ""
echo -e "  ${YELLOW}Logs:${NC} $ROOT_DIR/logs/"
echo ""
echo -e "  ${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Keep script alive
wait
