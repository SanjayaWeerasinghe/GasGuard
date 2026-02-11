# GasGuard - Manual Service Startup Guide

Start each service in a **separate terminal window**, following this order.

---

## Terminal 1: ML Service (Port 5000)

```bash
cd ml-service
source venv/bin/activate
python app.py
```

Wait until you see:
```
* Running on http://0.0.0.0:5000
```

---

## Terminal 2: Blockchain Service (Port 3002)

```bash
cd blockchain-service
npm start
```

Wait until you see:
```
Blockchain service running on port 3002
```

---

## Terminal 3: Backend API (Port 3001)

```bash
cd backend-new
npm start
```

Wait until you see:
```
GasGuard Backend Server Started
MongoDB connected successfully
```

> **First time?** Copy the env template: `cp .env.template .env` and fill in your MongoDB URI.

---

## Terminal 4: Frontend Dashboard (Port 3000)

```bash
cd frontend
npm start
```

Opens automatically at **http://localhost:3000**

---

## Terminal 5: Simulator Service (Port 5001)

```bash
cd simulator-service
source venv/bin/activate
python app.py
```

Wait until you see:
```
* Running on http://0.0.0.0:5001
```

---

## Terminal 6: Scenario Dashboard (Port 3003)

```bash
cd scenario-dashboard
PORT=3003 npm start
```

Opens automatically at **http://localhost:3003**

> **Windows CMD:** `set PORT=3003 && npm start`
> **Windows PowerShell:** `$env:PORT=3003; npm start`

---

## Optional: IoT Simulator

Run from the project root to send continuous random sensor data:

```bash
python iot-simulator.py
```

---

## Quick Health Check

After all services are running, verify with:

```bash
curl http://localhost:5000/health     # ML Service
curl http://localhost:3002/health     # Blockchain
curl http://localhost:3001/api/health # Backend API
curl http://localhost:5001/health     # Simulator Service
```

---

## Service Dependency Map

```
ML Service (5000) ──┐
                    ├──> Backend API (3001) ──> Frontend (3000)
Blockchain (3002) ──┘         ^
                              |
              Simulator Service (5001) ──> Scenario Dashboard (3003)
              IoT Simulator (script)
```

Start services **left to right** — always start dependencies before the services that need them.

---

## Stopping Services

Press `Ctrl+C` in each terminal window to stop that service.

Or use the automated script:

```bash
./start-all.sh        # starts everything
# Press Ctrl+C        # stops everything
```
