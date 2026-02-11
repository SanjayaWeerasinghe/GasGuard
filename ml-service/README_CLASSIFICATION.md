# GasGuard Hybrid Risk Classification System

## Overview
This ML service implements a **hybrid risk classification system** combining:
1. **LSTM Neural Network** - Primary intelligence (pattern recognition & anomaly detection)
2. **Domain Knowledge** - OSHA-compliant PPM thresholds (safety baseline)

## Risk States (Standardized)

| Risk State | Level | Color | Description |
|------------|-------|-------|-------------|
| NORMAL | 0 | Green | Safe operation, expected background levels |
| LOW_ANOMALY | 1 | Light Yellow | Slight deviation detected, gradual leak possible |
| UNUSUAL | 2 | Yellow | Abnormal pattern, not dangerous yet |
| ALERT | 3 | Orange | Potentially dangerous, prepare for action |
| WARNING | 4 | Red | High risk, immediate attention required |
| CRITICAL | 5 | Dark Red | Immediate danger, emergency response |

## API Usage

### Endpoint: POST /predict

#### Input Format 1 (New):
```json
{
  "sensorData": [{
    "gases": {
      "methane": 1500,
      "lpg": 800,
      "carbonMonoxide": 45,
      "hydrogenSulfide": 12
    },
    "environmental": {
      "temperature": 25,
      "humidity": 60,
      "pressure": 1013
    }
  }]
}
```

#### Input Format 2 (Legacy):
```json
{
  "values": [1500, 800, 45, 12]
}
```
Order: [methane, lpg, carbonMonoxide, hydrogenSulfide]

#### Response:
```json
{
  "riskState": "WARNING",
  "riskLevel": "WARNING",
  "confidence": "high",

  "ppmClassification": {
    "overallRisk": "ALERT",
    "gasRisks": {
      "methane": {"ppm": 1500, "risk": "LOW_ANOMALY"},
      "lpg": {"ppm": 800, "risk": "LOW_ANOMALY"},
      "carbonMonoxide": {"ppm": 45, "risk": "UNUSUAL"},
      "hydrogenSulfide": {"ppm": 12, "risk": "UNUSUAL"}
    },
    "dominantGas": "hydrogenSulfide"
  },

  "anomalyDetection": {
    "risk": "WARNING",
    "predictionError": 0.92,
    "trend": "increasing"
  },

  "notify": true,
  "alarm": true,
  "ventilation": true,
  "recommendedAction": "ventilate",
  "leakProbability": 0.80,
  "timestamp": "2026-02-04T12:34:56.789Z",
  "classificationMethod": "hybrid_ppm_lstm"
}
```

## Classification Logic

### Step 1: PPM-Based Classification
Each gas is classified against OSHA/industry thresholds:
- **Methane**: Safe up to 1000 ppm, CRITICAL above 7000 ppm (~14% LEL)
- **LPG**: Safe up to 500 ppm, CRITICAL above 3000 ppm (~14% LEL)
- **CO**: Safe up to 25 ppm, CRITICAL above 200 ppm (IDLH)
- **H2S**: Safe up to 5 ppm, CRITICAL above 50 ppm (near IDLH)

**Multi-gas fusion rule**: Highest risk among all gases dominates.

### Step 2: LSTM Anomaly Detection
- Analyzes last 10 timesteps of readings
- Detects unusual patterns (gradual leaks, rate-of-rise)
- Predicts next values and calculates prediction error
- Classifies based on error magnitude and trend

### Step 3: Hybrid Decision
```python
final_risk = MAX(ppm_risk, anomaly_risk)
```

**Examples:**
- PPM says "ALERT" + LSTM says "WARNING" → Final: **WARNING**
- PPM says "NORMAL" + LSTM says "UNUSUAL" → Final: **UNUSUAL** (catches gradual leaks!)
- PPM says "CRITICAL" + LSTM says "ALERT" → Final: **CRITICAL** (safety override)

## Confidence Levels

- **High**: Both methods agree (same risk state)
- **Medium**: Methods differ by 1 level
- **Low**: Methods differ by 2+ levels (investigate sensor calibration)

## Actions Triggered

| Risk State | Notify | Alarm | Ventilation | Blockchain Log |
|------------|--------|-------|-------------|----------------|
| NORMAL | ❌ | ❌ | ❌ | ❌ |
| LOW_ANOMALY | ❌ | ❌ | ❌ | ❌ |
| UNUSUAL | ✅ | ❌ | ❌ | ❌ |
| ALERT | ✅ | ❌ | ⚠️ Prepare | ❌ |
| WARNING | ✅ | ✅ | ✅ ON | ✅ |
| CRITICAL | ✅ | ✅ | ✅ FORCED | ✅ |

## Why This Approach?

### Academic Justification:
1. **ML-Driven**: LSTM is the primary intelligence
2. **Domain-Aware**: Incorporates safety engineering principles
3. **Research-Backed**: Aligns with 2025 state-of-the-art (hybrid approaches)
4. **Superior Performance**: Catches both sudden spikes AND gradual leaks

### Industry Compliance:
- ✅ OSHA standards integrated
- ✅ LEL (Lower Explosive Limit) considered
- ✅ IDLH (Immediately Dangerous to Life or Health) thresholds
- ✅ Multi-gas monitoring best practices

## Configuration

PPM thresholds are configurable in `app.py`:
```python
GAS_PPM_THRESHOLDS = {
    "methane": [...],
    "lpg": [...],
    ...
}
```

LSTM anomaly thresholds:
```python
ANOMALY_THRESHOLDS = [
    ("NORMAL", 0.15),
    ("LOW_ANOMALY", 0.30),
    ...
]
```

## Model Details

- **Architecture**: Dual LSTM layers (50 units each)
- **Input**: 10 timesteps × 4 features
- **Output**: Next predicted gas values
- **Training**: Online learning with warm-up phase
- **Buffer**: 50 readings maintained for analysis

## Testing

```bash
# Test with normal readings
curl -X POST http://localhost:5000/predict \
  -H "Content-Type: application/json" \
  -d '{"values": [100, 50, 10, 2]}'

# Test with critical readings
curl -X POST http://localhost:5000/predict \
  -H "Content-Type: application/json" \
  -d '{"values": [8000, 3500, 250, 60]}'
```

## References

Based on 2025 research:
- LSTM-Transformer hybrid models for gas leak detection
- BiLSTM Dense for multimodal gas classification
- Deep Forest with optimized feature selection (99.7% accuracy)
