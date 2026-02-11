#!/bin/bash

# GasGuard Demo Launcher
# Run the complete system or individual components

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

show_header() {
    echo -e "${CYAN}=====================================================================${NC}"
    echo -e "${CYAN}                  GasGuard System Launcher${NC}"
    echo -e "${CYAN}=====================================================================${NC}"
    echo ""
}

show_menu() {
    echo -e "${GREEN}Available Options:${NC}"
    echo ""
    echo "  1) Start IoT Simulator        - Send random sensor data continuously"
    echo "  2) Start Monitoring Dashboard  - View real-time system statistics"
    echo "  3) Start Both (Split Screen)  - Simulator + Monitor side by side"
    echo "  4) Run Quick Test             - Send 10 test readings"
    echo "  5) Check System Status        - Verify all services are running"
    echo "  6) View Logs                  - Show backend logs"
    echo "  7) Exit"
    echo ""
}

check_services() {
    echo -e "${YELLOW}Checking services...${NC}"
    echo ""

    # Check ML Service
    if curl -s http://127.0.0.1:5000/health > /dev/null 2>&1; then
        echo -e "  ML Service (Port 5000):    ${GREEN}✓ Running${NC}"
    else
        echo -e "  ML Service (Port 5000):    ${YELLOW}✗ Not running${NC}"
    fi

    # Check Backend
    if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
        echo -e "  Backend (Port 3001):       ${GREEN}✓ Running${NC}"
    else
        echo -e "  Backend (Port 3001):       ${YELLOW}✗ Not running${NC}"
    fi

    echo ""
}

start_simulator() {
    echo -e "${GREEN}Starting IoT Simulator...${NC}"
    echo ""
    python3 "$SCRIPT_DIR/iot-simulator.py"
}

start_monitor() {
    echo -e "${GREEN}Starting Monitoring Dashboard...${NC}"
    echo ""
    python3 "$SCRIPT_DIR/monitor-dashboard.py"
}

start_both() {
    echo -e "${GREEN}Starting Simulator and Monitor...${NC}"
    echo ""
    echo "Opening in tmux split screen..."

    # Check if tmux is available
    if command -v tmux &> /dev/null; then
        tmux new-session \; \
            send-keys "cd $SCRIPT_DIR && python3 iot-simulator.py" C-m \; \
            split-window -h \; \
            send-keys "cd $SCRIPT_DIR && python3 monitor-dashboard.py" C-m \;
    else
        echo -e "${YELLOW}tmux not available. Opening in separate terminals...${NC}"
        python3 "$SCRIPT_DIR/iot-simulator.py" &
        sleep 1
        python3 "$SCRIPT_DIR/monitor-dashboard.py"
    fi
}

quick_test() {
    echo -e "${GREEN}Running Quick Test (10 readings)...${NC}"
    echo ""

    for i in {1..10}; do
        methane=$((RANDOM % 5000 + 100))
        lpg=$((RANDOM % 2000 + 50))
        co=$((RANDOM % 100 + 5))
        h2s=$((RANDOM % 30 + 1))

        echo -e "${CYAN}Test $i/10:${NC} CH4=${methane} LPG=${lpg} CO=${co} H2S=${h2s}"

        response=$(curl -s -X POST http://localhost:3001/api/readings \
            -H "Content-Type: application/json" \
            -d "{\"clientID\":\"TEST_$(printf %03d $i)\",\"gases\":{\"methane\":$methane,\"lpg\":$lpg,\"carbonMonoxide\":$co,\"hydrogenSulfide\":$h2s}}")

        risk=$(echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('reading',{}).get('riskState','ERROR'))" 2>/dev/null)
        echo -e "  Risk: ${YELLOW}$risk${NC}"
        echo ""

        sleep 0.5
    done

    echo -e "${GREEN}✓ Test complete!${NC}"
    echo ""
    echo "Check stats:"
    curl -s http://localhost:3001/api/stats | python3 -m json.tool
}

view_logs() {
    echo -e "${GREEN}Backend logs:${NC}"
    echo ""
    tail -f "$SCRIPT_DIR/backend-new/logs/gasguard.log" 2>/dev/null || echo "No logs found. Start the backend first."
}

# Main menu loop
show_header
check_services

while true; do
    show_menu
    read -p "Select an option (1-7): " choice

    case $choice in
        1)
            start_simulator
            ;;
        2)
            start_monitor
            ;;
        3)
            start_both
            ;;
        4)
            quick_test
            ;;
        5)
            check_services
            ;;
        6)
            view_logs
            ;;
        7)
            echo -e "${GREEN}Goodbye!${NC}"
            exit 0
            ;;
        *)
            echo -e "${YELLOW}Invalid option${NC}"
            ;;
    esac

    echo ""
    read -p "Press Enter to continue..."
done
