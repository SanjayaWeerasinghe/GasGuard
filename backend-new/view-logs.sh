#!/bin/bash

# GasGuard Log Viewer
# Interactive log viewer for backend logs

LOGS_DIR="/home/GasGuard/backend-new/logs"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

show_menu() {
    clear
    echo -e "${CYAN}=====================================================================${NC}"
    echo -e "${CYAN}                  GasGuard Log Viewer${NC}"
    echo -e "${CYAN}=====================================================================${NC}"
    echo ""
    echo -e "${GREEN}Select log to view:${NC}"
    echo ""
    echo "  1) Main Log (gasguard.log)        - All system activity"
    echo "  2) Predictions Log                - ML predictions only"
    echo "  3) Alerts Log                     - Alerts created"
    echo "  4) View All Logs (Combined)"
    echo "  5) Tail Main Log (Live)"
    echo "  6) Tail Predictions (Live)"
    echo "  7) Clear All Logs"
    echo "  8) Exit"
    echo ""
}

view_log() {
    local logfile=$1
    local title=$2

    if [ ! -f "$logfile" ]; then
        echo -e "${YELLOW}Log file not found: $logfile${NC}"
        echo "No logs generated yet. Run the backend and simulator first."
        return
    fi

    clear
    echo -e "${CYAN}=====================================================================${NC}"
    echo -e "${CYAN}$title${NC}"
    echo -e "${CYAN}=====================================================================${NC}"
    echo ""

    cat "$logfile"

    echo ""
    echo -e "${CYAN}=====================================================================${NC}"
    echo "Total lines: $(wc -l < "$logfile")"
    echo ""
}

tail_log() {
    local logfile=$1
    local title=$2

    if [ ! -f "$logfile" ]; then
        echo -e "${YELLOW}Log file not found: $logfile${NC}"
        echo "No logs generated yet. Run the backend and simulator first."
        read -p "Press Enter to continue..."
        return
    fi

    clear
    echo -e "${CYAN}=====================================================================${NC}"
    echo -e "${CYAN}$title (Live) - Press Ctrl+C to stop${NC}"
    echo -e "${CYAN}=====================================================================${NC}"
    echo ""

    tail -f "$logfile"
}

clear_logs() {
    echo -e "${YELLOW}Are you sure you want to clear all logs? (y/n)${NC}"
    read -r response

    if [[ "$response" == "y" || "$response" == "Y" ]]; then
        rm -f "$LOGS_DIR"/*.log
        echo -e "${GREEN}All logs cleared!${NC}"
    else
        echo "Cancelled."
    fi
}

# Main loop
while true; do
    show_menu
    read -p "Select an option (1-8): " choice

    case $choice in
        1)
            view_log "$LOGS_DIR/gasguard.log" "Main System Log"
            read -p "Press Enter to continue..."
            ;;
        2)
            view_log "$LOGS_DIR/predictions.log" "ML Predictions Log"
            read -p "Press Enter to continue..."
            ;;
        3)
            view_log "$LOGS_DIR/alerts.log" "Alerts Log"
            read -p "Press Enter to continue..."
            ;;
        4)
            clear
            echo -e "${CYAN}=====================================================================${NC}"
            echo -e "${CYAN}Combined Logs (Chronological)${NC}"
            echo -e "${CYAN}=====================================================================${NC}"
            echo ""
            if [ -d "$LOGS_DIR" ]; then
                cat "$LOGS_DIR"/*.log 2>/dev/null | sort
            else
                echo "No logs directory found"
            fi
            echo ""
            read -p "Press Enter to continue..."
            ;;
        5)
            tail_log "$LOGS_DIR/gasguard.log" "Main System Log"
            ;;
        6)
            tail_log "$LOGS_DIR/predictions.log" "ML Predictions Log"
            ;;
        7)
            clear_logs
            read -p "Press Enter to continue..."
            ;;
        8)
            echo -e "${GREEN}Goodbye!${NC}"
            exit 0
            ;;
        *)
            echo -e "${YELLOW}Invalid option${NC}"
            sleep 1
            ;;
    esac
done
