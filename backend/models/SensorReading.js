const mongoose = require("mongoose");

const SensorReadingSchema = new mongoose.Schema({
  clientID: { type: String, required: true },
  gasTypes: [{ type: String, required: true }],   // ["LPG", "CH4", ...]
  values: [{ type: Number, required: true }],      // [123, 456, ...] same order as gasTypes
  source: { type: String, default: "iot" },        // "iot" | "simulator" | "manual"
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model("SensorReading", SensorReadingSchema);
