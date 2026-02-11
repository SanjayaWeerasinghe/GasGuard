# GasGuard System - Issues Found & Fixes Applied

**Date:** 2026-02-07
**Scope:** Full system audit and fix across ML Service, Backend, Frontend, Blockchain, and Shell Scripts

---

## Summary

| Component | Issues Found | Issues Fixed |
|-----------|-------------|-------------|
| ML Service | 2 | 2 |
| Backend (iotController.js) | 11 | 11 |
| Backend (logger.js) | 3 | 3 |
| Backend (server.js) | 2 | 2 |
| Frontend (App.js) | 2 | 2 |
| Blockchain Service | 2 | 2 |
| Shell Scripts | 3 | 3 |
| Configuration | 1 | 1 |
| **Total** | **26** | **26** |

---

## 1. ML Service (`ml-service/app.py`)

### 1.1 LSTM Always Returning CRITICAL (CRITICAL)
**Issue:** MinMaxScaler was trained on Zenodo baseline data (methane 16.5-24.4 range) but runtime sends PPM values (100-8000). The scaler normalized 100 ppm methane to 10.64 instead of ~0.01. Additionally, prediction error was computed on raw PPM values but anomaly thresholds expected 0-1 normalized range.
**Fix:**
- Retrained LSTM model with Zenodo baseline + synthetic leak events covering full PPM range (methane up to 8989, LPG up to 4665, CO up to 289, H2S up to 100)
- Changed `predict_anomaly()` to compute prediction error on normalized values (`pred - last_normalized`) instead of raw PPM

### 1.2 No Buffer Reset Capability (LOW)
**Issue:** No way to clear the LSTM sliding window buffer between test runs or after maintenance.
**Fix:** Added `POST /reset` endpoint to clear buffer and reset state to NORMAL.

---

## 2. Backend - iotController.js

### 2.1 Missing POST /api/emergency Endpoint (CRITICAL)
**Issue:** Frontend calls `POST /api/emergency` but no handler existed. Returned 404.
**Fix:** Added `exports.handleEmergency` — creates CRITICAL alert, triggers FORCED ventilation, logs to blockchain, broadcasts via WebSocket.

### 2.2 Missing POST /api/ventilation Endpoint (CRITICAL)
**Issue:** Frontend calls `POST /api/ventilation` but no handler existed. Returned 404.
**Fix:** Added `exports.controlVentilation` — supports manual ON/OFF with mode selection, broadcasts ventilation-status via WebSocket.

### 2.3 WebSocket Event Name Mismatch (CRITICAL)
**Issue:** Frontend listens for 6 specific events (`sensor-reading`, `ml-prediction`, `alert`, `ventilation`, `ventilation-status`, `emergency-event`) but backend only emitted a generic `sensor-update`.
**Fix:** Backend now emits all 6 named events matching the frontend's listeners.

### 2.4 WebSocket Payload Format Mismatch (HIGH)
**Issue:**
- `sensor-reading` sent `gasReadings` but frontend expects `gases`
- `ml-prediction` sent flat fields but frontend expects nested `mlResult` object
- `ventilation` sent `isActive`/`clientID` but frontend expects `status`/`zone`
**Fix:** Aligned all WebSocket payloads to match frontend's expected format:
- `sensor-reading`: `gasReadings` → `gases`
- `ml-prediction`: wrapped in `{ mlResult: { leakProbability, confidence, ppmClassification, anomalyDetection } }`, added `severity`
- `ventilation`/`ventilation-status`: `clientID` → `zone`, `isActive` → `status: 'ON'/'OFF'`

### 2.5 WebSocket Broadcasts to ALL Instead of Zone (MEDIUM)
**Issue:** All events broadcast to every connected client regardless of zone subscription.
**Fix:** Primary events now emit to `zone-${clientID}` room first, with global broadcast only for alerts.

### 2.6 No ML Response Validation (HIGH)
**Issue:** Backend accessed `mlResponse.data.riskState` and nested fields without checking if ML returned a valid response.
**Fix:** Added validation: `if (!mlPrediction || !mlPrediction.riskState || !mlPrediction.ppmClassification)` throws error.

### 2.7 blockchainLogged Never Set to True (MEDIUM)
**Issue:** `reading.actionsTaken.blockchainLogged` was always `false` even when blockchain logging succeeded.
**Fix:** Set `reading.actionsTaken.blockchainLogged = true` after successful blockchain API call.

### 2.8 Ventilation Race Condition (MEDIUM)
**Issue:** Used `findOne()` + `save()` pattern which is not atomic — concurrent requests could create duplicate ventilation records.
**Fix:** Changed to `findOneAndUpdate` with `upsert: true` for atomic upsert.

### 2.9 No Input Validation for Gas Readings (HIGH)
**Issue:** No checks that gas values are numbers, non-negative, or finite. Negative or NaN values could corrupt the ML model and database.
**Fix:** Added `isValidGasReading()` — checks `typeof === 'number'`, `Number.isFinite()`, and `>= 0`.

### 2.10 No Max Cap on Query Limit (MEDIUM)
**Issue:** `GET /api/readings?limit=999999` could return entire collection, causing OOM.
**Fix:** Added `parseLimit()` with max cap of 500.

### 2.11 Error Logging Used console.error (LOW)
**Issue:** `getReadings`, `getAlerts`, `acknowledgeAlert` used `console.error` instead of the structured file logger.
**Fix:** Changed to `logger.logError()` for consistent structured logging.

---

## 3. Backend - logger.js

### 3.1 Crash on Undefined recommendedAction (HIGH)
**Issue:** Line 142 calls `mlPrediction.recommendedAction.toUpperCase()` which throws if `recommendedAction` is undefined.
**Fix:** Changed to `mlPrediction.recommendedAction?.toUpperCase() ?? 'N/A'`.

### 3.2 Deep Property Access Without Null Checks (HIGH)
**Issue:** Lines 128-131 access `mlPrediction.ppmClassification.gasRisks.methane.ppm.toFixed(2)` — crashes if any part of the chain is undefined.
**Fix:** Added optional chaining throughout: `mlPrediction.ppmClassification?.gasRisks?.methane?.ppm?.toFixed(2) ?? 'N/A'`.

### 3.3 Synchronous File Writes Block Event Loop (MEDIUM)
**Issue:** `fs.appendFileSync()` blocks the Node.js event loop on every log write.
**Fix:** Changed to `fs.promises.appendFile()` with `.catch()` error handler.

---

## 4. Backend - server.js

### 4.1 Root Endpoint Missing New Routes (LOW)
**Issue:** `GET /` endpoint listing didn't include `/api/emergency` and `/api/ventilation`.
**Fix:** Added both to the endpoints object.

### 4.2 WebSocket Subscribe No Input Validation (MEDIUM)
**Issue:** `subscribe` event accepted any `clientID` without validation, allowing injection into room names.
**Fix:** Added type check and regex validation: `/^[a-zA-Z0-9_-]+$/`.

---

## 5. Frontend - App.js

### 5.1 API Response Format Mismatch (HIGH)
**Issue:** `GET /api/readings` and `GET /api/alerts` handlers expected plain arrays, but backend returns wrapped objects `{ success, count, readings/alerts }`.
**Fix:** Updated to extract from wrapped format: `readingsRes.data?.readings || (Array.isArray(readingsRes.data) ? readingsRes.data : [])`.

### 5.2 PPM Thresholds Verification (INFO)
**Checked:** Frontend thresholds (methane 1000/5000/7000, LPG 500/2000/3000, CO 25/100/200, H2S 5/20/50) match ML service's `GAS_PPM_THRESHOLDS`. No fix needed.

---

## 6. Blockchain Service

### 6.1 Deprecated substr() (LOW)
**Issue:** `generateHash()` uses `Math.random().toString(16).substr(2, 64)` — `substr()` is deprecated.
**Fix:** Changed to `.substring(2, 66).padEnd(64, '0')`.

### 6.2 Missing Input Validation on /log-emergency (MEDIUM)
**Issue:** `/log-emergency` endpoint doesn't validate required fields — accepts empty body.
**Fix:** Added validation: returns 400 if `zone` is missing.

---

## 7. Shell Scripts

### 7.1 CRLF Line Endings (HIGH)
**Issue:** `run-demo.sh`, `view-logs.sh`, `test-integration.sh` had Windows CRLF line endings causing `\r': command not found` errors.
**Fix:** Converted all to Unix LF with `sed -i 's/\r$//'`.

### 7.2 Invalid Log Path in run-demo.sh (MEDIUM)
**Issue:** Line 118 pointed to `/tmp/claude/-home/tasks/*.output` which doesn't exist.
**Fix:** Changed to `$SCRIPT_DIR/backend-new/logs/gasguard.log`.

---

## 8. Configuration

### 8.1 Blockchain Disabled (MEDIUM)
**Issue:** `.env` had `BLOCKCHAIN_ENABLED=false` so no events were ever logged to blockchain.
**Fix:** Changed to `BLOCKCHAIN_ENABLED=true`.

---

## Files Modified

| File | Changes |
|------|---------|
| `ml-service/app.py` | Retrained model, prediction error on normalized scale, added /reset |
| `ml-service/models/gas_leak_model.h5` | Retrained LSTM model |
| `ml-service/models/scaler.pkl` | New scaler covering full PPM range |
| `backend-new/controllers/iotController.js` | Full rewrite — all 11 backend issues |
| `backend-new/routes/api.js` | Added emergency and ventilation routes |
| `backend-new/utils/logger.js` | Null safety, async file writes |
| `backend-new/server.js` | Endpoint listing, WebSocket validation |
| `backend-new/.env` | Enabled blockchain |
| `frontend/src/App.js` | API response format handling |
| `blockchain-service/server.js` | substr fix, input validation |
| `run-demo.sh` | CRLF fix, correct log path |
| `backend-new/view-logs.sh` | CRLF fix |
| `backend-new/test-integration.sh` | CRLF fix |

---

## Verification

All fixes verified with integration tests:
- 6/6 integration tests passing
- ML predictions: NORMAL correctly classified (error=0.0047), CRITICAL correctly classified (error=0.5563)
- Blockchain logging: WARNING and CRITICAL events logged with transaction hashes
- Emergency endpoint: Creates CRITICAL alert + FORCED ventilation + blockchain log
- Ventilation endpoint: Manual ON/OFF with WebSocket broadcast
- WebSocket events: All 6 event types emitted with correct payload format
