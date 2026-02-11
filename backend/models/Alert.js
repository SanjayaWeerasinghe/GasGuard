const mongoose = require("mongoose");

const AlertSchema = new mongoose.Schema({
  clientID: { type: String, required: true },
  alertType: { type: String, required: true },     // "THRESHOLD", "ML_RISK", "ML_HYBRID_RISK", etc.
  severity: { type: String, default: "medium" },   // "low" | "medium" | "high" | "critical"
  message: { type: String, required: true },
  readingRef: { type: mongoose.Schema.Types.ObjectId, ref: "SensorReading" },
  mlRiskScore: Number,
  gasType: String,
  ppm: Number,
  zone: String,
  blockchainTx: String,
  acknowledged: { type: Boolean, default: false },

  // Enhanced metadata for hybrid classification
  metadata: {
    riskState: String,           // NORMAL, LOW_ANOMALY, UNUSUAL, ALERT, WARNING, CRITICAL
    confidence: String,          // high, medium, low
    ppmRisk: String,             // PPM-based risk classification
    anomalyRisk: String,         // LSTM anomaly detection risk
    dominantGas: String,         // Which gas caused highest risk
    classificationMethod: String // hybrid_ppm_lstm
  },

  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model("Alert", AlertSchema);
