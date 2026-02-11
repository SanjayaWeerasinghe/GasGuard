"""
GasGuard Scenario Simulator Service
API-driven simulator that sends controlled gas readings to the backend.
Runs a background thread that POSTs readings every 2 seconds per zone.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import threading
import time
import random
import requests
import logging
from datetime import datetime

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger("SimulatorService")

BACKEND_URL = "http://localhost:3001"
SEND_INTERVAL = 2  # seconds

ZONES = ["ZONE_A_01", "ZONE_B_02", "ZONE_C_03", "ZONE_D_04"]

# Scenario templates: PPM ranges calibrated to ML thresholds
SCENARIO_TEMPLATES = {
    "NORMAL": {
        "methane": (50, 300),
        "lpg": (20, 200),
        "carbonMonoxide": (5, 20),
        "hydrogenSulfide": (0.5, 4),
    },
    "LOW_ANOMALY": {
        "methane": (1000, 1400),
        "lpg": (500, 700),
        "carbonMonoxide": (25, 32),
        "hydrogenSulfide": (5, 8),
    },
    "UNUSUAL": {
        "methane": (2500, 3500),
        "lpg": (1000, 1400),
        "carbonMonoxide": (35, 48),
        "hydrogenSulfide": (10, 14),
    },
    "ALERT": {
        "methane": (4000, 4800),
        "lpg": (1500, 1900),
        "carbonMonoxide": (50, 95),
        "hydrogenSulfide": (15, 19),
    },
    "WARNING": {
        "methane": (5000, 6800),
        "lpg": (2000, 2900),
        "carbonMonoxide": (100, 190),
        "hydrogenSulfide": (20, 45),
    },
    "CRITICAL": {
        "methane": (7000, 10000),
        "lpg": (3000, 5000),
        "carbonMonoxide": (200, 400),
        "hydrogenSulfide": (50, 100),
    },
}

# Special scenario parameters
GRADUAL_LEAK_STEPS = 20  # ~40 seconds at 2s interval
SUDDEN_SPIKE_DURATION = 1  # 1 reading at CRITICAL then revert

# Thread-safe state
lock = threading.Lock()
zone_states = {}
stats = {"total_sent": 0, "errors": 0, "started_at": None}


def init_zone_states():
    """Initialize all zones to NORMAL."""
    for zone in ZONES:
        zone_states[zone] = {
            "scenario": "NORMAL",
            "remaining": None,  # None = indefinite
            "custom_levels": None,
            "leak_progress": 0,  # for GRADUAL_LEAK (0.0 to 1.0)
            "activated_at": None,
        }


def generate_reading(zone):
    """Generate gas readings based on the zone's current scenario."""
    with lock:
        state = zone_states[zone]
        scenario = state["scenario"]
        custom = state["custom_levels"]

    # Custom gas levels override templates
    if custom:
        return {
            "methane": custom["methane"] + random.uniform(-5, 5),
            "lpg": custom["lpg"] + random.uniform(-3, 3),
            "carbonMonoxide": custom["carbonMonoxide"] + random.uniform(-1, 1),
            "hydrogenSulfide": custom["hydrogenSulfide"] + random.uniform(-0.5, 0.5),
        }

    # GRADUAL_LEAK: interpolate NORMAL -> WARNING over leak_progress
    if scenario == "GRADUAL_LEAK":
        with lock:
            progress = state["leak_progress"]
        normal = SCENARIO_TEMPLATES["NORMAL"]
        warning = SCENARIO_TEMPLATES["WARNING"]
        gases = {}
        for gas in ["methane", "lpg", "carbonMonoxide", "hydrogenSulfide"]:
            low = normal[gas][0] + (warning[gas][0] - normal[gas][0]) * progress
            high = normal[gas][1] + (warning[gas][1] - normal[gas][1]) * progress
            gases[gas] = round(random.uniform(low, high), 2)
        return gases

    # SUDDEN_SPIKE: single burst at CRITICAL
    if scenario == "SUDDEN_SPIKE":
        template = SCENARIO_TEMPLATES["CRITICAL"]
        return {
            gas: round(random.uniform(*template[gas]), 2)
            for gas in template
        }

    # Standard template-based scenario
    template = SCENARIO_TEMPLATES.get(scenario, SCENARIO_TEMPLATES["NORMAL"])
    return {
        gas: round(random.uniform(*template[gas]), 2)
        for gas in template
    }


def send_reading(zone, gases):
    """POST a reading to the backend."""
    payload = {
        "clientID": zone,
        "gases": gases,
        "environmental": {
            "temperature": round(random.uniform(20, 35), 1),
            "humidity": round(random.uniform(30, 70), 1),
            "pressure": round(random.uniform(1010, 1025), 1),
        },
        "source": "scenario_simulator",
    }
    try:
        resp = requests.post(
            f"{BACKEND_URL}/api/readings",
            json=payload,
            timeout=5,
        )
        if resp.status_code == 200:
            with lock:
                stats["total_sent"] += 1
            return True
        else:
            logger.warning(f"Backend returned {resp.status_code} for {zone}")
            with lock:
                stats["errors"] += 1
            return False
    except requests.RequestException as e:
        logger.error(f"Failed to send reading for {zone}: {e}")
        with lock:
            stats["errors"] += 1
        return False


def update_zone_state(zone):
    """Advance zone state: decrement duration, advance leak progress, handle auto-revert."""
    with lock:
        state = zone_states[zone]
        scenario = state["scenario"]

        if scenario == "NORMAL":
            return

        # Advance GRADUAL_LEAK progress
        if scenario == "GRADUAL_LEAK":
            state["leak_progress"] = min(1.0, state["leak_progress"] + 1.0 / GRADUAL_LEAK_STEPS)
            # When fully leaked, hold at WARNING level
            if state["leak_progress"] >= 1.0 and state["remaining"] is not None:
                state["remaining"] = max(0, state["remaining"] - 1)

        # SUDDEN_SPIKE: revert after 1 reading
        elif scenario == "SUDDEN_SPIKE":
            if state["remaining"] is not None:
                state["remaining"] -= 1

        # Standard scenarios with duration
        elif state["remaining"] is not None:
            state["remaining"] -= 1

        # Auto-revert when duration expires
        if state["remaining"] is not None and state["remaining"] <= 0:
            logger.info(f"[{zone}] Scenario '{scenario}' expired, reverting to NORMAL")
            state["scenario"] = "NORMAL"
            state["remaining"] = None
            state["custom_levels"] = None
            state["leak_progress"] = 0
            state["activated_at"] = None


def background_loop():
    """Main simulation loop: runs every SEND_INTERVAL seconds."""
    logger.info("Background simulator loop started")
    with lock:
        stats["started_at"] = datetime.utcnow().isoformat()

    while True:
        for zone in ZONES:
            gases = generate_reading(zone)
            send_reading(zone, gases)
            update_zone_state(zone)
        time.sleep(SEND_INTERVAL)


# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "online",
        "service": "GasGuard Scenario Simulator",
        "zones": ZONES,
        "timestamp": datetime.utcnow().isoformat(),
    })


@app.route("/status", methods=["GET"])
def status():
    with lock:
        zones_snapshot = {}
        for zone in ZONES:
            s = zone_states[zone]
            zones_snapshot[zone] = {
                "scenario": s["scenario"],
                "remaining": s["remaining"],
                "customLevels": s["custom_levels"],
                "leakProgress": round(s["leak_progress"], 3) if s["scenario"] == "GRADUAL_LEAK" else None,
                "activatedAt": s["activated_at"],
            }
        stats_snapshot = dict(stats)

    return jsonify({
        "zones": zones_snapshot,
        "templates": list(SCENARIO_TEMPLATES.keys()) + ["GRADUAL_LEAK", "SUDDEN_SPIKE"],
        "stats": stats_snapshot,
    })


@app.route("/scenario", methods=["POST"])
def activate_scenario():
    data = request.get_json()
    if not data:
        return jsonify({"error": "JSON body required"}), 400

    zone = data.get("zone")
    scenario = data.get("scenario")
    duration = data.get("duration")  # in seconds; None = indefinite
    custom_levels = data.get("gasLevels")

    if not zone or zone not in ZONES:
        return jsonify({"error": f"Invalid zone. Must be one of: {ZONES}"}), 400

    valid_scenarios = list(SCENARIO_TEMPLATES.keys()) + ["GRADUAL_LEAK", "SUDDEN_SPIKE", "CUSTOM"]
    if not scenario or scenario not in valid_scenarios:
        return jsonify({"error": f"Invalid scenario. Must be one of: {valid_scenarios}"}), 400

    # Validate custom levels if CUSTOM scenario
    if scenario == "CUSTOM":
        if not custom_levels:
            return jsonify({"error": "gasLevels required for CUSTOM scenario"}), 400
        for gas in ["methane", "lpg", "carbonMonoxide", "hydrogenSulfide"]:
            if gas not in custom_levels or not isinstance(custom_levels[gas], (int, float)):
                return jsonify({"error": f"gasLevels must include numeric '{gas}'"}), 400

    # Calculate remaining ticks (each tick = SEND_INTERVAL seconds)
    remaining = None
    if duration is not None:
        remaining = max(1, int(duration / SEND_INTERVAL))

    # Special defaults
    if scenario == "SUDDEN_SPIKE" and remaining is None:
        remaining = 1  # 1 reading then revert
    if scenario == "GRADUAL_LEAK" and remaining is None:
        remaining = GRADUAL_LEAK_STEPS + 10  # full ramp + 10 ticks at WARNING

    with lock:
        zone_states[zone] = {
            "scenario": scenario if scenario != "CUSTOM" else "NORMAL",
            "remaining": remaining,
            "custom_levels": custom_levels if scenario == "CUSTOM" else None,
            "leak_progress": 0,
            "activated_at": datetime.utcnow().isoformat(),
        }
        # For CUSTOM, mark scenario name for display
        if scenario == "CUSTOM":
            zone_states[zone]["scenario"] = "CUSTOM"

    logger.info(f"[{zone}] Activated scenario '{scenario}' for {duration}s (ticks={remaining})")

    return jsonify({
        "success": True,
        "zone": zone,
        "scenario": scenario,
        "duration": duration,
        "remaining_ticks": remaining,
    })


@app.route("/reset", methods=["POST"])
def reset_zone():
    data = request.get_json() or {}
    zone = data.get("zone", "all")

    with lock:
        if zone == "all":
            for z in ZONES:
                zone_states[z] = {
                    "scenario": "NORMAL",
                    "remaining": None,
                    "custom_levels": None,
                    "leak_progress": 0,
                    "activated_at": None,
                }
            logger.info("All zones reset to NORMAL")
        elif zone in ZONES:
            zone_states[zone] = {
                "scenario": "NORMAL",
                "remaining": None,
                "custom_levels": None,
                "leak_progress": 0,
                "activated_at": None,
            }
            logger.info(f"[{zone}] Reset to NORMAL")
        else:
            return jsonify({"error": f"Invalid zone. Must be one of: {ZONES} or 'all'"}), 400

    return jsonify({"success": True, "zone": zone, "scenario": "NORMAL"})


# ============================================================================
# STARTUP
# ============================================================================

if __name__ == "__main__":
    init_zone_states()

    # Start background thread
    thread = threading.Thread(target=background_loop, daemon=True)
    thread.start()

    print("=" * 60)
    print("  GasGuard Scenario Simulator Service".center(60))
    print("=" * 60)
    print(f"  API:      http://localhost:5001")
    print(f"  Backend:  {BACKEND_URL}")
    print(f"  Zones:    {', '.join(ZONES)}")
    print(f"  Interval: {SEND_INTERVAL}s")
    print("=" * 60)

    app.run(host="0.0.0.0", port=5001)
