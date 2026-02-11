# GasGuard - System Architecture

## Overview

GasGuard is an IoT-based gas leak detection and monitoring system that combines real-time sensor data processing, machine learning anomaly detection, blockchain audit logging, and automated emergency response.

---

## System Architecture Diagram

```
 ┌─────────────────────────────────────────────────────────────────────────┐
 │                         DATA SOURCES                                    │
 │                                                                         │
 │   ┌─────────────────┐        ┌──────────────────────┐                   │
 │   │  IoT Simulator   │        │  Simulator Service    │                  │
 │   │  (Python script)  │        │  Flask :5001          │                  │
 │   │  Random patterns  │        │  Controlled scenarios │                  │
 │   └────────┬─────────┘        └──────────┬───────────┘                  │
 │            │ POST /api/readings           │ POST /api/readings           │
 └────────────┼─────────────────────────────┼──────────────────────────────┘
              │                             │
              v                             v
 ┌─────────────────────────────────────────────────────────────────────────┐
 │                       BACKEND API (Express :3001)                       │
 │                                                                         │
 │   ┌──────────┐   ┌──────────────┐   ┌────────────┐   ┌─────────────┐  │
 │   │ Validate  │──>│ ML Prediction │──>│  Decision   │──>│  Broadcast  │  │
 │   │ Input     │   │ (call :5000)  │   │  Engine     │   │  WebSocket  │  │
 │   └──────────┘   └──────────────┘   └─────┬──────┘   └─────────────┘  │
 │                                           │                             │
 │                          ┌────────────────┼────────────────┐            │
 │                          v                v                v            │
 │                   ┌───────────┐   ┌──────────────┐  ┌────────────┐     │
 │                   │  MongoDB   │   │  Ventilation  │  │ Blockchain │     │
 │                   │  (Atlas)   │   │  Control      │  │ Log :3002  │     │
 │                   └───────────┘   └──────────────┘  └────────────┘     │
 └─────────────────────────────────────────────────────────────────────────┘
              │ WebSocket events
              v
 ┌─────────────────────────────────────────────────────────────────────────┐
 │                         FRONTENDS                                       │
 │                                                                         │
 │   ┌────────────────────┐          ┌──────────────────────┐              │
 │   │  Main Dashboard     │          │  Scenario Dashboard   │             │
 │   │  React :3000        │          │  React :3003           │             │
 │   │  Live monitoring    │          │  Test scenario control │             │
 │   └────────────────────┘          └──────────────────────┘              │
 └─────────────────────────────────────────────────────────────────────────┘
```

---

## Services

| Service | Technology | Port | Directory |
|---------|-----------|------|-----------|
| Backend API | Node.js / Express / Socket.IO | 3001 | `backend-new/` |
| ML Service | Python / Flask / TensorFlow | 5000 | `ml-service/` |
| Blockchain Service | Node.js / Express / Ganache | 3002 | `blockchain-service/` |
| Frontend Dashboard | React | 3000 | `frontend/` |
| Simulator Service | Python / Flask | 5001 | `simulator-service/` |
| Scenario Dashboard | React | 3003 | `scenario-dashboard/` |
| IoT Simulator | Python script | - | `iot-simulator.py` |
| Database | MongoDB Atlas | Cloud | - |

---

## Data Flow

### 1. Sensor Reading Ingestion

When a sensor reading arrives at `POST /api/readings`:

```
Sensor Data ──> Validate Input ──> Call ML Service ──> Decision Engine ──> Store + Broadcast
```

**Step-by-step:**

1. **Validate** - Checks `clientID` and all 4 gas values (methane, LPG, CO, H2S) are valid non-negative numbers
2. **ML Prediction** - Sends gas data to ML Service (`POST /predict`) with 5-second timeout
3. **Decision Engine** - Based on returned risk state:
   - **UNUSUAL and above** → Create an Alert in MongoDB
   - **WARNING and above** → Trigger ventilation (AUTO or FORCED mode)
   - **WARNING and above** → Log event to Blockchain
4. **Store** - Save the SensorReading document with ML results and actions taken
5. **Broadcast** - Emit WebSocket events to all connected clients:
   - `sensor-reading` — raw gas data
   - `ml-prediction` — ML classification results
   - `alert` — if an alert was created
   - `ventilation` — if ventilation was triggered

---

## ML Classification (Hybrid Model)

The ML service uses a **two-path hybrid classification** system, combining threshold-based PPM analysis with LSTM neural network anomaly detection.

### Path 1: PPM Threshold Classification

Each gas type has defined concentration thresholds (in PPM):

| Risk State | Methane (CH4) | LPG | CO | H2S |
|------------|--------------|-----|-----|------|
| NORMAL | 0 - 1,000 | 0 - 500 | 0 - 25 | 0 - 5 |
| LOW_ANOMALY | 1,000 - 2,500 | 500 - 1,000 | 25 - 35 | 5 - 10 |
| UNUSUAL | 2,500 - 4,000 | 1,000 - 1,500 | 35 - 50 | 10 - 15 |
| ALERT | 4,000 - 5,000 | 1,500 - 2,000 | 50 - 100 | 15 - 20 |
| WARNING | 5,000 - 7,000 | 2,000 - 3,000 | 100 - 200 | 20 - 50 |
| CRITICAL | 7,000+ | 3,000+ | 200+ | 50+ |

The overall PPM risk is the **maximum risk across all 4 gases**.

### Path 2: LSTM Anomaly Detection

```
Input: 10-timestep sequence of 4 gas readings (normalized)
Model: LSTM(50) → LSTM(50) → Dense(4)
Output: Predicted next gas values
Error: mean(|predicted - actual|) on normalized scale
```

| Prediction Error | Risk State |
|-----------------|------------|
| ≤ 0.15 | NORMAL |
| ≤ 0.30 | LOW_ANOMALY |
| ≤ 0.50 | UNUSUAL |
| ≤ 0.75 | ALERT |
| ≤ 1.10 | WARNING |
| > 1.10 | CRITICAL |

The model maintains a rolling buffer of 50 readings and requires at least 10 readings before making predictions. Input data is normalized using a pre-fitted scaler (`scaler.pkl`).

### Fusion: Max-Risk Rule

```
Final Risk = max(PPM Risk, Anomaly Risk)
```

**Confidence** is determined by agreement between the two paths:
- **HIGH** — Both paths agree on the same risk state
- **MEDIUM** — Paths differ by 1 level
- **LOW** — Paths differ by 2+ levels

**Leak Probability** is calculated as: `risk_level / 5.0` (0.0 to 1.0 scale)

---

## Risk States and Actions

GasGuard defines 6 risk states with escalating automated responses:

```
NORMAL ──> LOW_ANOMALY ──> UNUSUAL ──> ALERT ──> WARNING ──> CRITICAL
  0             1             2          3          4           5
```

| Risk State | Action | Recommended Response |
|------------|--------|---------------------|
| NORMAL | Monitor only | Continue normal operations |
| LOW_ANOMALY | Monitor only | Continue monitoring |
| UNUSUAL | Create Alert | Investigate the area |
| ALERT | Create Alert | Prepare response teams |
| WARNING | Alert + Ventilation (AUTO) + Blockchain Log | Activate ventilation |
| CRITICAL | Alert + Ventilation (FORCED) + Blockchain Log | Evacuate immediately |

---

## Blockchain Audit Logging

WARNING and CRITICAL events are logged to the blockchain service for tamper-proof audit trails.

**How it works:**
- Uses Ganache for local Ethereum simulation (falls back to in-memory simulation if unavailable)
- Each transaction records: event type, gas levels, risk state, zone, timestamp, confidence
- Blocks are created every 5 transactions
- Data persists to `blockchain-data.json`
- Supports querying by zone, event type, date range

**API Endpoints:**
| Endpoint | Description |
|----------|-------------|
| `GET /transactions` | Recent transactions |
| `GET /blocks` | Block history |
| `GET /report` | Aggregated statistics |
| `GET /transactions/zone/:zone` | Filter by zone |

---

## Database Schemas (MongoDB)

### SensorReading
```
clientID            String (indexed)
gasReadings         { methane, lpg, carbonMonoxide, hydrogenSulfide }
environmental       { temperature, humidity, pressure }
mlPrediction        { riskState, confidence, ppmClassification, anomalyDetection, leakProbability }
actionsTaken        { alertCreated, ventilationTriggered, blockchainLogged }
source              String (default: 'iot_device')
timestamp           Date (indexed)
```

### Alert
```
clientID            String (indexed)
severity            enum [low, medium, high, critical]
riskState           enum [LOW_ANOMALY, UNUSUAL, ALERT, WARNING, CRITICAL]
message             String
gasLevels           { methane, lpg, carbonMonoxide, hydrogenSulfide }
dominantGas         String
status              enum [active, acknowledged, resolved]
metadata            { confidence, ppmRisk, anomalyRisk, leakProbability }
readingId           ObjectId → SensorReading
timestamp           Date (indexed)
```

### VentilationStatus
```
clientID            String (indexed)
isActive            Boolean
mode                enum [OFF, AUTO, FORCED]
triggeredBy         { riskState, timestamp, reason }
activatedAt         Date
deactivatedAt       Date
```

---

## Multi-Zone Support

The system supports 4 independent monitoring zones:

| Zone ID | Description |
|---------|-------------|
| ZONE_A_01 | Zone A |
| ZONE_B_02 | Zone B |
| ZONE_C_03 | Zone C |
| ZONE_D_04 | Zone D |

Each zone has independent:
- Sensor readings and history
- ML prediction state (separate LSTM buffer)
- Alert tracking
- Ventilation control
- Blockchain audit trail

---

## Frontend Dashboard

The main React dashboard at port 3000 provides:

- **Status Bar** — Health indicators for Backend, Sensors, ML Engine, Blockchain
- **Live Sensor Grid** — Per-zone cards showing CH4, LPG, CO, H2S with color-coded risk
- **ML Predictions Panel** — Per-zone leak probability, risk state, confidence level
- **Gas Trend Charts** — Line charts showing last 20 readings per zone
- **Alerts Panel** — Active alerts with severity and timestamps
- **Ventilation Status** — Per-zone active/inactive with mode display
- **Emergency Controls** — Emergency Stop, Force Ventilation, Test Alert buttons
- **Blockchain Page** — Transaction history and audit reports
- **Digital Twin Page** — 3D zone visualization
- **IoT Health Page** — Device connectivity status

**Risk Color Coding:**
| Risk State | Color |
|------------|-------|
| NORMAL | Green |
| LOW_ANOMALY | Light Green |
| UNUSUAL | Amber |
| ALERT | Orange |
| WARNING | Red |
| CRITICAL | Bright Red |

---

## Scenario Testing

The Simulator Service (port 5001) + Scenario Dashboard (port 3003) allow controlled testing:

| Scenario | Methane | LPG | CO | H2S |
|----------|---------|-----|-----|------|
| NORMAL | 50-300 | 20-200 | 5-20 | 0.5-4 |
| LOW_ANOMALY | 1,000-1,400 | 500-700 | 25-32 | 5-8 |
| UNUSUAL | 2,500-3,500 | 1,000-1,400 | 35-48 | 10-14 |
| ALERT | 4,000-4,800 | 1,500-1,900 | 50-95 | 15-19 |
| WARNING | 5,000-6,800 | 2,000-2,900 | 100-190 | 20-45 |
| CRITICAL | 7,000-10,000 | 3,000-5,000 | 200-400 | 50-100 |

**Special Scenarios:**
- **GRADUAL_LEAK** — Ramps from NORMAL to WARNING over ~40 seconds
- **SUDDEN_SPIKE** — Single CRITICAL reading then auto-reverts to NORMAL

---

## WebSocket Events

All real-time communication uses Socket.IO:

| Event | Direction | Description |
|-------|-----------|-------------|
| `sensor-reading` | Server → Client | New gas reading from a zone |
| `ml-prediction` | Server → Client | ML classification result (wrapped in `mlResult`) |
| `alert` | Server → Client | New alert created |
| `ventilation` | Server → Client | Ventilation state change |
| `ventilation-status` | Server → Client | Ventilation status update |
| `emergency-event` | Server → Client | Emergency protocol triggered |
| `subscribe` | Client → Server | Subscribe to zone-specific updates |
