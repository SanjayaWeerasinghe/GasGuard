/**
 * GasGuard Backend – Improved & Stabilized
 * (No new features, no behavior changes)
 */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const fetch = require("node-fetch");

// =======================
// App & Server Setup
// =======================

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: { origin: "*" }
});

app.set("io", io);

const PORT = process.env.PORT || 3001;

// =======================
// Middleware
// =======================

app.use(cors());
app.use(bodyParser.json({ limit: "2mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

// =======================
// API Routes
// =======================
app.use("/api/iot", require("./routes/iotRoutes"));

// =======================
// MongoDB Connection
// =======================

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("❌ MONGO_URI missing in .env");
  process.exit(1);
}

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("🔥 MongoDB Atlas Connected Successfully");

    server.listen(PORT, () => {
      console.log(`🚀 GasGuard backend running on port ${PORT}`);
      console.log(`📊 Health: http://localhost:${PORT}/api/health`);
    });
  })
  .catch(err => {
    console.error("❌ MongoDB Connection Error:", err);
    process.exit(1);
  });

// Make DB failures immediate (no buffering)
mongoose.set("bufferCommands", false);



// =======================
// Models
// =======================

const SensorReading = require("./models/SensorReading");
const Alert = require("./models/Alert");
const EmergencyEvent = require("./models/EmergencyEvent");
const VentilationStatus = require("./models/VentilationStatus");
const DeviceHealth = require("./models/DeviceHealth");
const blockchainClient = require("./blockchain/blockchainClient");

// =======================
// Routes
// =======================

const iotRoutes = require("./routes/iotRoutes");
app.use("/iot", iotRoutes);

// =======================
// Socket.IO
// =======================

io.on("connection", socket => {
  console.log("🔌 Client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("🔌 Client disconnected:", socket.id);
  });
});

// =======================
// Health Check
// =======================

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "GasGuard Backend",
    mongoConnected: mongoose.connection.readyState === 1,
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// SENSOR READINGS
// ============================================================================

app.post("/api/readings", async (req, res) => {
  console.log("📥 Incoming reading:", req.body);

  try {
    const { clientID, gasTypes, values, source } = req.body;

    if (!clientID || !Array.isArray(gasTypes) || !Array.isArray(values)) {
      return res.status(400).json({ error: "Invalid sensor payload" });
    }

    // 1️⃣ Save sensor reading
    const reading = await SensorReading.create({
      clientID,
      gasTypes,
      values,
      zone: "Zone_A",
      source: source || "iot"
    });

    // Emit live sensor data
    io.emit("sensor-reading", reading);

    // 2️⃣ Build gas map
    const gasMap = {};
    gasTypes.forEach((gas, i) => {
      gasMap[gas] = values[i];
    });

    // 3️⃣ ML Prediction
    let mlResult = null;
    try {
      const mlPayload = {
        sensorData: [
          {
            gases: {
              methane: gasMap["CH4"],
              lpg: gasMap["LPG"],
              carbonMonoxide: gasMap["CO"],
              hydrogenSulfide: gasMap["H2S"]
            },
            environmental: {
              temperature: 25,
              humidity: 60,
              pressure: 1013
            }
          }
        ]
      };

      const mlResponse = await fetch("http://127.0.0.1:5000/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mlPayload)
      });

      mlResult = await mlResponse.json();
    } catch (err) {
      console.warn("⚠️ ML service error:", err.message);
    }

    // 4️⃣ Alert + Automation + Blockchain (Enhanced with new risk states)
    if (mlResult && mlResult.riskState) {
      const riskState = mlResult.riskState; // NORMAL, LOW_ANOMALY, UNUSUAL, ALERT, WARNING, CRITICAL
      const riskLevel = riskState.toLowerCase();

      // Map risk states to alert severity for MongoDB
      const severityMap = {
        "NORMAL": "low",
        "LOW_ANOMALY": "low",
        "UNUSUAL": "medium",
        "ALERT": "medium",
        "WARNING": "high",
        "CRITICAL": "critical"
      };

      const severity = severityMap[riskState] || "medium";

      // Create alerts for UNUSUAL and above
      if (!["NORMAL", "LOW_ANOMALY"].includes(riskState)) {

        // Build detailed message with classification info
        let message = `Gas leak risk detected: ${riskState}`;
        if (mlResult.ppmClassification && mlResult.ppmClassification.dominantGas) {
          message += ` (Dominant: ${mlResult.ppmClassification.dominantGas})`;
        }
        if (mlResult.anomalyDetection && mlResult.anomalyDetection.trend) {
          message += ` - Trend: ${mlResult.anomalyDetection.trend}`;
        }

        const alert = await Alert.create({
          clientID,
          alertType: "ML_HYBRID_RISK",
          severity,
          message,
          readingRef: reading._id,
          mlRiskScore: mlResult.leakProbability,
          gasType: gasTypes.join(", "),
          ppm: Math.max(...values),
          zone: "Zone_A",
          metadata: {
            riskState,
            confidence: mlResult.confidence,
            ppmRisk: mlResult.ppmClassification?.overallRisk,
            anomalyRisk: mlResult.anomalyDetection?.risk,
            classificationMethod: mlResult.classificationMethod
          }
        });

        io.emit("alert", {
          ...alert.toObject(),
          mlDetails: mlResult
        });

        console.log(`🚨 Alert created: ${riskState} (severity: ${severity})`);
      }

      // 🌬️ Auto ventilation (WARNING and CRITICAL)
      if (["WARNING", "CRITICAL"].includes(riskState)) {
        const ventilationMode = riskState === "CRITICAL" ? "FORCED" : "AUTO";

        await VentilationStatus.updateOne(
          { zone: "Zone_A" },
          {
            $set: {
              status: "ON",
              mode: ventilationMode,
              reason: `${riskState} risk detected by ML`,
              riskState,
              updatedAt: new Date()
            }
          },
          { upsert: true }
        );

        io.emit("ventilation", {
          zone: "Zone_A",
          status: "ON",
          mode: ventilationMode,
          trigger: "ML_HYBRID",
          riskState,
          timestamp: new Date().toISOString()
        });

        console.log(`🌬️ Ventilation activated: ${ventilationMode} mode (${riskState})`);
      }

      // 🔗 Blockchain logging (WARNING and CRITICAL only)
      if (["WARNING", "CRITICAL"].includes(riskState)) {
        try {
          await blockchainClient.recordEvent({
            timestamp: new Date().toISOString(),
            zone: "Zone_A",
            gasLevels: gasMap,
            riskState,
            riskLevel: severity,
            leakProbability: mlResult.leakProbability,
            dominantGas: mlResult.ppmClassification?.dominantGas,
            confidence: mlResult.confidence,
            classificationMethod: "hybrid_ppm_lstm",
            readingHash: reading._id.toString()
          });
          console.log(`⛓️ Blockchain event logged: ${riskState}`);
        } catch (err) {
          console.warn("⚠️ Blockchain logging failed:", err.message);
        }
      }

      // 🔊 Emit ML prediction for dashboard
      io.emit("ml-prediction", {
        zone: "Zone_A",
        riskState,
        severity,
        mlResult,
        timestamp: new Date().toISOString()
      });
    }

    // ✅ Final response
    res.json({ ok: true, reading, mlResult });

  } catch (err) {
    console.error("❌ Sensor reading error:", err.message);
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


app.get("/api/readings", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || "100", 10);
    const readings = await SensorReading.find()
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json(readings);
  } catch (err) {
    console.error("❌ Fetch readings error:", err);
    res.status(500).json({ error: "Failed to fetch readings" });
  }
});


// ============================================================================
// ALERTS
// ============================================================================

app.post("/api/alerts", async (req, res) => {
  try {
   const { clientID, alertType, severity, message, readingId, mlRiskScore, gasType, ppm, zone } = req.body;
let blockchainTx = null;


    if (!clientID || !alertType || !message) {
      return res.status(400).json({ error: "Missing alert fields" });
    }


// Only log serious alerts to blockchain
if (severity === "high" || severity === "critical") {
  try {
    const bcResponse = await fetch("http://localhost:3002/log-emergency", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gasType,
        value: ppm,
        zone,
        timestamp: new Date().toISOString()
      })
    });

    const bcData = await bcResponse.json();
    blockchainTx = bcData.transaction?.transactionHash || null;

  } catch (err) {
    console.error("⚠️ Blockchain service not reachable:", err.message);
  }
}

 const alert = await Alert.create({
  clientID,
  alertType,
  severity,
  message,
  readingRef: readingId,
  blockchainTx
});

    io.emit("alert", alert);
    res.json({ ok: true, alert });

  } catch (err) {
    console.error("❌ Alert error:", err);
    res.status(500).json({ error: "Failed to save alert" });
  }
});

app.get("/api/alerts", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || "50", 10);
    const alerts = await Alert.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("readingRef");

    res.json(alerts);
  } catch (err) {
    console.error("❌ Fetch alerts error:", err);
    res.status(500).json({ error: "Failed to fetch alerts" });
  }
});

app.post("/api/alerts/:id/ack", async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { acknowledged: true },
      { new: true }
    );
    res.json(alert);
  } catch (err) {
    console.error("❌ Ack alert error:", err);
    res.status(500).json({ error: "Failed to acknowledge alert" });
  }
});

// ============================================================================
// EMERGENCY EVENTS
// ============================================================================

app.post("/api/emergency", async (req, res) => {
  try {
    const { clientID, event, details } = req.body;

    if (!clientID || !event) {
      return res.status(400).json({ error: "Missing emergency fields" });
    }

    const record = await EmergencyEvent.create({
      clientID,
      event,
      details
    });

    io.emit("emergency-event", record);
    res.json({ ok: true, event: record });

  } catch (err) {
    console.error("❌ Emergency event error:", err);
    res.status(500).json({ error: "Failed to save emergency event" });
  }
});

app.get("/api/emergency", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || "50", 10);
    const events = await EmergencyEvent.find()
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json(events);
  } catch (err) {
    console.error("❌ Fetch emergency events error:", err);
    res.status(500).json({ error: "Failed to fetch emergency events" });
  }
});

// ============================================================================
// VENTILATION STATUS
// ============================================================================

app.post("/api/ventilation", async (req, res) => {
  try {
    const { clientID, isOn, mode, reason } = req.body;

    if (!clientID || typeof isOn !== "boolean") {
      return res.status(400).json({ error: "Invalid ventilation payload" });
    }

    const status = await VentilationStatus.create({
      clientID,
      isOn,
      mode: mode || "auto",
      reason
    });

    io.emit("ventilation-status", status);
    res.json({ ok: true, status });

  } catch (err) {
    console.error("❌ Ventilation error:", err);
    res.status(500).json({ error: "Failed to save ventilation status" });
  }
});

app.get("/api/ventilation/latest", async (req, res) => {
  try {
    const query = req.query.clientID ? { clientID: req.query.clientID } : {};
    const status = await VentilationStatus.findOne(query).sort({ createdAt: -1 });
    res.json(status || null);
  } catch (err) {
    console.error("❌ Fetch ventilation error:", err);
    res.status(500).json({ error: "Failed to fetch ventilation status" });
  }
});

// ============================================================================
// DEVICE HEALTH
// ============================================================================

app.post("/api/device-health", async (req, res) => {
  try {
    const { clientID, deviceOnline, firmwareVersion, sensors } = req.body;

    if (!clientID) {
      return res.status(400).json({ error: "Missing clientID" });
    }

    const record = await DeviceHealth.findOneAndUpdate(
      { clientID },
      {
        clientID,
        deviceOnline: deviceOnline !== undefined ? deviceOnline : true,
        firmwareVersion,
        sensors,
        lastSeen: new Date()
      },
      { upsert: true, new: true }
    );

    io.emit("device-health", record);
    res.json({ ok: true, device: record });

  } catch (err) {
    console.error("❌ Device health error:", err);
    res.status(500).json({ error: "Failed to update device health" });
  }
});

app.get("/api/device-health", async (req, res) => {
  try {
    const devices = await DeviceHealth.find().sort({ lastSeen: -1 });
    res.json(devices);
  } catch (err) {
    console.error("❌ Fetch device health error:", err);
    res.status(500).json({ error: "Failed to fetch device health" });
  }
});



// ============================================================================
// START SERVER
// ============================================================================

function calculateSeverity(riskScore) {
  if (riskScore >= 0.85) return "critical";
  if (riskScore >= 0.65) return "high";
  if (riskScore >= 0.45) return "medium";
  return "low";
}
