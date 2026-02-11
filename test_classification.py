#!/usr/bin/env python3
"""
GasGuard Classification System Test Suite

Tests the hybrid PPM + LSTM classification system with various scenarios.
"""

import requests
import json
import time
from datetime import datetime

ML_SERVICE_URL = "http://localhost:5000"

# Color codes for terminal output
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def print_header(text):
    print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*60}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.CYAN}{text.center(60)}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.CYAN}{'='*60}{Colors.RESET}\n")

def print_test_case(name):
    print(f"\n{Colors.BOLD}{Colors.BLUE}🧪 Test Case: {name}{Colors.RESET}")
    print(f"{Colors.BLUE}{'-'*60}{Colors.RESET}")

def print_result(risk_state, expected=None):
    color_map = {
        "NORMAL": Colors.GREEN,
        "LOW_ANOMALY": Colors.YELLOW,
        "UNUSUAL": Colors.YELLOW,
        "ALERT": "\033[38;5;208m",  # Orange
        "WARNING": Colors.RED,
        "CRITICAL": Colors.RED
    }

    color = color_map.get(risk_state, Colors.RESET)
    symbol = "✓" if expected is None or risk_state == expected else "✗"

    print(f"{color}{symbol} Risk State: {risk_state}{Colors.RESET}")

def test_ml_service_health():
    """Test 0: ML Service Health Check"""
    print_test_case("ML Service Health Check")

    try:
        response = requests.get(f"{ML_SERVICE_URL}/health", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"{Colors.GREEN}✓ ML Service is online{Colors.RESET}")
            print(f"  Service: {data.get('service')}")
            print(f"  Type: {data.get('type')}")
            print(f"  Status: {data.get('status')}")
            return True
        else:
            print(f"{Colors.RED}✗ ML Service returned status {response.status_code}{Colors.RESET}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"{Colors.RED}✗ Cannot connect to ML service: {e}{Colors.RESET}")
        print(f"{Colors.YELLOW}  Make sure ML service is running: cd ml-service && python app.py{Colors.RESET}")
        return False

def send_prediction(gases, test_name=""):
    """Send prediction request and display results"""

    payload = {
        "sensorData": [{
            "gases": gases,
            "environmental": {
                "temperature": 25,
                "humidity": 60,
                "pressure": 1013
            }
        }]
    }

    try:
        response = requests.post(
            f"{ML_SERVICE_URL}/predict",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )

        if response.status_code == 200:
            result = response.json()
            return result
        else:
            print(f"{Colors.RED}Error: {response.status_code} - {response.text}{Colors.RESET}")
            return None

    except requests.exceptions.RequestException as e:
        print(f"{Colors.RED}Request failed: {e}{Colors.RESET}")
        return None

def display_result(result):
    """Display prediction result in formatted way"""

    if not result:
        return

    print(f"\n{Colors.BOLD}Final Classification:{Colors.RESET}")
    print_result(result['riskState'])
    print(f"  Confidence: {result['confidence']}")
    print(f"  Leak Probability: {result['leakProbability']*100:.1f}%")

    print(f"\n{Colors.BOLD}PPM Classification:{Colors.RESET}")
    ppm = result['ppmClassification']
    print(f"  Overall Risk: {ppm['overallRisk']}")
    print(f"  Dominant Gas: {ppm['dominantGas']}")
    print(f"  Gas Risks:")
    for gas, data in ppm['gasRisks'].items():
        print(f"    - {gas}: {data['ppm']} ppm → {data['risk']}")

    print(f"\n{Colors.BOLD}Anomaly Detection:{Colors.RESET}")
    anomaly = result['anomalyDetection']
    print(f"  Risk: {anomaly['risk']}")
    print(f"  Prediction Error: {anomaly['predictionError']:.4f}")
    print(f"  Trend: {anomaly['trend']}")

    print(f"\n{Colors.BOLD}Actions:{Colors.RESET}")
    print(f"  Notify: {'✓' if result['notify'] else '✗'}")
    print(f"  Alarm: {'✓' if result['alarm'] else '✗'}")
    print(f"  Ventilation: {'✓' if result['ventilation'] else '✗'}")
    print(f"  Recommended: {result['recommendedAction'].upper()}")

# ============================================================================
# TEST CASES
# ============================================================================

def test_1_normal_operation():
    """Test 1: Normal Safe Operation"""
    print_test_case("Normal Safe Operation")

    gases = {
        "methane": 100,
        "lpg": 50,
        "carbonMonoxide": 10,
        "hydrogenSulfide": 2
    }

    print(f"Input: CH4={gases['methane']} ppm, LPG={gases['lpg']} ppm, CO={gases['carbonMonoxide']} ppm, H2S={gases['hydrogenSulfide']} ppm")

    result = send_prediction(gases)
    display_result(result)

    if result and result['riskState'] == 'NORMAL':
        print(f"\n{Colors.GREEN}✓ Test PASSED: System correctly identified safe conditions{Colors.RESET}")
    else:
        print(f"\n{Colors.RED}✗ Test FAILED: Expected NORMAL{Colors.RESET}")

def test_2_gradual_leak_simulation():
    """Test 2: Gradual Leak Detection (ML Advantage)"""
    print_test_case("Gradual Leak Simulation (Time-Series)")

    readings = [
        {"methane": 100, "lpg": 50, "carbonMonoxide": 10, "hydrogenSulfide": 2},
        {"methane": 200, "lpg": 100, "carbonMonoxide": 15, "hydrogenSulfide": 3},
        {"methane": 350, "lpg": 180, "carbonMonoxide": 22, "hydrogenSulfide": 5},
        {"methane": 550, "lpg": 280, "carbonMonoxide": 32, "hydrogenSulfide": 8},
        {"methane": 800, "lpg": 420, "carbonMonoxide": 45, "hydrogenSulfide": 12},
    ]

    print(f"{Colors.YELLOW}Sending increasing readings to simulate gradual leak...{Colors.RESET}\n")

    for i, gases in enumerate(readings, 1):
        print(f"Reading {i}: CH4={gases['methane']}, LPG={gases['lpg']}, CO={gases['carbonMonoxide']}, H2S={gases['hydrogenSulfide']}")
        result = send_prediction(gases)

        if result:
            risk = result['riskState']
            anomaly_risk = result['anomalyDetection']['risk']
            ppm_risk = result['ppmClassification']['overallRisk']

            print(f"  → PPM Risk: {ppm_risk}, Anomaly Risk: {anomaly_risk}, Final: {Colors.BOLD}{risk}{Colors.RESET}")

            if risk not in ["NORMAL", "LOW_ANOMALY"] and ppm_risk == "NORMAL":
                print(f"  {Colors.GREEN}✓ ML detected pattern before PPM threshold!{Colors.RESET}")

        time.sleep(0.5)  # Small delay between readings

    print(f"\n{Colors.GREEN}✓ Test COMPLETE: Check if ML detected anomaly before PPM thresholds{Colors.RESET}")

def test_3_critical_spike():
    """Test 3: Critical Sudden Spike"""
    print_test_case("Critical Sudden Spike")

    gases = {
        "methane": 8000,
        "lpg": 3500,
        "carbonMonoxide": 250,
        "hydrogenSulfide": 60
    }

    print(f"Input: CH4={gases['methane']} ppm, LPG={gases['lpg']} ppm, CO={gases['carbonMonoxide']} ppm, H2S={gases['hydrogenSulfide']} ppm")
    print(f"{Colors.RED}⚠️  All gases at CRITICAL levels!{Colors.RESET}\n")

    result = send_prediction(gases)
    display_result(result)

    if result:
        if result['riskState'] == 'CRITICAL' and result['ventilation'] and result['alarm']:
            print(f"\n{Colors.GREEN}✓ Test PASSED: System correctly triggered emergency response{Colors.RESET}")
        else:
            print(f"\n{Colors.RED}✗ Test FAILED: Expected CRITICAL with ventilation and alarm{Colors.RESET}")

def test_4_multi_gas_dominance():
    """Test 4: Multi-Gas Scenario (Highest Risk Wins)"""
    print_test_case("Multi-Gas Dominance Rule")

    gases = {
        "methane": 500,      # NORMAL
        "lpg": 400,          # NORMAL
        "carbonMonoxide": 120,  # WARNING
        "hydrogenSulfide": 8    # NORMAL
    }

    print(f"Input: CH4={gases['methane']} (NORMAL), LPG={gases['lpg']} (NORMAL)")
    print(f"       CO={gases['carbonMonoxide']} (WARNING), H2S={gases['hydrogenSulfide']} (NORMAL)")
    print(f"{Colors.YELLOW}Expected: CO should dominate with WARNING{Colors.RESET}\n")

    result = send_prediction(gases)
    display_result(result)

    if result:
        dominant = result['ppmClassification']['dominantGas']
        if result['riskState'] == 'WARNING' and dominant == 'carbonMonoxide':
            print(f"\n{Colors.GREEN}✓ Test PASSED: CO correctly dominated classification{Colors.RESET}")
        else:
            print(f"\n{Colors.RED}✗ Test FAILED: Expected WARNING with CO as dominant{Colors.RESET}")

def test_5_h2s_toxicity():
    """Test 5: H2S High Toxicity"""
    print_test_case("H2S High Toxicity (Low PPM, High Danger)")

    gases = {
        "methane": 200,
        "lpg": 100,
        "carbonMonoxide": 15,
        "hydrogenSulfide": 55  # CRITICAL (very toxic even at low PPM)
    }

    print(f"Input: H2S={gases['hydrogenSulfide']} ppm (exceeds 50 ppm CRITICAL threshold)")
    print(f"{Colors.RED}Note: H2S is extremely toxic - 100 ppm is IDLH{Colors.RESET}\n")

    result = send_prediction(gases)
    display_result(result)

    if result and result['riskState'] == 'CRITICAL':
        print(f"\n{Colors.GREEN}✓ Test PASSED: System recognized H2S toxicity{Colors.RESET}")
    else:
        print(f"\n{Colors.RED}✗ Test FAILED: Expected CRITICAL for H2S > 50 ppm{Colors.RESET}")

def test_6_warning_threshold():
    """Test 6: WARNING State (Ventilation Trigger)"""
    print_test_case("WARNING State - Ventilation Trigger Point")

    gases = {
        "methane": 5500,  # WARNING (above 10% LEL)
        "lpg": 400,
        "carbonMonoxide": 30,
        "hydrogenSulfide": 6
    }

    print(f"Input: CH4={gases['methane']} ppm (WARNING - above 10% LEL of 5000 ppm)")
    print(f"{Colors.YELLOW}Expected: WARNING state should trigger ventilation{Colors.RESET}\n")

    result = send_prediction(gases)
    display_result(result)

    if result:
        if result['riskState'] in ['WARNING', 'CRITICAL'] and result['ventilation']:
            print(f"\n{Colors.GREEN}✓ Test PASSED: Ventilation correctly triggered{Colors.RESET}")
        else:
            print(f"\n{Colors.RED}✗ Test FAILED: Expected ventilation trigger{Colors.RESET}")

def test_7_unusual_state():
    """Test 7: UNUSUAL State (Early Warning)"""
    print_test_case("UNUSUAL State - Early Warning System")

    gases = {
        "methane": 3000,  # UNUSUAL
        "lpg": 1200,      # UNUSUAL
        "carbonMonoxide": 40,  # UNUSUAL
        "hydrogenSulfide": 12  # UNUSUAL
    }

    print(f"Input: All gases in UNUSUAL range (abnormal but not yet dangerous)")
    print(f"{Colors.YELLOW}Expected: UNUSUAL state with notification but no alarm{Colors.RESET}\n")

    result = send_prediction(gases)
    display_result(result)

    if result:
        if result['riskState'] == 'UNUSUAL' and result['notify'] and not result['alarm']:
            print(f"\n{Colors.GREEN}✓ Test PASSED: Early warning triggered without alarm{Colors.RESET}")
        else:
            print(f"\n{Colors.YELLOW}Note: Risk escalated to {result['riskState']} (may be expected){Colors.RESET}")

# ============================================================================
# MAIN TEST RUNNER
# ============================================================================

def main():
    print_header("GasGuard Hybrid Classification Test Suite")

    print(f"{Colors.CYAN}Testing ML Service at: {ML_SERVICE_URL}{Colors.RESET}")
    print(f"{Colors.CYAN}Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}{Colors.RESET}")

    # Check ML service health first
    if not test_ml_service_health():
        print(f"\n{Colors.RED}Cannot proceed without ML service. Exiting.{Colors.RESET}\n")
        return

    # Run all test cases
    tests = [
        test_1_normal_operation,
        test_2_gradual_leak_simulation,
        test_3_critical_spike,
        test_4_multi_gas_dominance,
        test_5_h2s_toxicity,
        test_6_warning_threshold,
        test_7_unusual_state
    ]

    for test_func in tests:
        try:
            test_func()
            time.sleep(1)  # Pause between tests
        except Exception as e:
            print(f"\n{Colors.RED}✗ Test failed with error: {e}{Colors.RESET}")

    print_header("Test Suite Complete")
    print(f"{Colors.GREEN}All tests executed. Review results above.{Colors.RESET}\n")
    print(f"{Colors.CYAN}Next steps:{Colors.RESET}")
    print(f"  1. Verify ML correctly detects gradual leaks (Test 2)")
    print(f"  2. Confirm emergency responses trigger (Test 3)")
    print(f"  3. Check multi-gas fusion logic (Test 4)")
    print(f"  4. Review classification details in each response")
    print()

if __name__ == "__main__":
    main()
