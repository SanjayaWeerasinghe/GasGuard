# 🚀 Step 2: Start All Services

**Estimated Time:** 10 minutes

This guide will start your ML service, backend, and verify they're working together.

---

## ✅ Prerequisites

Before starting:

- [ ] Model trained (completed `01_TRAIN_MODEL.md`)
- [ ] `models/gas_leak_model.h5` exists
- [ ] `models/scaler.pkl` exists
- [ ] ML service updated (`app.py`)
- [ ] MongoDB running (local or Atlas)

---

## 🎯 Service Architecture

Your system has 3 main services:

```
┌─────────────────┐
│   ML Service    │  Port 5000
│  (Python/Flask) │  LSTM predictions
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│     Backend     │  Port 3001
│ (Node.js/Express│  Main API + WebSocket
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Blockchain     │  Port 3002
│    Service      │  Immutable logging
└─────────────────┘
```

---

## 🔧 Part 1: Start ML Service (2 minutes)

### **Terminal 1: ML Service**

```bash
cd "D:\AAA\Final Submission\GasGuard\ml-service"

python app.py
```

### **Expected Output:**

```
======================================================================
          🚀 GasGuard ML Service (With Trained Model)
======================================================================
Model Status: ✅ TRAINED
Scaler Status: ✅ LOADED
======================================================================
📦 Loading trained model from models/gas_leak_model.h5
✅ Model loaded successfully
📦 Loading scaler from models/scaler.pkl
✅ Scaler loaded successfully
======================================================================

 * Serving Flask app 'app'
 * Debug mode: off
WARNING: This is a development server.
 * Running on all addresses (0.0.0.0)
 * Running on http://127.0.0.1:5000
 * Running on http://192.168.x.x:5000
Press CTRL+C to quit
```

### **✅ Success Indicators:**

- ✅ "Model Status: ✅ TRAINED"
- ✅ "Scaler Status: ✅ LOADED"
- ✅ Model loaded successfully
- ✅ Running on http://127.0.0.1:5000

### **❌ If You See Errors:**

**"Model not found"**
```bash
# Go back to Step 1 - model not trained
cd ml-service
python train_zenodo.py ..\Datasets\zenodo
```

**"Port 5000 already in use"**
```bash
# Kill existing process
netstat -ano | findstr :5000
taskkill /PID <PID_NUMBER> /F
```

### **Test ML Service:**

**Open NEW terminal:**
```bash
curl http://localhost:5000/health
```

**Expected response:**
```json
{
  "status": "online",
  "service": "GasGuard ML Engine",
  "type": "TensorFlow + LSTM (Hybrid)",
  "modelStatus": "trained",
  "timestamp": "2026-02-04T..."
}
```

✅ **Checkpoint:** ML service running

**Keep Terminal 1 open and running!**

---

## 🔧 Part 2: Start Backend (3 minutes)

### **Terminal 2: Backend**

**Open a NEW terminal:**

```bash
cd "D:\AAA\Final Submission\GasGuard\backend"

npm run dev
```

### **Expected Output:**

```
> gasguard-backend@1.0.0 dev
> nodemon server.js

[nodemon] 2.x.x
[nodemon] to restart at any time, enter `rs`
[nodemon] watching path(s): *.*
[nodemon] starting `node server.js`

🔥 MongoDB Atlas Connected Successfully
🚀 GasGuard backend running on port 3001
📊 Health: http://localhost:3001/api/health
```

### **✅ Success Indicators:**

- ✅ "MongoDB Atlas Connected Successfully"
- ✅ "GasGuard backend running on port 3001"
- ✅ No error messages

### **❌ If You See Errors:**

**"MONGO_URI missing in .env"**
```bash
# Create .env file in backend directory
echo MONGO_URI=mongodb://localhost:27017/gasguard > .env

# OR use MongoDB Atlas connection string
echo MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/gasguard > .env
```

**"Port 3001 already in use"**
```bash
netstat -ano | findstr :3001
taskkill /PID <PID_NUMBER> /F
```

**"Cannot find module"**
```bash
npm install
```

### **Test Backend:**

**Open NEW terminal:**
```bash
curl http://localhost:3001/api/health
```

**Expected response:**
```json
{
  "status": "ok",
  "service": "GasGuard Backend",
  "mongoConnected": true,
  "timestamp": "2026-02-04T..."
}
```

✅ **Checkpoint:** Backend running

**Keep Terminal 2 open and running!**

---

## 🔧 Part 3: Start Blockchain Service (Optional - 2 minutes)

### **Terminal 3: Blockchain Service**

**Open a NEW terminal:**

```bash
cd "D:\AAA\Final Submission\GasGuard\blockchain-service"

npm start
```

### **Expected Output:**

```
🔗 Blockchain Service starting...
⚙️  Mode: simulation (no real blockchain)
🚀 Running on port 3002
✅ Ready to log events
```

**Note:** Blockchain service runs in simulation mode if Ganache not installed.

✅ **Checkpoint:** Blockchain service running (or simulation mode)

**Keep Terminal 3 open!**

---

## 🧪 Part 4: Verify Integration (3 minutes)

### **Test ML → Backend Communication:**

**Open NEW terminal (Terminal 4):**

```bash
cd "D:\AAA\Final Submission\GasGuard"

# Send test reading
curl -X POST http://localhost:3001/api/readings ^
  -H "Content-Type: application/json" ^
  -d "{\"clientID\":\"TEST001\",\"gasTypes\":[\"CH4\",\"LPG\",\"CO\",\"H2S\"],\"values\":[100,50,10,2],\"source\":\"test\"}"
```

**Check Backend Terminal (Terminal 2):**

You should see:
```
📥 Incoming reading: { clientID: 'TEST001', gasTypes: [...], values: [...] }
✅ Reading saved
🤖 Calling ML service...
✅ ML prediction received: { riskState: 'NORMAL', ... }
```

**Check ML Terminal (Terminal 1):**

You should see:
```
INFO:GasGuard-ML:Prediction: PPM=NORMAL, Anomaly=NORMAL, Final=NORMAL
127.0.0.1 - - [04/Feb/2026 14:30:22] "POST /predict HTTP/1.1" 200 -
```

✅ **Checkpoint:** Services communicating correctly

---

## 📊 Part 5: Service Status Overview

### **Check All Services:**

| Service | Port | Status | How to Check |
|---------|------|--------|--------------|
| ML Service | 5000 | ⬜ Running | `curl http://localhost:5000/health` |
| Backend | 3001 | ⬜ Running | `curl http://localhost:3001/api/health` |
| Blockchain | 3002 | ⬜ Running | `curl http://localhost:3002/network-status` |

### **Service Logs:**

**Terminal 1 (ML Service):** Should show prediction requests
**Terminal 2 (Backend):** Should show API requests and database operations
**Terminal 3 (Blockchain):** Should show event logging (if enabled)

---

## 🌐 Part 6: Open Dashboard (Optional)

### **Method 1: HTML Dashboards**

**Open in browser:**
```
file:///D:/AAA/Final%20Submission/GasGuard/Dashboard/main.html
```

Or double-click:
```
Dashboard/main.html
```

**Should show:**
- Real-time gas readings (from simulator)
- Risk state indicators
- Alert notifications

### **Method 2: React Frontend** (if you want)

**Terminal 5:**
```bash
cd "D:\AAA\Final Submission\GasGuard\frontend"

npm install
npm start
```

Opens browser at `http://localhost:3000`

---

## 🎯 Service Control Commands

### **Stop a Service:**
- Press `Ctrl+C` in the terminal

### **Restart a Service:**
- Stop it (`Ctrl+C`)
- Run start command again

### **View Logs:**
- Just look at the terminal output
- Backend logs go to console
- ML logs show in ML terminal

---

## 📋 Quick Reference

### **Start All Services (Quick):**

**Terminal 1:**
```bash
cd "D:\AAA\Final Submission\GasGuard\ml-service"
python app.py
```

**Terminal 2:**
```bash
cd "D:\AAA\Final Submission\GasGuard\backend"
npm run dev
```

**Terminal 3:**
```bash
cd "D:\AAA\Final Submission\GasGuard\blockchain-service"
npm start
```

### **Test Commands:**

```bash
# Health checks
curl http://localhost:5000/health
curl http://localhost:3001/api/health
curl http://localhost:3002/network-status

# Send test reading
curl -X POST http://localhost:3001/api/readings -H "Content-Type: application/json" -d "{\"clientID\":\"TEST\",\"gasTypes\":[\"CH4\",\"LPG\",\"CO\",\"H2S\"],\"values\":[1500,800,45,12]}"

# Get recent readings
curl http://localhost:3001/api/readings

# Get alerts
curl http://localhost:3001/api/alerts
```

---

## ✅ Completion Checklist

- [ ] ML service started successfully
- [ ] ML service shows "TRAINED" status
- [ ] Backend started successfully
- [ ] Backend connected to MongoDB
- [ ] Blockchain service started (or simulation mode)
- [ ] ML service responds to health check
- [ ] Backend responds to health check
- [ ] Backend can call ML service
- [ ] Test reading processed successfully
- [ ] All 3 terminals running

---

## 🐛 Common Issues

### **ML Service Issues:**

**Problem:** Model not loading
```bash
# Check model exists
dir ml-service\models\gas_leak_model.h5
# If not found, retrain model (Step 1)
```

**Problem:** Port 5000 in use
```bash
netstat -ano | findstr :5000
taskkill /PID <NUMBER> /F
```

### **Backend Issues:**

**Problem:** MongoDB connection failed
```bash
# Check .env file exists
type backend\.env

# Check MongoDB is running
# Local: mongod
# Atlas: check connection string
```

**Problem:** Cannot reach ML service
```bash
# Make sure ML service (Terminal 1) is running
# Check http://localhost:5000/health works
```

### **General Issues:**

**Problem:** "Command not found"
```bash
# Make sure you're in the right directory
cd "D:\AAA\Final Submission\GasGuard\[service-folder]"
```

---

## 🎉 Success!

If all services are running, you're ready for **Step 3**!

📖 **Next Guide:** `03_TEST_SYSTEM.md`

This will:
1. Run automated test suite
2. Test all classification scenarios
3. Verify hybrid classification
4. Generate test reports

---

**Keep your services running!** You'll need them for testing.

**Service Status:**
- ✅ Terminal 1: ML Service (port 5000)
- ✅ Terminal 2: Backend (port 3001)
- ✅ Terminal 3: Blockchain (port 3002)
