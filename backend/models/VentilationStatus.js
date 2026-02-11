const mongoose = require("mongoose");

const VentilationStatusSchema = new mongoose.Schema({
  clientID: { type: String, required: true },
  isOn: { type: Boolean, required: true },
  mode: { type: String, default: "auto" },         // "auto" | "manual" | "emergency"
  reason: String,                                  // e.g. "High LPG level"
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model("VentilationStatus", VentilationStatusSchema);
