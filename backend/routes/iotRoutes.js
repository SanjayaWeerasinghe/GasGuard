
const express = require("express");
const router = express.Router();
const { getRiskPrediction } = require("../services/mlService");

router.use((req, res, next) => {
  req.io = req.app.get("io");
  next();
});

const DeviceHealth = require("../models/DeviceHealth");
const VentilationStatus = require("../models/VentilationStatus");
const EmergencyEvent = require("../models/EmergencyEvent");
const Alert = require("../models/Alert");

/***************************************
 * GAS READING + ML PREDICTION (FINAL)
 ***************************************/
router.post("/gas-reading", async (req, res) => {
  try {
    const {
      clientID,
      zone,
      methane,
      lpg,
      carbonMonoxide,
      hydrogenSulfide
    } = req.body;

    if (!clientID || !zone) {
      return res.status(400).json({ error: "clientID and zone required" });
    }

    // 1️⃣ Call ML Service
    const mlResult = await getRiskPrediction([
      methane,
      lpg,
      carbonMonoxide,
      hydrogenSulfide
    ]);

    // 2️⃣ Alert logic (Enhanced with new risk states)
    if (mlResult.notify) {
      const severityMap = {
        "NORMAL": "low",
        "LOW_ANOMALY": "low",
        "UNUSUAL": "medium",
        "ALERT": "medium",
        "WARNING": "high",
        "CRITICAL": "critical"
      };

      await Alert.create({
        clientID,
        alertType: "ML_HYBRID_RISK",
        severity: severityMap[mlResult.riskState] || "medium",
        message: `Gas anomaly detected in ${zone} (${mlResult.riskState})`,
        zone,
        metadata: {
          confidence: mlResult.confidence,
          ppmRisk: mlResult.ppmClassification?.overallRisk,
          anomalyRisk: mlResult.anomalyDetection?.risk,
          dominantGas: mlResult.ppmClassification?.dominantGas
        }
      });
    }

    // 3️⃣ Emergency logic (alarm for WARNING and CRITICAL)
    if (mlResult.alarm) {
      await EmergencyEvent.create({
        clientID,
        zone,
        event: `${mlResult.riskState} gas levels in ${zone}`,
        severity: mlResult.riskState,
        leakProbability: mlResult.leakProbability,
        dominantGas: mlResult.ppmClassification?.dominantGas
      });
    }

    // 4️⃣ Ventilation logic
    if (mlResult.ventilation) {
      const mode = mlResult.riskState === "CRITICAL" ? "FORCED" : "AUTO";

      await VentilationStatus.create({
        zone,
        mode,
        isOn: true,
        status: "ON",
        reason: `ML Trigger (${mlResult.riskState})`,
        riskState: mlResult.riskState
      });
    }

    // 5️⃣ Emit real-time update
    req.io?.emit("gas-reading", {
      clientID,
      zone,
      gases: {
        methane,
        lpg,
        carbonMonoxide,
        hydrogenSulfide
      },
      ml: mlResult,
      timestamp: new Date()
    });

    res.json({
      success: true,
      ml: mlResult
    });

  } catch (err) {
    console.error("Gas reading error:", err);
    res.status(500).json({ error: "Gas processing failed" });
  }
});

module.exports = router;
