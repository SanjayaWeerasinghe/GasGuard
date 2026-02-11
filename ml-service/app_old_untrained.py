from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
from collections import deque
from datetime import datetime
import tensorflow as tf
import logging

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("GasGuard-ML")

SEQUENCE_LENGTH = 10
FEATURE_COUNT = 4
BUFFER_SIZE = 50

# LSTM Anomaly Detection Thresholds (based on prediction error)
ANOMALY_THRESHOLDS = [
    ("NORMAL", 0.15),
    ("LOW_ANOMALY", 0.30),  # Renamed from GRADUAL
    ("UNUSUAL", 0.50),
    ("ALERT", 0.75),
    ("WARNING", 1.10),
    ("CRITICAL", float("inf"))
]

# PPM-Based Thresholds per Gas Type (OSHA-compliant + Industry Standards)
# Values in PPM (parts per million)
GAS_PPM_THRESHOLDS = {
    "methane": [
        ("NORMAL", 0, 1000),         # Safe background
        ("LOW_ANOMALY", 1000, 2500), # Slight elevation
        ("UNUSUAL", 2500, 4000),     # Abnormal
        ("ALERT", 4000, 5000),       # 10% LEL approach
        ("WARNING", 5000, 7000),     # Above 10% LEL
        ("CRITICAL", 7000, float("inf"))  # Dangerous
    ],
    "lpg": [
        ("NORMAL", 0, 500),
        ("LOW_ANOMALY", 500, 1000),
        ("UNUSUAL", 1000, 1500),
        ("ALERT", 1500, 2000),       # Approaching 10% LEL
        ("WARNING", 2000, 3000),
        ("CRITICAL", 3000, float("inf"))
    ],
    "carbonMonoxide": [
        ("NORMAL", 0, 25),           # Safe background
        ("LOW_ANOMALY", 25, 35),     # Slight elevation
        ("UNUSUAL", 35, 50),         # OSHA PEL = 50 ppm
        ("ALERT", 50, 100),          # Above OSHA limit
        ("WARNING", 100, 200),       # Dangerous
        ("CRITICAL", 200, float("inf"))  # Immediately dangerous
    ],
    "hydrogenSulfide": [
        ("NORMAL", 0, 5),            # Safe background
        ("LOW_ANOMALY", 5, 10),      # Slight elevation
        ("UNUSUAL", 10, 15),         # OSHA ceiling = 10 ppm
        ("ALERT", 15, 20),           # Above OSHA limit
        ("WARNING", 20, 50),         # Highly toxic
        ("CRITICAL", 50, float("inf"))  # Life-threatening
    ]
}

# Risk State Hierarchy (for comparison)
RISK_HIERARCHY = {
    "NORMAL": 0,
    "LOW_ANOMALY": 1,
    "UNUSUAL": 2,
    "ALERT": 3,
    "WARNING": 4,
    "CRITICAL": 5
}

def build_lstm_model():
    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=(SEQUENCE_LENGTH, FEATURE_COUNT)),
        tf.keras.layers.LSTM(50, return_sequences=True),
        tf.keras.layers.LSTM(50),
        tf.keras.layers.Dense(FEATURE_COUNT)
    ])
    model.compile(optimizer="adam", loss="mse")
    return model

def classify_by_ppm(gas_type, ppm_value):
    """
    Classify risk based on PPM thresholds for a specific gas type.

    Args:
        gas_type: One of ["methane", "lpg", "carbonMonoxide", "hydrogenSulfide"]
        ppm_value: Gas concentration in PPM

    Returns:
        Risk state string
    """
    if gas_type not in GAS_PPM_THRESHOLDS:
        logger.warning(f"Unknown gas type: {gas_type}, returning NORMAL")
        return "NORMAL"

    thresholds = GAS_PPM_THRESHOLDS[gas_type]

    for risk_state, min_ppm, max_ppm in thresholds:
        if min_ppm <= ppm_value < max_ppm:
            return risk_state

    return "CRITICAL"  # Exceeds all thresholds

def get_highest_risk(risk_states):
    """
    Get the highest risk state from a list of risk states.

    Args:
        risk_states: List of risk state strings

    Returns:
        Highest risk state
    """
    if not risk_states:
        return "NORMAL"

    highest = "NORMAL"
    highest_level = 0

    for state in risk_states:
        if state in RISK_HIERARCHY:
            level = RISK_HIERARCHY[state]
            if level > highest_level:
                highest_level = level
                highest = state

    return highest

def classify_multi_gas_ppm(gas_values):
    """
    Classify risk based on PPM values for all gases.
    Uses the highest risk among all gases (multi-gas fusion rule).

    Args:
        gas_values: Dict with keys ["methane", "lpg", "carbonMonoxide", "hydrogenSulfide"]
                   and values in PPM

    Returns:
        Dict with overall risk state and per-gas classifications
    """
    gas_risks = {}

    # Classify each gas
    for gas_type, ppm_value in gas_values.items():
        risk_state = classify_by_ppm(gas_type, ppm_value)
        gas_risks[gas_type] = {
            "ppm": ppm_value,
            "risk": risk_state
        }

    # Get highest risk (multi-gas fusion rule)
    all_risks = [gas_risks[gas]["risk"] for gas in gas_risks]
    overall_risk = get_highest_risk(all_risks)

    return {
        "overallRisk": overall_risk,
        "gasRisks": gas_risks,
        "dominantGas": max(gas_risks, key=lambda x: RISK_HIERARCHY.get(gas_risks[x]["risk"], 0))
    }

class GasLeakPredictor:
    def __init__(self):
        self.model = build_lstm_model()
        self.buffer = deque(maxlen=BUFFER_SIZE)
        self.initialized = False
        self.state = "NORMAL"

    def warm_up(self):
        X = np.random.normal(0, 1, (100, SEQUENCE_LENGTH, FEATURE_COUNT))
        y = np.random.normal(0, 1, (100, FEATURE_COUNT))
        self.model.fit(X, y, epochs=3, verbose=0)
        self.initialized = True

    def classify_by_anomaly(self, error):
        """Classify risk based on LSTM prediction error (anomaly detection)"""
        for state, threshold in ANOMALY_THRESHOLDS:
            if error <= threshold:
                return state
        return "CRITICAL"

    def predict_anomaly(self, values):
        """
        LSTM-based anomaly detection.
        Returns risk state based on prediction error.
        """
        self.buffer.append(values)

        if len(self.buffer) < SEQUENCE_LENGTH:
            return self.state, 0.0, "insufficient_data"

        if not self.initialized:
            self.warm_up()

        seq = np.array(self.buffer)[-SEQUENCE_LENGTH:]
        seq = seq.reshape(1, SEQUENCE_LENGTH, FEATURE_COUNT)

        pred = self.model.predict(seq, verbose=0)[0]
        error = float(np.mean(np.abs(pred - values)))

        # Calculate trend
        if len(self.buffer) >= 3:
            recent_errors = [np.mean(np.abs(self.model.predict(
                np.array(list(self.buffer)[i:i+SEQUENCE_LENGTH]).reshape(1, SEQUENCE_LENGTH, FEATURE_COUNT),
                verbose=0
            )[0] - list(self.buffer)[i+SEQUENCE_LENGTH-1]))
            for i in range(len(self.buffer) - SEQUENCE_LENGTH - 2, len(self.buffer) - SEQUENCE_LENGTH)]

            if len(recent_errors) >= 2:
                if recent_errors[-1] > recent_errors[0] * 1.2:
                    trend = "increasing"
                elif recent_errors[-1] < recent_errors[0] * 0.8:
                    trend = "decreasing"
                else:
                    trend = "stable"
            else:
                trend = "stable"
        else:
            trend = "stable"

        self.state = self.classify_by_anomaly(error)
        return self.state, error, trend

predictor = GasLeakPredictor()

@app.route("/health")
def health():
    return jsonify({
        "status": "online",
        "service": "GasGuard ML Engine",
        "type": "TensorFlow + LSTM (Real-Time)",
        "timestamp": datetime.utcnow().isoformat()
    })

@app.route("/predict", methods=["POST"])
def predict():
    """
    Hybrid Risk Classification Endpoint

    Accepts two input formats:
    1. Legacy format: {"values": [methane, lpg, co, h2s]}
    2. New format: {"sensorData": [{"gases": {...}, "environmental": {...}}]}

    Returns hybrid classification combining:
    - PPM threshold-based risk (per gas)
    - LSTM anomaly detection risk (pattern-based)
    - Final risk = MAX(PPM risk, Anomaly risk)
    """
    data = request.get_json()

    if not data:
        return jsonify({"error": "Invalid input"}), 400

    # Handle new format (from backend)
    if "sensorData" in data and len(data["sensorData"]) > 0:
        sensor_entry = data["sensorData"][0]
        gases = sensor_entry.get("gases", {})

        gas_values = {
            "methane": gases.get("methane", 0),
            "lpg": gases.get("lpg", 0),
            "carbonMonoxide": gases.get("carbonMonoxide", 0),
            "hydrogenSulfide": gases.get("hydrogenSulfide", 0)
        }

        # Array format for LSTM [methane, lpg, co, h2s]
        values_array = [
            gas_values["methane"],
            gas_values["lpg"],
            gas_values["carbonMonoxide"],
            gas_values["hydrogenSulfide"]
        ]

    # Handle legacy format
    elif "values" in data:
        values_array = data["values"]
        if len(values_array) != FEATURE_COUNT:
            return jsonify({"error": "Expected 4 gas values"}), 400

        gas_values = {
            "methane": values_array[0],
            "lpg": values_array[1],
            "carbonMonoxide": values_array[2],
            "hydrogenSulfide": values_array[3]
        }
    else:
        return jsonify({"error": "Missing 'values' or 'sensorData' in request"}), 400

    # ==========================================
    # PATH 1: PPM-Based Classification
    # ==========================================
    ppm_classification = classify_multi_gas_ppm(gas_values)
    ppm_risk = ppm_classification["overallRisk"]

    # ==========================================
    # PATH 2: LSTM Anomaly Detection
    # ==========================================
    anomaly_risk, prediction_error, trend = predictor.predict_anomaly(np.array(values_array))

    # ==========================================
    # HYBRID DECISION: Use Highest Risk
    # ==========================================
    final_risk = get_highest_risk([ppm_risk, anomaly_risk])

    # Determine confidence based on agreement
    if ppm_risk == anomaly_risk:
        confidence = "high"
    elif abs(RISK_HIERARCHY[ppm_risk] - RISK_HIERARCHY[anomaly_risk]) <= 1:
        confidence = "medium"
    else:
        confidence = "low"

    # Determine actions based on final risk
    notify = final_risk in ["UNUSUAL", "ALERT"]
    alarm = final_risk in ["WARNING", "CRITICAL"]
    ventilation = final_risk in ["WARNING", "CRITICAL"]

    # Recommended action
    action_map = {
        "NORMAL": "monitor",
        "LOW_ANOMALY": "monitor",
        "UNUSUAL": "investigate",
        "ALERT": "prepare",
        "WARNING": "ventilate",
        "CRITICAL": "evacuate"
    }

    response = {
        # Final hybrid classification
        "riskState": final_risk,
        "riskLevel": final_risk,  # Alias for backward compatibility
        "confidence": confidence,

        # Path 1: PPM-based results
        "ppmClassification": {
            "overallRisk": ppm_risk,
            "gasRisks": ppm_classification["gasRisks"],
            "dominantGas": ppm_classification["dominantGas"]
        },

        # Path 2: Anomaly detection results
        "anomalyDetection": {
            "risk": anomaly_risk,
            "predictionError": round(prediction_error, 4),
            "trend": trend
        },

        # Actions
        "notify": notify,
        "alarm": alarm,
        "ventilation": ventilation,
        "recommendedAction": action_map.get(final_risk, "monitor"),

        # Additional info
        "leakProbability": round(RISK_HIERARCHY[final_risk] / 5.0, 2),  # 0.0 to 1.0
        "timestamp": datetime.utcnow().isoformat(),

        # Classification method
        "classificationMethod": "hybrid_ppm_lstm"
    }

    logger.info(f"Hybrid Classification: PPM={ppm_risk}, Anomaly={anomaly_risk}, Final={final_risk}")

    return jsonify(response)

if __name__ == "__main__":
    print("🚀 GasGuard ML Service running (Real-Time LSTM)")
    app.run(host="0.0.0.0", port=5000)
