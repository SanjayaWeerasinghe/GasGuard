# GasGuard - Smart IoT Gas Safety System

A real-time gas leak detection and monitoring system combining IoT sensors, LSTM-based machine learning, blockchain audit logging, and automated emergency response.

## Features

- **Hybrid ML Classification** - PPM thresholds + LSTM anomaly detection fused via max-risk rule
- **6 Risk States** - NORMAL, LOW_ANOMALY, UNUSUAL, ALERT, WARNING, CRITICAL
- **Real-time Dashboard** - Live sensor readings, gas trend charts, ML predictions per zone
- **Automated Response** - Ventilation control triggers at WARNING+, blockchain logging at WARNING+
- **Blockchain Audit Trail** - Tamper-proof logging of all high-risk events
- **Multi-Zone Monitoring** - 4 independent zones with separate tracking
- **Scenario Testing** - Controlled test scenarios via dedicated dashboard

## Architecture

```
IoT Simulator ──┐                              ┌── Frontend Dashboard (:3000)
                 ├──> Backend API (:3001) ──────┤
Simulator (:5001)┘    │          │              └── Scenario Dashboard (:3003)
                      v          v
               ML Service   Blockchain
               (:5000)      (:3002)
                      │
                      v
                  MongoDB Atlas
```

| Service | Tech | Port |
|---------|------|------|
| Backend API | Node.js / Express / Socket.IO | 3001 |
| ML Service | Python / Flask / TensorFlow LSTM | 5000 |
| Blockchain | Node.js / Ganache Simulation | 3002 |
| Frontend | React | 3000 |
| Simulator Service | Python / Flask | 5001 |
| Scenario Dashboard | React | 3003 |

## Quick Start

```bash
# Clone
git clone https://github.com/<your-username>/GasGuard.git
cd GasGuard

# Configure
cp backend-new/.env.template backend-new/.env
# Edit backend-new/.env with your MongoDB URI

# Start all services
./start-all.sh
```

Or start services manually — see [START_SERVICES.md](START_SERVICES.md).

## Documentation

| Document | Description |
|----------|-------------|
| [SETUP.md](SETUP.md) | Full setup guide with prerequisites and installation |
| [START_SERVICES.md](START_SERVICES.md) | Manual service startup (terminal by terminal) |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design, data flow, ML model, database schemas |

## How It Works

1. **Sensor data** arrives at the backend via `POST /api/readings`
2. **ML Service** classifies risk using hybrid PPM thresholds + LSTM anomaly detection
3. **Decision engine** triggers actions based on risk level:
   - UNUSUAL+ → Create alert
   - WARNING+ → Activate ventilation + log to blockchain
4. **WebSocket** broadcasts updates to all connected dashboards in real-time
5. **Frontend** displays live readings, charts, alerts, and ventilation status per zone

## Project Structure

```
GasGuard/
├── backend-new/          # Express API server
│   ├── controllers/      # Request handlers
│   ├── models/           # MongoDB schemas
│   ├── routes/           # API routes
│   └── utils/            # Logger
├── ml-service/           # Flask ML service
│   ├── app.py            # Hybrid classifier
│   └── models/           # Trained LSTM model + scaler
├── blockchain-service/   # Blockchain simulation
├── frontend/             # React main dashboard
├── simulator-service/    # Scenario simulator API
├── scenario-dashboard/   # React scenario control UI
├── iot-simulator.py      # Standalone sensor simulator
├── start-all.sh          # Launch all services
├── Datasets/             # Training data
└── IoT Implementation/   # Hardware reference (ESP32)
```

## Tech Stack

**Backend:** Node.js, Express, Socket.IO, Mongoose, MongoDB Atlas
**ML:** Python, Flask, TensorFlow/Keras, scikit-learn, NumPy
**Frontend:** React, Chart.js, Socket.IO Client, Axios
**Blockchain:** Ganache, Web3.js, Express

## Author

GasGuard Team
