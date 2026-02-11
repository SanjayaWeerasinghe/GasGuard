# 🔧 GasGuard Troubleshooting Guide

**Complete reference for fixing common issues**

---

## 📋 Table of Contents

1. [Model Training Issues](#model-training-issues)
2. [ML Service Issues](#ml-service-issues)
3. [Backend Issues](#backend-issues)
4. [Database Issues](#database-issues)
5. [Testing Issues](#testing-issues)
6. [Integration Issues](#integration-issues)
7. [Performance Issues](#performance-issues)
8. [Windows-Specific Issues](#windows-specific-issues)
9. [Network & Port Issues](#network--port-issues)
10. [Quick Diagnostics](#quick-diagnostics)

---

## 🧠 Model Training Issues

### **Problem: "ModuleNotFoundError: No module named 'tensorflow'"**

**Cause:** TensorFlow not installed or wrong Python environment

**Solution:**
```bash
# Install TensorFlow
pip install tensorflow

# If that fails, try:
pip install --upgrade pip
pip install tensorflow

# Verify installation
python -c "import tensorflow; print(tensorflow.__version__)"
```

**Expected output:** `2.x.x` (any 2.x version)

---

### **Problem: "No Excel files found in dataset directory"**

**Cause:** Dataset not downloaded or wrong path

**Solution:**
```bash
# Check dataset exists
dir "D:\AAA\Final Submission\Datasets\zenodo"

# Should show:
# cng_sensor.xlsx
# co_sensor.xlsx
# lpg_sensor.xlsx
```

**If empty:**
1. Re-download from https://zenodo.org/records/6616632
2. Extract to `D:\AAA\Final Submission\Datasets\zenodo`
3. Verify .xlsx files are there

---

### **Problem: "ModuleNotFoundError: No module named 'openpyxl'"**

**Cause:** Excel file reader not installed

**Solution:**
```bash
pip install openpyxl
```

---

### **Problem: Training is very slow (>1 hour)**

**Cause:** Normal on CPU, but can be optimized

**Solutions:**

**Option 1: Reduce epochs for testing**
```bash
# Edit train_zenodo.py line ~20
EPOCHS = 10  # Change from 100 to 10 for quick test
```

**Option 2: Reduce batch size**
```bash
# Edit train_zenodo.py line ~21
BATCH_SIZE = 16  # Change from 32 to 16
```

**Option 3: Use GPU (if available)**
```bash
pip install tensorflow-gpu
```

**Expected training times:**
- CPU: 10-20 minutes (100 epochs)
- GPU: 2-5 minutes (100 epochs)
- Quick test (10 epochs): 2-3 minutes

---

### **Problem: "Out of memory" during training**

**Cause:** Not enough RAM

**Solution:**
```bash
# Reduce batch size in train_zenodo.py
BATCH_SIZE = 8  # Change from 32 to 8
```

Or:
```bash
# Use smaller dataset
# Edit train_zenodo.py to use fewer samples
max_samples = 2000  # Instead of full dataset
```

---

### **Problem: High prediction error (MAE > 0.2)**

**Cause:** Model not learning properly

**Solutions:**

**Check 1: Dataset quality**
```bash
# Verify files have data
dir ml-service\models\gas_leak_model.h5

# Should be 2-5 MB, not empty
```

**Check 2: Training completed**
- Did early stopping trigger too soon?
- Check training output for "epochs completed"

**Check 3: Retrain with more epochs**
```bash
# Edit train_zenodo.py
EPOCHS = 150  # Increase from 100
```

**Check 4: Check data normalization**
- Training script should show "Data normalized using MinMaxScaler"

---

### **Problem: "ValueError: Failed to convert a NumPy array to a Tensor"**

**Cause:** Data shape mismatch or NaN values

**Solution:**
```python
# Edit train_zenodo.py, add after data loading:
import numpy as np

# Remove NaN values
data = np.nan_to_num(data, nan=0.0, posinf=0.0, neginf=0.0)

# Verify shape
print(f"Data shape: {data.shape}")  # Should be (samples, 4)
```

---

## 🤖 ML Service Issues

### **Problem: "Model not found" when starting ML service**

**Cause:** Model file doesn't exist or wrong path

**Solution:**
```bash
# Check model exists
dir ml-service\models\gas_leak_model.h5

# If not found, train model:
cd ml-service
python train_zenodo.py ..\Datasets\zenodo

# Verify creation
dir models\gas_leak_model.h5
```

---

### **Problem: ML service shows "Model Status: ⚠️ UNTRAINED"**

**Cause:** Using old `app.py` instead of trained version

**Solution:**
```bash
cd ml-service

# Check which version you're using
type app.py | findstr "load_trained_model"

# If not found, update:
copy app_with_trained_model.py app.py

# Restart service
python app.py
```

**Expected output:**
```
Model Status: ✅ TRAINED
Scaler Status: ✅ LOADED
```

---

### **Problem: "Port 5000 already in use"**

**Cause:** Another process using port 5000

**Solution:**
```bash
# Windows: Find and kill process
netstat -ano | findstr :5000
# Note the PID (last column)

taskkill /PID <PID_NUMBER> /F

# Then restart ML service
python app.py
```

**Alternative:** Change port in `app.py`
```python
# Edit app.py, last line:
app.run(host='0.0.0.0', port=5001)  # Change from 5000
```

---

### **Problem: "ModuleNotFoundError: No module named 'flask'"**

**Cause:** Flask not installed

**Solution:**
```bash
pip install flask flask-cors
```

---

### **Problem: Predictions always return NORMAL**

**Cause:** Model not loaded or using random warm-up

**Solution:**

**Check 1: Verify model loaded**
```bash
# ML service terminal should show:
# ✅ Model loaded successfully
# ✅ Scaler loaded successfully
```

**Check 2: Use correct app.py**
```bash
cd ml-service
type app.py | findstr "load_trained_model"
# Should show function definition

# If not found:
copy app_with_trained_model.py app.py
```

**Check 3: Test prediction directly**
```bash
curl -X POST http://localhost:5000/predict ^
  -H "Content-Type: application/json" ^
  -d "{\"values\": [3000, 2000, 100, 50]}"
```

Should return high risk (WARNING or CRITICAL), not NORMAL.

---

### **Problem: "Cannot import name '_registerMatType' from 'cv2.cv2'"**

**Cause:** OpenCV version conflict (not needed for ML service)

**Solution:**
```bash
# ML service doesn't use OpenCV, you can ignore this
# Or uninstall/reinstall if it blocks imports:
pip uninstall opencv-python opencv-python-headless
pip install opencv-python
```

---

## 🔌 Backend Issues

### **Problem: "MONGO_URI missing in .env"**

**Cause:** `.env` file not created

**Solution:**
```bash
cd backend

# Create .env file
echo MONGO_URI=mongodb://localhost:27017/gasguard > .env

# For MongoDB Atlas:
echo MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/gasguard > .env
```

**Verify:**
```bash
type .env
# Should show MONGO_URI=...
```

---

### **Problem: "MongoDB connection failed"**

**Cause:** MongoDB not running or wrong connection string

**Solutions:**

**Local MongoDB:**
```bash
# Check MongoDB is running
sc query MongoDB

# If not running, start it:
net start MongoDB
```

**MongoDB Atlas:**
```bash
# Check connection string format:
# mongodb+srv://username:password@cluster.mongodb.net/gasguard

# Common issues:
# ❌ Forgot to replace <password>
# ❌ Forgot to whitelist IP address
# ❌ Wrong database name
```

**Test connection:**
```bash
# In MongoDB Compass or:
mongosh "mongodb://localhost:27017"
```

---

### **Problem: "Port 3001 already in use"**

**Cause:** Previous backend instance still running

**Solution:**
```bash
# Windows: Find and kill process
netstat -ano | findstr :3001
taskkill /PID <PID_NUMBER> /F

# Restart backend
npm run dev
```

---

### **Problem: "Cannot find module 'express'"**

**Cause:** npm packages not installed

**Solution:**
```bash
cd backend

# Install dependencies
npm install

# Verify package.json exists
type package.json
```

---

### **Problem: "nodemon not found"**

**Cause:** Nodemon not installed globally or locally

**Solution:**
```bash
cd backend

# Option 1: Use node instead
node server.js

# Option 2: Install nodemon locally
npm install --save-dev nodemon

# Option 3: Install globally
npm install -g nodemon
```

---

### **Problem: Backend can't reach ML service**

**Cause:** ML service not running or wrong URL

**Solution:**

**Check 1: Verify ML service is running**
```bash
curl http://localhost:5000/health
```

**Should return:**
```json
{"status": "online", "service": "GasGuard ML Engine"}
```

**Check 2: Verify backend config**
```javascript
// In backend/server.js, check:
const ML_SERVICE_URL = 'http://localhost:5000';
// Make sure port matches ML service
```

**Check 3: Test from backend machine**
```bash
# If services on different machines:
curl http://<ML_SERVICE_IP>:5000/health
```

---

## 💾 Database Issues

### **Problem: "Collection not found"**

**Cause:** First run, collections will be created automatically

**Solution:** This is normal! Collections are created on first insert.

**Verify:**
```bash
# After sending first reading:
curl http://localhost:3001/api/readings

# Should return readings array (even if empty)
```

---

### **Problem: Readings not being saved**

**Cause:** Database connection issue or model schema error

**Solution:**

**Check 1: MongoDB connected**
```bash
# Backend terminal should show:
# 🔥 MongoDB Atlas Connected Successfully
```

**Check 2: Test directly**
```bash
curl -X POST http://localhost:3001/api/readings ^
  -H "Content-Type: application/json" ^
  -d "{\"clientID\":\"TEST\",\"gasTypes\":[\"CH4\",\"LPG\",\"CO\",\"H2S\"],\"values\":[100,50,10,2]}"
```

**Check 3: View backend logs**
- Look for error messages in Terminal 2 (backend)
- Check for Mongoose schema validation errors

---

### **Problem: "VersionError: No matching document found"**

**Cause:** Document changed between read and update (rare)

**Solution:**
```bash
# Clear database and restart:
# In MongoDB shell or Compass:
db.readings.deleteMany({})
db.alerts.deleteMany({})
```

---

## 🧪 Testing Issues

### **Problem: "Connection refused" during tests**

**Cause:** Services not running

**Solution:**
```bash
# Start ML service (Terminal 1)
cd ml-service
python app.py

# Start backend (Terminal 2)
cd backend
npm run dev

# Wait for both to show "Running on..."
# Then run tests (Terminal 3)
python test_classification.py
```

---

### **Problem: "ModuleNotFoundError: No module named 'requests'"**

**Cause:** Requests library not installed

**Solution:**
```bash
pip install requests
```

---

### **Problem: Tests fail with wrong classification**

**Cause:** Model not trained or thresholds wrong

**Solution:**

**Check 1: Verify model trained**
```bash
# ML service terminal should show:
# Model Status: ✅ TRAINED
```

**Check 2: Test single scenario**
```bash
curl -X POST http://localhost:3001/api/readings ^
  -H "Content-Type: application/json" ^
  -d "{\"clientID\":\"DEBUG\",\"gasTypes\":[\"CH4\",\"LPG\",\"CO\",\"H2S\"],\"values\":[100,50,5,1]}"
```

**Should return:** `"riskState": "NORMAL"`

**Check 3: Review thresholds**
```bash
# Check ml-service/app.py for correct thresholds
type ml-service\app.py | findstr "ANOMALY_THRESHOLDS"
```

---

### **Problem: Test suite timeout**

**Cause:** Services responding slowly

**Solution:**
```python
# Edit test_classification.py, increase timeout:
response = requests.post(url, json=data, timeout=30)  # Change from 10
```

---

## 🔗 Integration Issues

### **Problem: Backend receives data but no ML prediction**

**Cause:** ML service call failing silently

**Solution:**

**Check 1: Enable debug logs**
```javascript
// In backend/server.js, add:
console.log('Calling ML service:', ML_SERVICE_URL);
console.log('Payload:', readingData);

// Check response
console.log('ML Response:', mlResponse.data);
```

**Check 2: Test ML service directly**
```bash
curl -X POST http://localhost:5000/predict ^
  -H "Content-Type: application/json" ^
  -d "{\"values\": [100, 50, 10, 2]}"
```

**Check 3: Verify CORS enabled**
```python
# In ml-service/app.py, should have:
from flask_cors import CORS
CORS(app)
```

---

### **Problem: Blockchain logging fails**

**Cause:** Blockchain service not running (optional)

**Solution:**

**Option 1: Start blockchain service**
```bash
cd blockchain-service
npm install
npm start
```

**Option 2: Use simulation mode**
- Backend will log to console if blockchain unavailable
- Check Terminal 2 for "Blockchain logged (simulated)"

**This is OK for testing!** Blockchain is optional.

---

### **Problem: WebSocket not connecting**

**Cause:** Backend WebSocket not configured

**Solution:**

**Check 1: Verify Socket.IO installed**
```bash
cd backend
npm install socket.io
```

**Check 2: Check server.js has WebSocket setup**
```javascript
// Should have:
const io = require('socket.io')(server);
```

**Check 3: Test WebSocket endpoint**
```javascript
// In browser console or frontend:
const socket = io('http://localhost:3001');
socket.on('connect', () => console.log('Connected!'));
```

---

## ⚡ Performance Issues

### **Problem: Slow response times (>1 second)**

**Cause:** Various bottlenecks

**Solutions:**

**Check 1: ML service latency**
```bash
# Test ML service alone:
curl -w "\nTime: %{time_total}s\n" ^
  -X POST http://localhost:5000/predict ^
  -H "Content-Type: application/json" ^
  -d "{\"values\": [100, 50, 10, 2]}"
```

**Target:** < 100ms

**Check 2: Database latency**
- MongoDB Atlas: Check cluster performance
- Local MongoDB: Restart MongoDB service

**Check 3: Network latency**
- If services on different machines, check network
- Use `localhost` instead of IP if on same machine

**Optimization tips:**
```python
# In ml-service/app.py:
# Ensure model is loaded once at startup, not per request

# Preload scaler
scaler = load_scaler()  # At top, not in function
```

---

### **Problem: High memory usage**

**Cause:** TensorFlow loading model repeatedly

**Solution:**
```python
# In ml-service/app.py, ensure global model:
model = None
scaler = None

def load_trained_model():
    global model, scaler
    if model is None:  # Only load once
        model = tf.keras.models.load_model('models/gas_leak_model.h5')
    if scaler is None:
        with open('models/scaler.pkl', 'rb') as f:
            scaler = pickle.load(f)
    return model, scaler
```

---

## 🪟 Windows-Specific Issues

### **Problem: "python: command not found"**

**Cause:** Python not in PATH

**Solutions:**

**Option 1: Use full path**
```bash
C:\Python39\python.exe app.py
```

**Option 2: Add to PATH**
1. Search "Environment Variables"
2. Edit PATH
3. Add Python installation directory
4. Restart terminal

**Option 3: Use Python launcher**
```bash
py app.py
```

---

### **Problem: curl not found**

**Cause:** curl not installed on older Windows

**Solutions:**

**Option 1: Use PowerShell Invoke-WebRequest**
```powershell
Invoke-WebRequest -Uri http://localhost:5000/health -Method GET
```

**Option 2: Install Git Bash** (includes curl)
- Download from https://git-scm.com/

**Option 3: Use Postman or browser**

---

### **Problem: Scripts use forward slashes, Windows uses backslashes**

**Solution:** Windows handles both! Use forward slashes in commands:
```bash
cd "D:/AAA/Final Submission/GasGuard"  # Works on Windows
```

---

### **Problem: "Access denied" when killing process**

**Cause:** Need administrator privileges

**Solution:**
```bash
# Run Command Prompt as Administrator
# Right-click → "Run as administrator"

taskkill /PID <PID> /F
```

---

## 🌐 Network & Port Issues

### **Problem: Multiple port conflicts (5000, 3001, 3002)**

**Solution:** Change ports in all services

**ML Service (app.py):**
```python
app.run(host='0.0.0.0', port=5001)  # Change from 5000
```

**Backend (server.js):**
```javascript
const PORT = 3002;  // Change from 3001
```

**Update backend ML service URL:**
```javascript
const ML_SERVICE_URL = 'http://localhost:5001';  // Match new ML port
```

**Restart all services with new ports**

---

### **Problem: "EADDRINUSE" error**

**Cause:** Port already in use

**Solution:**
```bash
# Check what's using the port
netstat -ano | findstr :<PORT>

# Kill the process
taskkill /PID <PID> /F

# Or change port (see above)
```

---

### **Problem: Firewall blocking connections**

**Cause:** Windows Firewall

**Solution:**
```bash
# Allow Node.js and Python through firewall:
# Windows Security → Firewall → Allow app

# Or temporarily disable (testing only):
# Windows Security → Firewall → Turn off
```

---

## 🔍 Quick Diagnostics

### **Run This Diagnostic Script:**

**Create `diagnose.bat`:**
```batch
@echo off
echo ========================================
echo GasGuard System Diagnostics
echo ========================================

echo.
echo [1] Checking Python...
python --version

echo.
echo [2] Checking Node.js...
node --version

echo.
echo [3] Checking npm...
npm --version

echo.
echo [4] Checking MongoDB...
sc query MongoDB

echo.
echo [5] Checking if model exists...
if exist "ml-service\models\gas_leak_model.h5" (
    echo ✅ Model found
) else (
    echo ❌ Model NOT found - run training!
)

echo.
echo [6] Checking if scaler exists...
if exist "ml-service\models\scaler.pkl" (
    echo ✅ Scaler found
) else (
    echo ❌ Scaler NOT found - run training!
)

echo.
echo [7] Checking ports...
echo Checking port 5000 (ML service):
netstat -ano | findstr :5000
echo Checking port 3001 (Backend):
netstat -ano | findstr :3001

echo.
echo [8] Testing ML service...
curl -s http://localhost:5000/health

echo.
echo [9] Testing Backend...
curl -s http://localhost:3001/api/health

echo.
echo ========================================
echo Diagnostics Complete
echo ========================================
pause
```

**Run:**
```bash
diagnose.bat
```

---

## 📋 Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| `ECONNREFUSED` | Service not running | Start the service |
| `ModuleNotFoundError` | Package not installed | `pip install <package>` |
| `Cannot find module` | npm package missing | `npm install` |
| `EADDRINUSE` | Port already in use | Kill process or change port |
| `MongooseError` | MongoDB issue | Check connection string |
| `404 Not Found` | Wrong URL/endpoint | Check API endpoint |
| `500 Internal Server Error` | Backend crash | Check backend terminal logs |
| `Model not found` | Training not done | Run `train_zenodo.py` |
| `Connection timeout` | Service too slow | Check performance |
| `CORS error` | Cross-origin issue | Enable CORS in Flask |

---

## 🆘 Still Having Issues?

### **Debug Checklist:**

1. **Check all terminals:**
   - Terminal 1: ML service running?
   - Terminal 2: Backend running?
   - Any error messages?

2. **Check all files exist:**
   - `ml-service/models/gas_leak_model.h5`
   - `ml-service/models/scaler.pkl`
   - `backend/.env`

3. **Check all services respond:**
   - `curl http://localhost:5000/health`
   - `curl http://localhost:3001/api/health`

4. **Check logs:**
   - ML service terminal output
   - Backend terminal output
   - MongoDB logs (if local)

5. **Restart everything:**
   ```bash
   # Stop all services (Ctrl+C in all terminals)
   # Restart in order:
   # 1. MongoDB (if local)
   # 2. ML service
   # 3. Backend
   # 4. Run tests
   ```

### **Get More Help:**

**Check documentation:**
- `00_START_HERE.md` - Overview
- `CLASSIFICATION_GUIDE.md` - System explanation
- `MODEL_TRAINING_GUIDE.md` - ML details

**Common issues already solved:**
- Review steps in `01_TRAIN_MODEL.md`
- Check `02_START_SERVICES.md` for startup sequence
- See `03_TEST_SYSTEM.md` for testing issues

---

## ✅ Prevention Tips

### **Before Training:**
- [ ] Verify dataset downloaded
- [ ] Install all Python packages
- [ ] Check Python version (3.8+)

### **Before Starting Services:**
- [ ] Model trained successfully
- [ ] `.env` file created (backend)
- [ ] MongoDB running
- [ ] Ports available (5000, 3001)

### **Before Testing:**
- [ ] Both services running
- [ ] Health checks pass
- [ ] Model shows "TRAINED" status

### **General:**
- [ ] Save terminal outputs for debugging
- [ ] Take screenshots of errors
- [ ] Check documentation first
- [ ] Test in small steps

---

**Most issues are fixed by:**
1. ✅ Making sure model is trained
2. ✅ Using correct `app.py` version
3. ✅ Starting services in correct order
4. ✅ Checking ports are available
5. ✅ Verifying all packages installed

**Good luck! 🚀**
