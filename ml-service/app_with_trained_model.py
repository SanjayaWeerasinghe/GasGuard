"""
GasGuard ML Service - With Trained Model Loading

This version loads a pre-trained model instead of using random warm-up.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
from collections import deque
from datetime import datetime
import tensorflow as tf
import pickle
import os
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
    ("LOW_ANOMALY", 0.30),
    ("UNUSUAL", 0.50),
    ("ALERT", 0.75),
    ("WARNING", 1.10),
    ("CRITICAL", float("inf"))
]

# PPM-Based Thresholds per Gas Type (OSHA-compliant + Industry Standards)
GAS_PPM_THRESHOLDS = {
    "methane": [
        ("NORMAL", 0, 1000),
        ("LOW_ANOMALY", 1000, 2500),
        ("UNUSUAL", 2500, 4000),
        ("ALERT", 4000, 5000),
        ("WARNING", 5000, 7000),
        ("CRITICAL", 7000, float("inf"))
    ],
    "lpg": [
        ("NORMAL", 0, 500),
        ("LOW_ANOMALY", 500, 1000),
        ("UNUSUAL", 1000, 1500),
        ("ALERT", 1500, 2000),
        ("WARNING", 2000, 3000),
        ("CRITICAL", 3000, float("inf"))
    ],
    "carbonMonoxide": [
        ("NORMAL", 0, 25),
        ("LOW_ANOMALY", 25, 35),
        ("UNUSUAL", 35, 50),
        ("ALERT", 50, 100),
        ("WARNING", 100, 200),
        ("CRITICAL", 200, float("inf"))
    ],
    "hydrogenSulfide": [
        ("NORMAL", 0, 5),
        ("LOW_ANOMALY", 5, 10),
        ("UNUSUAL", 10, 15),
        ("ALERT", 15, 20),
        ("WARNING", 20, 50),
        ("CRITICAL", 50, float("inf"))
    ]
}

RISK_HIERARCHY = {
    "NORMAL": 0,
    "LOW_ANOMALY": 1,
    "UNUSUAL": 2,
    "ALERT": 3,
    "WARNING": 4,
    "CRITICAL": 5
}

# ============================================================================
# MODEL LOADING
# ============================================================================

def load_trained_model():
    """
    Load pre-trained LSTM model and scaler
    """
    model_path = os.path.join('models', 'gas_leak_model.h5')
    scaler_path = os.path.join('models', 'scaler.pkl')

    if os.path.exists(model_path):
        logger.info(f"📦 Loading trained model from {model_path}")
        model = tf.keras.models.load_model(model_path)
        logger.info("✅ Model loaded successfully")
    else:
        logger.warning(f"⚠️  No trained model found at {model_path}")
        logger.warning("⚠️  Creating untrained model (train first!)")
        model = build_lstm_model()

    if os.path.exists(scaler_path):
        logger.info(f"📦 Loading scaler from {scaler_path}")
        with open(scaler_path, 'rb') as f:
            scaler = pickle.load(f)
        logger.info("✅ Scaler loaded successfully")
    else:
        logger.warning(f"⚠️  No scaler found at {scaler_path}")
        scaler = None

    return model, scaler

def build_lstm_model():
    """
    Build LSTM model architecture (same as training)
    """
    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=(SEQUENCE_LENGTH, FEATURE_COUNT)),
        tf.keras.layers.LSTM(50, return_sequences=True),
        tf.keras.layers.LSTM(50),
        tf.keras.layers.Dense(FEATURE_COUNT)
    ])
    model.compile(optimizer="adam", loss="mse")
    return model

# Load model at startup
trained_model, scaler = load_trained_model()

# ============================================================================
# CLASSIFICATION FUNCTIONS
# ============================================================================

def classify_by_ppm(gas_type, ppm_value):
    """Classify risk based on PPM thresholds"""
    if gas_type not in GAS_PPM_THRESHOLDS:
        logger.warning(f"Unknown gas type: {gas_type}")
        return "NORMAL"

    thresholds = GAS_PPM_THRESHOLDS[gas_type]

    for risk_state, min_ppm, max_ppm in thresholds:
        if min_ppm <= ppm_value < max_ppm:
            return risk_state

    return "CRITICAL"

def get_highest_risk(risk_states):
    """Get highest risk state from list"""
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
    """Classify risk based on PPM for all gases"""
    gas_risks = {}

    for gas_type, ppm_value in gas_values.items():
        risk_state = classify_by_ppm(gas_type, ppm_value)
        gas_risks[gas_type] = {
            "ppm": ppm_value,
            "risk": risk_state
        }

    all_risks = [gas_risks[gas]["risk"] for gas in gas_risks]
    overall_risk = get_highest_risk(all_risks)

    return {
        "overallRisk": overall_risk,
        "gasRisks": gas_risks,
        "dominantGas": max(gas_risks, key=lambda x: RISK_HIERARCHY.get(gas_risks[x]["risk"], 0))
    }

# ============================================================================
# PREDICTOR CLASS
# ============================================================================

class GasLeakPredictor:
    def __init__(self, model, scaler):
        self.model = model
        self.scaler = scaler
        self.buffer = deque(maxlen=BUFFER_SIZE)
        self.state = "NORMAL"

    def classify_by_anomaly(self, error):
        """Classify risk based on LSTM prediction error"""
        for state, threshold in ANOMALY_THRESHOLDS:
            if error <= threshold:
                return state
        return "CRITICAL"

    def predict_anomaly(self, values):
        """LSTM-based anomaly detection with trained model"""
        self.buffer.append(values)

        if len(self.buffer) < SEQUENCE_LENGTH:
            return self.state, 0.0, "insufficient_data"

        # Prepare sequence
        seq = np.array(list(self.buffer)[-SEQUENCE_LENGTH:])

        # Normalize if scaler available
        if self.scaler is not None:
            seq = self.scaler.transform(seq)

        seq = seq.reshape(1, SEQUENCE_LENGTH, FEATURE_COUNT)

        # Predict using TRAINED model
        pred = self.model.predict(seq, verbose=0)[0]

        # Denormalize if needed
        if self.scaler is not None:
            pred = self.scaler.inverse_transform(pred.reshape(1, -1))[0]
            current = self.scaler.inverse_transform(values.reshape(1, -1))[0]
        else:
            current = values

        # Calculate prediction error
        error = float(np.mean(np.abs(pred - current)))

        # Calculate trend
        trend = self._calculate_trend()

        self.state = self.classify_by_anomaly(error)
        return self.state, error, trend

    def _calculate_trend(self):
        """Calculate trend from recent buffer"""
        if len(self.buffer) < 5:
            return "stable"

        recent = list(self.buffer)[-5:]
        avg_early = np.mean(recent[:2])
        avg_late = np.mean(recent[-2:])

        if avg_late > avg_early * 1.2:
            return "increasing"
        elif avg_late < avg_early * 0.8:
            return "decreasing"
        else:
            return "stable"

# Initialize predictor with trained model
predictor = GasLeakPredictor(trained_model, scaler)

# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.route("/health")
def health():
    model_status = "trained" if os.path.exists('models/gas_leak_model.h5') else "untrained"

    return jsonify({
        "status": "online",
        "service": "GasGuard ML Engine",
        "type": "TensorFlow + LSTM (Hybrid)",
        "modelStatus": model_status,
        "timestamp": datetime.utcnow().isoformat()
    })

@app.route("/predict", methods=["POST"])
def predict():
    """Hybrid Risk Classification Endpoint"""
    data = request.get_json()

    if not data:
        return jsonify({"error": "Invalid input"}), 400

    # Handle new format
    if "sensorData" in data and len(data["sensorData"]) > 0:
        sensor_entry = data["sensorData"][0]
        gases = sensor_entry.get("gases", {})

        gas_values = {
            "methane": gases.get("methane", 0),
            "lpg": gases.get("lpg", 0),
            "carbonMonoxide": gases.get("carbonMonoxide", 0),
            "hydrogenSulfide": gases.get("hydrogenSulfide", 0)
        }

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
        return jsonify({"error": "Missing 'values' or 'sensorData'"}), 400

    # Path 1: PPM-Based Classification
    ppm_classification = classify_multi_gas_ppm(gas_values)
    ppm_risk = ppm_classification["overallRisk"]

    # Path 2: LSTM Anomaly Detection (with TRAINED model!)
    anomaly_risk, prediction_error, trend = predictor.predict_anomaly(np.array(values_array))

    # Hybrid Decision
    final_risk = get_highest_risk([ppm_risk, anomaly_risk])

    # Confidence
    if ppm_risk == anomaly_risk:
        confidence = "high"
    elif abs(RISK_HIERARCHY[ppm_risk] - RISK_HIERARCHY[anomaly_risk]) <= 1:
        confidence = "medium"
    else:
        confidence = "low"

    # Actions
    notify = final_risk in ["UNUSUAL", "ALERT"]
    alarm = final_risk in ["WARNING", "CRITICAL"]
    ventilation = final_risk in ["WARNING", "CRITICAL"]

    action_map = {
        "NORMAL": "monitor",
        "LOW_ANOMALY": "monitor",
        "UNUSUAL": "investigate",
        "ALERT": "prepare",
        "WARNING": "ventilate",
        "CRITICAL": "evacuate"
    }

    response = {
        "riskState": final_risk,
        "riskLevel": final_risk,
        "confidence": confidence,

        "ppmClassification": {
            "overallRisk": ppm_risk,
            "gasRisks": ppm_classification["gasRisks"],
            "dominantGas": ppm_classification["dominantGas"]
        },

        "anomalyDetection": {
            "risk": anomaly_risk,
            "predictionError": round(prediction_error, 4),
            "trend": trend
        },

        "notify": notify,
        "alarm": alarm,
        "ventilation": ventilation,
        "recommendedAction": action_map.get(final_risk, "monitor"),
        "leakProbability": round(RISK_HIERARCHY[final_risk] / 5.0, 2),
        "timestamp": datetime.utcnow().isoformat(),
        "classificationMethod": "hybrid_ppm_lstm"
    }

    logger.info(f"Prediction: PPM={ppm_risk}, Anomaly={anomaly_risk}, Final={final_risk}")

    return jsonify(response)

if __name__ == "__main__":
    print("=" * 70)
    print("🚀 GasGuard ML Service (With Trained Model)".center(70))
    print("=" * 70)
    print(f"Model Status: {'✅ TRAINED' if os.path.exists('models/gas_leak_model.h5') else '⚠️  UNTRAINED'}")
    print(f"Scaler Status: {'✅ LOADED' if scaler else '⚠️  NOT LOADED'}")
    print("=" * 70)
    print()

    app.run(host="0.0.0.0", port=5000)
