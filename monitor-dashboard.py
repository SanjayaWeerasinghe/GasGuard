#!/usr/bin/env python3
"""
GasGuard Live Monitoring Dashboard

Displays real-time statistics and recent readings from the backend.
"""

import requests
import time
import os
from datetime import datetime

# Configuration
BACKEND_URL = "http://localhost:3001/api"
REFRESH_INTERVAL = 3  # seconds

# Colors
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    RESET = '\033[0m'
    BOLD = '\033[1m'
    CLEAR = '\033[2J\033[H'

def clear_screen():
    """Clear terminal screen"""
    print(Colors.CLEAR, end='')

def get_health():
    """Get backend health status"""
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=2)
        if response.status_code == 200:
            return response.json()
    except:
        pass
    return None

def get_stats():
    """Get system statistics"""
    try:
        response = requests.get(f"{BACKEND_URL}/stats", timeout=2)
        if response.status_code == 200:
            return response.json().get('stats', {})
    except:
        pass
    return None

def get_recent_readings(limit=10):
    """Get recent sensor readings"""
    try:
        response = requests.get(f"{BACKEND_URL}/readings?limit={limit}", timeout=2)
        if response.status_code == 200:
            return response.json().get('readings', [])
    except:
        pass
    return []

def get_active_alerts():
    """Get active alerts"""
    try:
        response = requests.get(f"{BACKEND_URL}/alerts?status=active", timeout=2)
        if response.status_code == 200:
            return response.json().get('alerts', [])
    except:
        pass
    return []

def format_risk_state(risk_state):
    """Format risk state with color"""
    colors = {
        'NORMAL': Colors.GREEN,
        'LOW_ANOMALY': Colors.YELLOW,
        'UNUSUAL': Colors.YELLOW,
        'ALERT': '\033[38;5;208m',
        'WARNING': Colors.RED,
        'CRITICAL': Colors.RED + Colors.BOLD
    }
    color = colors.get(risk_state, Colors.RESET)
    return f"{color}{risk_state:12s}{Colors.RESET}"

def draw_dashboard():
    """Draw the main dashboard"""
    clear_screen()

    # Header
    print(f"{Colors.BOLD}{Colors.CYAN}{'='*100}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.CYAN}{'GasGuard Live Monitoring Dashboard':^100}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.CYAN}{'='*100}{Colors.RESET}\n")

    # System Health
    health = get_health()
    if health:
        db_status = f"{Colors.GREEN}✓ Connected{Colors.RESET}" if health.get('database', {}).get('connected') else f"{Colors.RED}✗ Disconnected{Colors.RESET}"
        print(f"{Colors.BOLD}System Status:{Colors.RESET}")
        print(f"  Backend:    {Colors.GREEN}✓ Online{Colors.RESET}")
        print(f"  Database:   {db_status}")
        print(f"  ML Service: {health.get('mlService', {}).get('url', 'N/A')}")
        print(f"  Updated:    {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    else:
        print(f"{Colors.RED}✗ Backend unavailable{Colors.RESET}")
        return

    print(f"\n{Colors.CYAN}{'-'*100}{Colors.RESET}\n")

    # Statistics
    stats = get_stats()
    if stats:
        print(f"{Colors.BOLD}📊 Statistics:{Colors.RESET}")
        print(f"  Total Readings: {Colors.BOLD}{stats.get('totalReadings', 0):,}{Colors.RESET}")
        print(f"  Active Alerts:  {Colors.BOLD}{stats.get('activeAlerts', 0)}{Colors.RESET}")

        # Risk distribution
        print(f"\n{Colors.BOLD}  Risk Distribution (Last 100 readings):{Colors.RESET}")
        risk_dist = stats.get('riskDistribution', {})
        total = sum(risk_dist.values())

        if total > 0:
            for risk, count in risk_dist.items():
                if count > 0:
                    pct = (count / total * 100)
                    bar_length = int(pct / 2)  # Scale to fit
                    bar = '█' * bar_length
                    print(f"    {format_risk_state(risk)} {bar} {count:3d} ({pct:5.1f}%)")
        else:
            print(f"    {Colors.YELLOW}No data yet{Colors.RESET}")

    print(f"\n{Colors.CYAN}{'-'*100}{Colors.RESET}\n")

    # Active Alerts
    alerts = get_active_alerts()
    print(f"{Colors.BOLD}🚨 Active Alerts: {len(alerts)}{Colors.RESET}")
    if alerts:
        print(f"\n{'Zone':12s} {'Severity':10s} {'Risk State':15s} {'Message':40s}")
        print(f"{'-'*90}")
        for alert in alerts[:5]:  # Show top 5
            zone = alert.get('clientID', 'N/A')
            severity = alert.get('severity', 'N/A').upper()
            risk = alert.get('riskState', 'N/A')
            message = alert.get('message', 'N/A')[:40]
            print(f"{zone:12s} {severity:10s} {format_risk_state(risk)} {message}")
    else:
        print(f"  {Colors.GREEN}No active alerts{Colors.RESET}")

    print(f"\n{Colors.CYAN}{'-'*100}{Colors.RESET}\n")

    # Recent Readings
    readings = get_recent_readings(8)
    print(f"{Colors.BOLD}📡 Recent Readings:{Colors.RESET}")
    if readings:
        print(f"\n{'Time':8s} {'Zone':12s} {'Risk State':15s} {'CH4':8s} {'LPG':8s} {'CO':7s} {'H2S':7s} {'Conf':6s}")
        print(f"{'-'*90}")

        for reading in readings:
            timestamp = reading.get('timestamp', '')[:19].split('T')[1] if reading.get('timestamp') else 'N/A'
            zone = reading.get('clientID', 'N/A')
            risk = reading.get('mlPrediction', {}).get('riskState', 'N/A')
            conf = reading.get('mlPrediction', {}).get('confidence', 'N/A')

            gases = reading.get('gasReadings', {})
            ch4 = f"{gases.get('methane', 0):.1f}"
            lpg = f"{gases.get('lpg', 0):.1f}"
            co = f"{gases.get('carbonMonoxide', 0):.1f}"
            h2s = f"{gases.get('hydrogenSulfide', 0):.1f}"

            print(f"{timestamp:8s} {zone:12s} {format_risk_state(risk)} {ch4:>7s} {lpg:>7s} {co:>6s} {h2s:>6s} {conf:6s}")
    else:
        print(f"  {Colors.YELLOW}No readings yet{Colors.RESET}")

    print(f"\n{Colors.CYAN}{'='*100}{Colors.RESET}")
    print(f"{Colors.BLUE}Refreshing every {REFRESH_INTERVAL}s... Press Ctrl+C to exit{Colors.RESET}")

def run_monitor():
    """Main monitoring loop"""
    try:
        while True:
            draw_dashboard()
            time.sleep(REFRESH_INTERVAL)
    except KeyboardInterrupt:
        print(f"\n\n{Colors.YELLOW}🛑 Monitor stopped{Colors.RESET}\n")

if __name__ == "__main__":
    run_monitor()
