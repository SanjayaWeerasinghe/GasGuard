#!/usr/bin/env python3
"""
GasGuard IoT Sensor Simulator

Continuously generates and sends realistic gas sensor readings to the backend.
Simulates various scenarios: normal operation, gradual leaks, sudden spikes.
"""

import requests
import random
import time
import json
from datetime import datetime
from enum import Enum

# Configuration
BACKEND_URL = "http://localhost:3001/api/readings"
INTERVAL_SECONDS = 2  # Send reading every 2 seconds

# Zone/Client IDs to simulate
ZONES = ["ZONE_A_01", "ZONE_B_02", "ZONE_C_03", "ZONE_D_04"]

# Colors for terminal output
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

# Simulation modes
class SimMode(Enum):
    NORMAL = "normal"           # Normal safe operation
    GRADUAL_LEAK = "gradual"    # Slowly increasing leak
    SUDDEN_SPIKE = "spike"      # Sudden dangerous spike
    OSCILLATING = "oscillating" # Fluctuating values

# Gas reading ranges (realistic PPM values)
GAS_RANGES = {
    'normal': {
        'methane': (50, 300),
        'lpg': (20, 200),
        'carbonMonoxide': (5, 20),
        'hydrogenSulfide': (0.5, 4)
    },
    'gradual': {
        'methane': (300, 6000),
        'lpg': (200, 2500),
        'carbonMonoxide': (20, 150),
        'hydrogenSulfide': (4, 40)
    },
    'spike': {
        'methane': (6000, 10000),
        'lpg': (2500, 5000),
        'carbonMonoxide': (150, 400),
        'hydrogenSulfide': (40, 100)
    }
}

class IoTSimulator:
    def __init__(self):
        self.current_readings = {zone: self.get_normal_reading() for zone in ZONES}
        self.mode = {zone: SimMode.NORMAL for zone in ZONES}
        self.leak_progress = {zone: 0 for zone in ZONES}
        self.reading_count = 0
        self.stats = {
            'total_sent': 0,
            'successful': 0,
            'failed': 0,
            'risk_counts': {
                'NORMAL': 0,
                'LOW_ANOMALY': 0,
                'UNUSUAL': 0,
                'ALERT': 0,
                'WARNING': 0,
                'CRITICAL': 0
            }
        }

    def get_normal_reading(self):
        """Generate normal safe reading"""
        return {
            'methane': random.uniform(*GAS_RANGES['normal']['methane']),
            'lpg': random.uniform(*GAS_RANGES['normal']['lpg']),
            'carbonMonoxide': random.uniform(*GAS_RANGES['normal']['carbonMonoxide']),
            'hydrogenSulfide': random.uniform(*GAS_RANGES['normal']['hydrogenSulfide'])
        }

    def get_gradual_leak_reading(self, zone):
        """Generate gradually increasing reading (simulates leak)"""
        progress = self.leak_progress[zone]

        # Interpolate between normal and gradual ranges based on progress
        reading = {}
        for gas in ['methane', 'lpg', 'carbonMonoxide', 'hydrogenSulfide']:
            normal_min, normal_max = GAS_RANGES['normal'][gas]
            gradual_min, gradual_max = GAS_RANGES['gradual'][gas]

            # Gradually increase from normal to gradual range
            current_min = normal_min + (gradual_min - normal_min) * progress
            current_max = normal_max + (gradual_max - normal_max) * progress

            reading[gas] = random.uniform(current_min, current_max)

        # Increase progress
        self.leak_progress[zone] = min(1.0, progress + 0.05)

        # If reached max, reset or switch to spike
        if self.leak_progress[zone] >= 1.0:
            if random.random() < 0.3:  # 30% chance to spike
                self.mode[zone] = SimMode.SUDDEN_SPIKE
            else:  # Reset to normal
                self.mode[zone] = SimMode.NORMAL
                self.leak_progress[zone] = 0

        return reading

    def get_spike_reading(self, zone):
        """Generate sudden dangerous spike"""
        reading = {
            'methane': random.uniform(*GAS_RANGES['spike']['methane']),
            'lpg': random.uniform(*GAS_RANGES['spike']['lpg']),
            'carbonMonoxide': random.uniform(*GAS_RANGES['spike']['carbonMonoxide']),
            'hydrogenSulfide': random.uniform(*GAS_RANGES['spike']['hydrogenSulfide'])
        }

        # After spike, gradually return to normal
        self.mode[zone] = SimMode.NORMAL

        return reading

    def get_oscillating_reading(self):
        """Generate fluctuating reading"""
        amplitude = random.uniform(0.5, 1.5)
        return {
            'methane': random.uniform(100, 1000) * amplitude,
            'lpg': random.uniform(50, 500) * amplitude,
            'carbonMonoxide': random.uniform(10, 50) * amplitude,
            'hydrogenSulfide': random.uniform(2, 10) * amplitude
        }

    def generate_reading(self, zone):
        """Generate reading based on current mode for zone"""
        mode = self.mode[zone]

        if mode == SimMode.NORMAL:
            # 5% chance to start gradual leak
            if random.random() < 0.05:
                self.mode[zone] = SimMode.GRADUAL_LEAK
                self.leak_progress[zone] = 0
            return self.get_normal_reading()

        elif mode == SimMode.GRADUAL_LEAK:
            return self.get_gradual_leak_reading(zone)

        elif mode == SimMode.SUDDEN_SPIKE:
            return self.get_spike_reading(zone)

        elif mode == SimMode.OSCILLATING:
            return self.get_oscillating_reading()

        return self.get_normal_reading()

    def send_reading(self, zone, gases):
        """Send reading to backend"""
        payload = {
            'clientID': zone,
            'gases': {
                'methane': round(gases['methane'], 2),
                'lpg': round(gases['lpg'], 2),
                'carbonMonoxide': round(gases['carbonMonoxide'], 2),
                'hydrogenSulfide': round(gases['hydrogenSulfide'], 2)
            },
            'environmental': {
                'temperature': random.uniform(20, 30),
                'humidity': random.uniform(40, 70),
                'pressure': random.uniform(1010, 1020)
            },
            'source': 'iot_simulator'
        }

        try:
            response = requests.post(
                BACKEND_URL,
                json=payload,
                timeout=5
            )

            self.stats['total_sent'] += 1

            if response.status_code == 200:
                result = response.json()
                self.stats['successful'] += 1

                # Track risk state
                risk_state = result.get('reading', {}).get('riskState', 'UNKNOWN')
                if risk_state in self.stats['risk_counts']:
                    self.stats['risk_counts'][risk_state] += 1

                return result
            else:
                self.stats['failed'] += 1
                return None

        except Exception as e:
            self.stats['failed'] += 1
            print(f"{Colors.RED}✗ Error sending reading: {e}{Colors.RESET}")
            return None

    def print_result(self, zone, gases, result):
        """Print formatted result"""
        if not result:
            return

        reading_info = result.get('reading', {})
        risk_state = reading_info.get('riskState', 'UNKNOWN')
        confidence = reading_info.get('confidence', 'unknown')

        # Color based on risk state
        risk_colors = {
            'NORMAL': Colors.GREEN,
            'LOW_ANOMALY': Colors.YELLOW,
            'UNUSUAL': Colors.YELLOW,
            'ALERT': '\033[38;5;208m',  # Orange
            'WARNING': Colors.RED,
            'CRITICAL': Colors.RED + Colors.BOLD
        }

        color = risk_colors.get(risk_state, Colors.RESET)

        # Get actions
        actions = result.get('actions', {})
        alert_created = '🚨' if actions.get('alertCreated') else '  '
        vent_triggered = '💨' if actions.get('ventilationTriggered') else '  '

        # Format gas values
        gas_str = f"CH4:{gases['methane']:6.1f} LPG:{gases['lpg']:6.1f} CO:{gases['carbonMonoxide']:5.1f} H2S:{gases['hydrogenSulfide']:4.1f}"

        print(f"{color}[{zone}] {risk_state:12s}{Colors.RESET} {alert_created}{vent_triggered} | {gas_str} | Conf: {confidence}")

    def print_stats(self):
        """Print statistics"""
        print(f"\n{Colors.CYAN}{'='*80}{Colors.RESET}")
        print(f"{Colors.BOLD}📊 Simulator Statistics{Colors.RESET}")
        print(f"{Colors.CYAN}{'='*80}{Colors.RESET}")
        print(f"Total Sent:    {self.stats['total_sent']}")
        print(f"Successful:    {Colors.GREEN}{self.stats['successful']}{Colors.RESET}")
        print(f"Failed:        {Colors.RED}{self.stats['failed']}{Colors.RESET}")
        print(f"\n{Colors.BOLD}Risk State Distribution:{Colors.RESET}")
        for risk, count in self.stats['risk_counts'].items():
            if count > 0:
                pct = (count / self.stats['successful'] * 100) if self.stats['successful'] > 0 else 0
                print(f"  {risk:12s}: {count:4d} ({pct:5.1f}%)")
        print(f"{Colors.CYAN}{'='*80}{Colors.RESET}\n")

    def run(self):
        """Main simulation loop"""
        print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*80}{Colors.RESET}")
        print(f"{Colors.BOLD}{Colors.CYAN}🏭 GasGuard IoT Sensor Simulator Started{Colors.RESET}")
        print(f"{Colors.BOLD}{Colors.CYAN}{'='*80}{Colors.RESET}\n")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Zones: {', '.join(ZONES)}")
        print(f"Interval: {INTERVAL_SECONDS}s")
        print(f"\nPress Ctrl+C to stop\n")
        print(f"{Colors.CYAN}{'='*80}{Colors.RESET}\n")

        try:
            while True:
                # Pick a random zone to send data from
                zone = random.choice(ZONES)

                # Generate reading
                gases = self.generate_reading(zone)

                # Send to backend
                result = self.send_reading(zone, gases)

                # Print result
                self.print_result(zone, gases, result)

                self.reading_count += 1

                # Print stats every 20 readings
                if self.reading_count % 20 == 0:
                    self.print_stats()

                # Wait before next reading
                time.sleep(INTERVAL_SECONDS)

        except KeyboardInterrupt:
            print(f"\n\n{Colors.YELLOW}🛑 Simulator stopped by user{Colors.RESET}")
            self.print_stats()
            print(f"\n{Colors.GREEN}✅ Total readings sent: {self.stats['total_sent']}{Colors.RESET}\n")

if __name__ == "__main__":
    simulator = IoTSimulator()
    simulator.run()
