# 🧪 Step 3: Test Your System

**Estimated Time:** 15 minutes

This guide will run comprehensive tests to verify your hybrid classification system works correctly.

---

## ✅ Prerequisites

Before testing:

- [ ] Model trained (completed `01_TRAIN_MODEL.md`)
- [ ] All services running (completed `02_START_SERVICES.md`)
- [ ] ML service shows "TRAINED" status
- [ ] Backend connected to MongoDB
- [ ] Terminal 1 (ML service) still running
- [ ] Terminal 2 (Backend) still running

---

## 🎯 What We're Testing

Your GasGuard system has 3 main components to verify:

```
┌─────────────────────────────────────────────┐
│  1. ML Service (LSTM Anomaly Detection)    │
│     ✅ Model loads correctly                │
│     ✅ Predictions work                     │
│     ✅ Anomaly thresholds classify right    │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  2. Hybrid Classification System            │
│     ✅ PPM thresholds work                  │
│     ✅ ML anomaly detection works           │
│     ✅ Fusion rule (max risk) works         │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  3. Backend Integration                     │
│     ✅ Receives sensor data                 │
│     ✅ Calls ML service                     │
│     ✅ Stores classifications               │
│     ✅ Triggers alerts & ventilation        │
└─────────────────────────────────────────────┘
```

---

## 🚀 Part 1: Quick Health Check (2 minutes)

### **Test 1: Verify All Services Running**

**Open NEW terminal (Terminal 4):**

```bash
cd "D:\AAA\Final Submission\GasGuard"

# Check ML service
curl http://localhost:5000/health

# Check Backend
curl http://localhost:3001/api/health

# Check Blockchain (optional)
curl http://localhost:3002/network-status
```

### **Expected Responses:**

**ML Service:**
```json
{
  "status": "online",
  "service": "GasGuard ML Engine",
  "type": "TensorFlow + LSTM (Hybrid)",
  "modelStatus": "trained",
  "timestamp": "2026-02-04T..."
}
```

**Backend:**
```json
{
  "status": "ok",
  "service": "GasGuard Backend",
  "mongoConnected": true,
  "timestamp": "2026-02-04T..."
}
```

✅ **Checkpoint:** All services responding

---

## 🧪 Part 2: Automated Test Suite (5 minutes)

### **Run Complete Test Suite:**

```bash
cd "D:\AAA\Final Submission\GasGuard"

python test_classification.py
```

### **Expected Output:**

```
======================================================================
        🧪 GasGuard Classification Test Suite
======================================================================

Testing 7 scenarios with hybrid PPM + LSTM classification...

----------------------------------------------------------------------
Test 1: Normal Operation - PASS ✅
----------------------------------------------------------------------
Input: CH4=100, LPG=50, CO=5, H2S=1
Expected: NORMAL
Got: NORMAL
✅ Classification correct!

Details:
  PPM Classification: NORMAL
  ML Anomaly: NORMAL (error: 0.023)
  Final Risk: NORMAL (max of both)
  Dominant Gas: methane

----------------------------------------------------------------------
Test 2: Gradual CH4 Leak - PASS ✅
----------------------------------------------------------------------
Input: CH4=1500, LPG=60, CO=8, H2S=2
Expected: LOW_ANOMALY or UNUSUAL
Got: LOW_ANOMALY
✅ Classification correct!

Details:
  PPM Classification: LOW_ANOMALY (CH4: 1500 ppm)
  ML Anomaly: LOW_ANOMALY (error: 0.267)
  Final Risk: LOW_ANOMALY
  Dominant Gas: methane

----------------------------------------------------------------------
Test 3: LPG Alert Level - PASS ✅
----------------------------------------------------------------------
Input: CH4=200, LPG=1500, CO=15, H2S=3
Expected: ALERT or WARNING
Got: ALERT
✅ Classification correct!

Details:
  PPM Classification: ALERT (LPG: 1500 ppm)
  ML Anomaly: UNUSUAL (error: 0.534)
  Final Risk: ALERT (max of both)
  Dominant Gas: lpg

----------------------------------------------------------------------
Test 4: CO Warning Level - PASS ✅
----------------------------------------------------------------------
Input: CH4=150, LPG=100, CO=75, H2S=8
Expected: WARNING
Got: WARNING
✅ Classification correct!

Details:
  PPM Classification: WARNING (CO: 75 ppm)
  ML Anomaly: ALERT (error: 0.823)
  Final Risk: WARNING
  Dominant Gas: carbonMonoxide
  🚨 Triggered: Ventilation AUTO mode
  🔗 Logged to blockchain

----------------------------------------------------------------------
Test 5: H2S Critical Level - PASS ✅
----------------------------------------------------------------------
Input: CH4=300, LPG=200, CO=50, H2S=45
Expected: CRITICAL
Got: CRITICAL
✅ Classification correct!

Details:
  PPM Classification: CRITICAL (H2S: 45 ppm)
  ML Anomaly: CRITICAL (error: 1.567)
  Final Risk: CRITICAL
  Dominant Gas: hydrogenSulfide
  🚨 Triggered: Ventilation FORCED mode
  🚨 Emergency alert created
  🔗 Logged to blockchain

----------------------------------------------------------------------
Test 6: Multi-Gas Moderate - PASS ✅
----------------------------------------------------------------------
Input: CH4=800, LPG=400, CO=20, H2S=6
Expected: UNUSUAL or ALERT
Got: UNUSUAL
✅ Classification correct!

Details:
  PPM Classification: UNUSUAL (multiple gases elevated)
  ML Anomaly: UNUSUAL (error: 0.412)
  Final Risk: UNUSUAL
  Multi-gas event detected

----------------------------------------------------------------------
Test 7: Sudden Spike Detection - PASS ✅
----------------------------------------------------------------------
Input: CH4=100→3500 (sudden jump)
Expected: WARNING or CRITICAL
Got: WARNING
✅ Classification correct!

Details:
  PPM Classification: WARNING (CH4: 3500 ppm)
  ML Anomaly: WARNING (error: 1.023)
  Final Risk: WARNING
  Sudden change detected by LSTM
  🚨 Triggered: Ventilation AUTO mode
  🔗 Logged to blockchain

======================================================================
                    Test Results Summary
======================================================================

Total Tests: 7
Passed: 7 ✅
Failed: 0 ❌
Success Rate: 100%

Classification Accuracy:
  ✅ PPM thresholds working correctly
  ✅ LSTM anomaly detection working
  ✅ Hybrid fusion rule working
  ✅ Ventilation triggering correct
  ✅ Blockchain logging correct

======================================================================
                    ✅ ALL TESTS PASSED!
======================================================================

Your GasGuard system is fully operational! 🎉
```

### **✅ Success Indicators:**

- ✅ All 7 tests pass
- ✅ No "FAIL ❌" messages
- ✅ Classifications match expected ranges
- ✅ Ventilation triggers for WARNING/CRITICAL
- ✅ Blockchain logging for WARNING/CRITICAL

### **❌ If Tests Fail:**

**Problem:** Test fails with "Connection refused"
```bash
# Make sure services are running
# Check Terminal 1 (ML service) and Terminal 2 (Backend)
```

**Problem:** Classification incorrect
```bash
# Check ML service loaded trained model:
# Terminal 1 should show "Model Status: ✅ TRAINED"
# If not, go back to Step 1 and retrain
```

**Problem:** ML predictions always NORMAL
```bash
# Model not trained properly
cd ml-service
python train_zenodo.py ..\Datasets\zenodo
```

✅ **Checkpoint:** All automated tests pass

---

## 🔬 Part 3: Manual Testing (5 minutes)

### **Test Individual Scenarios:**

**Test A: Normal Reading**
```bash
curl -X POST http://localhost:3001/api/readings ^
  -H "Content-Type: application/json" ^
  -d "{\"clientID\":\"TEST001\",\"gasTypes\":[\"CH4\",\"LPG\",\"CO\",\"H2S\"],\"values\":[100,50,10,2]}"
```

**Expected Response:**
```json
{
  "success": true,
  "reading": {
    "clientID": "TEST001",
    "CH4": 100,
    "LPG": 50,
    "CO": 10,
    "H2S": 2
  },
  "mlResult": {
    "riskState": "NORMAL",
    "confidence": "high",
    "ppmRisk": "NORMAL",
    "anomalyRisk": "NORMAL",
    "predictionError": 0.023,
    "dominantGas": "methane"
  }
}
```

**Check Backend Terminal (Terminal 2):**
```
📥 Incoming reading: { clientID: 'TEST001', ... }
✅ Reading saved: 67890abcdef...
🤖 Calling ML service...
✅ ML prediction: NORMAL (error: 0.023)
```

**Check ML Terminal (Terminal 1):**
```
INFO:GasGuard-ML:Hybrid Classification: PPM=NORMAL, Anomaly=NORMAL, Final=NORMAL
127.0.0.1 - - [04/Feb/2026 15:30:22] "POST /predict HTTP/1.1" 200 -
```

---

**Test B: Critical H2S Leak**
```bash
curl -X POST http://localhost:3001/api/readings ^
  -H "Content-Type: application/json" ^
  -d "{\"clientID\":\"TEST002\",\"gasTypes\":[\"CH4\",\"LPG\",\"CO\",\"H2S\"],\"values\":[200,100,30,45]}"
```

**Expected Response:**
```json
{
  "success": true,
  "mlResult": {
    "riskState": "CRITICAL",
    "confidence": "high",
    "ppmRisk": "CRITICAL",
    "anomalyRisk": "CRITICAL",
    "dominantGas": "hydrogenSulfide",
    "triggerVentilation": true,
    "ventilationMode": "FORCED"
  },
  "alert": {
    "severity": "critical",
    "message": "H2S: 45 ppm - CRITICAL level",
    "ventilationActivated": true,
    "blockchainLogged": true
  }
}
```

**Check Backend Terminal (Terminal 2):**
```
📥 Incoming reading: { clientID: 'TEST002', ... }
✅ Reading saved
🤖 Calling ML service...
🚨 CRITICAL RISK DETECTED!
🔗 Logging to blockchain...
✅ Blockchain logged: 0x1234567890abcdef...
🌬️  Activating ventilation: FORCED mode
🚨 Creating emergency alert
```

**Check ML Terminal (Terminal 1):**
```
INFO:GasGuard-ML:Hybrid Classification: PPM=CRITICAL, Anomaly=CRITICAL, Final=CRITICAL
INFO:GasGuard-ML:⚠️  H2S: 45.0 ppm (CRITICAL threshold: 20.0)
127.0.0.1 - - [04/Feb/2026 15:32:15] "POST /predict HTTP/1.1" 200 -
```

✅ **Checkpoint:** Manual tests working

---

## 📊 Part 4: Database Verification (3 minutes)

### **Check Readings Were Saved:**

```bash
curl http://localhost:3001/api/readings?limit=10
```

**Expected:**
```json
{
  "readings": [
    {
      "_id": "67890abcdef...",
      "clientID": "TEST002",
      "gasReadings": {
        "methane": 200,
        "lpg": 100,
        "carbonMonoxide": 30,
        "hydrogenSulfide": 45
      },
      "mlPrediction": {
        "riskState": "CRITICAL",
        "confidence": "high"
      },
      "timestamp": "2026-02-04T15:32:15.123Z"
    },
    ...
  ]
}
```

### **Check Alerts Were Created:**

```bash
curl http://localhost:3001/api/alerts?severity=critical
```

**Expected:**
```json
{
  "alerts": [
    {
      "_id": "12345abcdef...",
      "clientID": "TEST002",
      "severity": "critical",
      "message": "H2S: 45 ppm - CRITICAL level",
      "metadata": {
        "riskState": "CRITICAL",
        "dominantGas": "hydrogenSulfide",
        "ppmRisk": "CRITICAL",
        "anomalyRisk": "CRITICAL"
      },
      "ventilationActivated": true,
      "blockchainLogged": true,
      "timestamp": "2026-02-04T15:32:15.456Z"
    }
  ]
}
```

✅ **Checkpoint:** Data persisting correctly

---

## 🎯 Part 5: Classification Verification (Advanced)

### **Test All 6 Risk Levels:**

**Level 1: NORMAL**
```bash
curl -X POST http://localhost:3001/api/readings -H "Content-Type: application/json" -d "{\"clientID\":\"LEVEL1\",\"gasTypes\":[\"CH4\",\"LPG\",\"CO\",\"H2S\"],\"values\":[100,50,5,1]}"
```
Expected: `"riskState": "NORMAL"`

**Level 2: LOW_ANOMALY**
```bash
curl -X POST http://localhost:3001/api/readings -H "Content-Type: application/json" -d "{\"clientID\":\"LEVEL2\",\"gasTypes\":[\"CH4\",\"LPG\",\"CO\",\"H2S\"],\"values\":[1200,300,12,3]}"
```
Expected: `"riskState": "LOW_ANOMALY"`

**Level 3: UNUSUAL**
```bash
curl -X POST http://localhost:3001/api/readings -H "Content-Type: application/json" -d "{\"clientID\":\"LEVEL3\",\"gasTypes\":[\"CH4\",\"LPG\",\"CO\",\"H2S\"],\"values\":[800,400,20,6]}"
```
Expected: `"riskState": "UNUSUAL"`

**Level 4: ALERT**
```bash
curl -X POST http://localhost:3001/api/readings -H "Content-Type: application/json" -d "{\"clientID\":\"LEVEL4\",\"gasTypes\":[\"CH4\",\"LPG\",\"CO\",\"H2S\"],\"values\":[200,1500,15,4]}"
```
Expected: `"riskState": "ALERT"`

**Level 5: WARNING**
```bash
curl -X POST http://localhost:3001/api/readings -H "Content-Type: application/json" -d "{\"clientID\":\"LEVEL5\",\"gasTypes\":[\"CH4\",\"LPG\",\"CO\",\"H2S\"],\"values\":[150,100,75,8]}"
```
Expected: `"riskState": "WARNING"`, ventilation triggered

**Level 6: CRITICAL**
```bash
curl -X POST http://localhost:3001/api/readings -H "Content-Type: application/json" -d "{\"clientID\":\"LEVEL6\",\"gasTypes\":[\"CH4\",\"LPG\",\"CO\",\"H2S\"],\"values\":[300,200,50,45]}"
```
Expected: `"riskState": "CRITICAL"`, ventilation FORCED, blockchain logged

### **Verification Checklist:**

- [ ] All 6 risk levels can be triggered
- [ ] NORMAL: No alerts, no ventilation
- [ ] LOW_ANOMALY: Alert created, no ventilation
- [ ] UNUSUAL: Alert created, no ventilation
- [ ] ALERT: Alert created, no ventilation
- [ ] WARNING: Alert created, ventilation AUTO, blockchain logged
- [ ] CRITICAL: Emergency alert, ventilation FORCED, blockchain logged

✅ **Checkpoint:** All risk levels working

---

## 📈 Part 6: Performance Metrics Collection

### **Record These Values for Your Report:**

**From Test Suite Output:**
```
Classification Accuracy: ______%
Tests Passed: ______ / 7
PPM Classification: ✅ / ❌
LSTM Anomaly Detection: ✅ / ❌
Hybrid Fusion: ✅ / ❌
```

**From ML Service Terminal:**
```
Average Prediction Error (NORMAL): ______
Average Prediction Error (CRITICAL): ______
Model Response Time: ______ ms
```

**From Backend Terminal:**
```
Readings Processed: ______
Alerts Created: ______
Blockchain Transactions: ______
Ventilation Activations: ______
```

### **Test Response Times:**

```bash
# Measure end-to-end latency
curl -w "\nTime: %{time_total}s\n" -X POST http://localhost:3001/api/readings -H "Content-Type: application/json" -d "{\"clientID\":\"PERF\",\"gasTypes\":[\"CH4\",\"LPG\",\"CO\",\"H2S\"],\"values\":[100,50,10,2]}"
```

**Target Performance:**
- Total response time: < 500ms
- ML prediction: < 100ms
- Database save: < 50ms

✅ **Checkpoint:** Metrics recorded

---

## 🔄 Part 7: Stress Testing (Optional)

### **Test Multiple Readings:**

```bash
# Send 10 readings in sequence
for /l %i in (1,1,10) do @curl -s -X POST http://localhost:3001/api/readings -H "Content-Type: application/json" -d "{\"clientID\":\"STRESS%i\",\"gasTypes\":[\"CH4\",\"LPG\",\"CO\",\"H2S\"],\"values\":[100,50,10,2]}"
```

**Check:**
- [ ] All readings processed successfully
- [ ] No errors in backend terminal
- [ ] No crashes or timeouts
- [ ] Database contains all readings

✅ **Checkpoint:** System stable under load

---

## ✅ Completion Checklist

- [ ] Health check passed (all services responding)
- [ ] Automated test suite: 7/7 tests passed
- [ ] Manual normal reading test passed
- [ ] Manual critical reading test passed
- [ ] Database contains test readings
- [ ] Alerts created correctly
- [ ] All 6 risk levels can be triggered
- [ ] WARNING triggers ventilation AUTO
- [ ] CRITICAL triggers ventilation FORCED
- [ ] Blockchain logging works for WARNING/CRITICAL
- [ ] Performance metrics recorded
- [ ] Response times acceptable (< 500ms)
- [ ] System stable (no crashes)

---

## 📊 Test Results Summary Template

**Copy this for your report:**

```
GasGuard System Test Results
============================

Date: 2026-02-04
Duration: 15 minutes
Tester: [Your Name]

Automated Test Suite:
- Total Tests: 7
- Passed: ____ ✅
- Failed: ____ ❌
- Success Rate: ____%

Classification Tests:
- NORMAL detection: ✅ / ❌
- LOW_ANOMALY detection: ✅ / ❌
- UNUSUAL detection: ✅ / ❌
- ALERT detection: ✅ / ❌
- WARNING detection: ✅ / ❌
- CRITICAL detection: ✅ / ❌

Integration Tests:
- ML ↔ Backend communication: ✅ / ❌
- Database persistence: ✅ / ❌
- Alert creation: ✅ / ❌
- Ventilation triggering: ✅ / ❌
- Blockchain logging: ✅ / ❌

Performance:
- Average response time: ____ ms
- ML prediction time: ____ ms
- Readings processed: ____
- Zero errors: ✅ / ❌

Conclusion:
The GasGuard system successfully demonstrates:
✅ Hybrid PPM + LSTM classification
✅ 6-level risk state detection
✅ Automated ventilation control
✅ Blockchain audit logging
✅ Real-time monitoring capabilities
```

---

## 🐛 Troubleshooting

### **Test Suite Fails:**

**Problem:** "Connection refused"
- **Solution:** Start services (see `02_START_SERVICES.md`)

**Problem:** All classifications return NORMAL
- **Solution:** Model not trained or not loaded
  ```bash
  # Check ML service terminal shows "✅ TRAINED"
  # If not, retrain model (Step 1)
  ```

**Problem:** PPM classification wrong
- **Solution:** Check threshold values in `ml-service/app.py`

**Problem:** Anomaly detection not working
- **Solution:** Model needs retraining with more data

### **Manual Tests Fail:**

**Problem:** curl command not found
- **Solution:** Windows: Use Git Bash or install curl

**Problem:** Response shows 500 error
- **Solution:** Check backend terminal for error details

**Problem:** No alerts created
- **Solution:** Check MongoDB connection in backend

---

## 🎉 Success!

If all checkboxes are marked, you're ready for **Step 4**!

📖 **Next Guide:** `04_PREPARE_REPORT.md`

This will:
1. Collect all metrics and screenshots
2. Generate performance plots
3. Create demo scenarios
4. Prepare academic report sections

---

**Your system is fully tested and operational! 🚀**

**Current Status:**
- ✅ Model trained and loaded
- ✅ Services running
- ✅ All tests passing
- ✅ Ready for demonstration
