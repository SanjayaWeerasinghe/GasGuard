# GasGuard - Complete Setup Guide

This guide walks you through setting up and running all GasGuard services from scratch.

## Architecture Overview

```
                        +-------------------+
                        |    Frontend (FE)  |
                        |   React :3000     |
                        +--------+----------+
                                 |
                                 | HTTP + WebSocket
                                 v
+------------------+    +-------------------+    +---------------------+
| ML Service       |<---| Backend (API)     |--->| Blockchain Service  |
| Flask :5000      |    | Express :3001     |    | Node.js :3002       |
+------------------+    +--------+----------+    +---------------------+
                                 ^
                                 | HTTP POST
                                 |
              +------------------+------------------+
              |                                     |
   +----------+----------+            +-------------+-----------+
   | IoT Simulator       |            | Simulator Service       |
   | Python script       |            | Flask :5001             |
   +---------------------+            +-------------+-----------+
                                                    ^
                                                    |
                                          +---------+---------+
                                          | Scenario Dashboard |
                                          | React :3003        |
                                          +-------------------+
```

| Service              | Tech         | Port | Directory              |
|----------------------|--------------|------|------------------------|
| Backend API          | Node/Express | 3001 | `backend-new/`         |
| ML Service           | Python/Flask | 5000 | `ml-service/`          |
| Blockchain Service   | Node/Express | 3002 | `blockchain-service/`  |
| Frontend Dashboard   | React        | 3000 | `frontend/`            |
| Simulator Service    | Python/Flask | 5001 | `simulator-service/`   |
| Scenario Dashboard   | React        | 3003 | `scenario-dashboard/`  |
| IoT Simulator        | Python       | -    | `iot-simulator.py`     |

---

## Prerequisites

- **Node.js** >= 14.0.0 (with npm)
- **Python** >= 3.8 (with pip)
- **MongoDB Atlas** account (or local MongoDB instance)
- **Git**

---

## Step 1: Clone the Repository

```bash
git clone https://github.com/<your-username>/GasGuard.git
cd GasGuard
```

---

## Step 2: Backend API (Port 3001)

The backend is the central hub. All other services depend on it.

```bash
cd backend-new
npm install
```

Create a `.env` file:

```bash
cp .env.example .env
```

Edit `.env` with your actual values:

```env
PORT=3001
NODE_ENV=development
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/gasguard?retryWrites=true&w=majority
ML_SERVICE_URL=http://localhost:5000
BLOCKCHAIN_ENABLED=true
BLOCKCHAIN_URL=http://localhost:3002
```

Start the backend:

```bash
npm start
# or for development with auto-reload:
npm run dev
```

Verify it's running:

```bash
curl http://localhost:3001/api/health
```

---

## Step 3: ML Service (Port 5000)

The ML service runs the LSTM model for gas leak prediction.

```bash
cd ml-service
```

Create and activate a virtual environment:

```bash
python3 -m venv venv
source venv/bin/activate       # Linux/Mac
# venv\Scripts\activate        # Windows
```

Install dependencies:

```bash
pip install -r requirement.txt
```

Start the service:

```bash
python app.py
```

Verify it's running:

```bash
curl http://localhost:5000/health
```

> **Note:** The ML service loads the trained model from `models/gas_leak_model.h5` and scaler from `models/scaler.pkl`. These files are included in the repository.

---

## Step 4: Blockchain Service (Port 3002)

Logs WARNING and CRITICAL events to a simulated blockchain ledger.

```bash
cd blockchain-service
npm install
```

Start the service:

```bash
npm start
# or for development:
npm run dev
```

Verify it's running:

```bash
curl http://localhost:3002/health
```

---

## Step 5: Frontend Dashboard (Port 3000)

The main monitoring dashboard with real-time charts, alerts, and controls.

```bash
cd frontend
npm install
```

Start the frontend:

```bash
npm start
```

This opens the dashboard at **http://localhost:3000**.

---

## Step 6: Simulator Service (Port 5001)

An API-driven simulator that sends controlled gas readings to the backend. Used by the Scenario Dashboard to trigger specific risk scenarios.

```bash
cd simulator-service
```

Create and activate a virtual environment:

```bash
python3 -m venv venv
source venv/bin/activate       # Linux/Mac
# venv\Scripts\activate        # Windows
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start the service:

```bash
python app.py
```

Verify it's running:

```bash
curl http://localhost:5001/health
```

---

## Step 7: Scenario Dashboard (Port 3003)

A secondary React UI to control and test specific gas leak scenarios per zone.

```bash
cd scenario-dashboard
npm install
```

Start the dashboard:

```bash
PORT=3003 npm start             # Linux/Mac
# set PORT=3003 && npm start    # Windows CMD
# $env:PORT=3003; npm start     # Windows PowerShell
```

This opens the scenario control panel at **http://localhost:3003**.

---

## Step 8: IoT Simulator (Standalone Script)

A standalone Python script that continuously generates realistic sensor data across 4 zones and posts it to the backend. Does not require its own virtual environment if you already have `requests` installed.

```bash
# From project root
pip install requests
python iot-simulator.py
```

> **Note:** You can run either the IoT Simulator OR the Simulator Service, depending on your use case:
> - **IoT Simulator** (`iot-simulator.py`) - Automatic random readings with realistic patterns (gradual leaks, spikes)
> - **Simulator Service** (`simulator-service/`) - API-controlled scenarios triggered via the Scenario Dashboard

---

## Startup Order (Recommended)

Start services in this order to ensure dependencies are available:

```
1. ML Service          (port 5000)  - Backend depends on this
2. Blockchain Service  (port 3002)  - Backend depends on this
3. Backend API         (port 3001)  - Central hub, needs ML + Blockchain
4. Frontend Dashboard  (port 3000)  - Connects to Backend
5. Simulator Service   (port 5001)  - Posts to Backend
6. Scenario Dashboard  (port 3003)  - Connects to Simulator + Backend
7. IoT Simulator       (optional)   - Posts to Backend
```

### Quick Start (All Services)

Open 6 terminal windows and run each:

```bash
# Terminal 1 - ML Service
cd ml-service && source venv/bin/activate && python app.py

# Terminal 2 - Blockchain Service
cd blockchain-service && npm start

# Terminal 3 - Backend API
cd backend-new && npm start

# Terminal 4 - Frontend Dashboard
cd frontend && npm start

# Terminal 5 - Simulator Service
cd simulator-service && source venv/bin/activate && python app.py

# Terminal 6 - Scenario Dashboard
cd scenario-dashboard && PORT=3003 npm start
```

---

## Verifying the System

Once all services are running, verify health endpoints:

```bash
curl http://localhost:5000/health    # ML Service
curl http://localhost:3002/health    # Blockchain
curl http://localhost:3001/api/health # Backend
curl http://localhost:5001/health    # Simulator Service
```

Then open:
- **http://localhost:3000** - Main Dashboard (live sensor data, alerts, charts)
- **http://localhost:3003** - Scenario Dashboard (trigger test scenarios)

---

## Environment Variables Reference

### Backend (`backend-new/.env`)

| Variable             | Required | Default                 | Description                          |
|----------------------|----------|-------------------------|--------------------------------------|
| `PORT`               | No       | `3001`                  | Backend server port                  |
| `NODE_ENV`           | No       | `development`           | Environment mode                     |
| `MONGO_URI`          | Yes      | -                       | MongoDB connection string            |
| `ML_SERVICE_URL`     | No       | `http://localhost:5000` | ML service endpoint                  |
| `BLOCKCHAIN_ENABLED` | No       | `false`                 | Enable blockchain logging            |
| `BLOCKCHAIN_URL`     | No       | `http://localhost:3002` | Blockchain service endpoint          |

### Scenario Dashboard (`scenario-dashboard/.env`)

| Variable | Required | Default | Description            |
|----------|----------|---------|------------------------|
| `PORT`   | No       | `3003`  | Dashboard server port  |

---

## Troubleshooting

### MongoDB connection fails
- Check your `MONGO_URI` in `backend-new/.env`
- Ensure your IP is whitelisted in MongoDB Atlas (Network Access > Add Current IP)
- Test the connection string directly with `mongosh`

### ML Service won't start
- Ensure you're using the virtual environment: `source venv/bin/activate`
- TensorFlow requires Python 3.8-3.11
- If `tensorflow` install fails, try: `pip install tensorflow==2.13.0`

### Port already in use
- Kill the process on that port: `lsof -ti:<PORT> | xargs kill -9`
- Or change the port using environment variables

### Frontend can't connect to Backend
- Ensure Backend is running on port 3001 before starting the Frontend
- Check browser console for CORS or WebSocket errors
- The Frontend connects to `http://localhost:3001` (hardcoded in `App.js`)

### Blockchain errors in Backend logs
- These are non-fatal warnings if blockchain service isn't running
- Set `BLOCKCHAIN_ENABLED=false` in `.env` to suppress them
