const mongoose = require("mongoose");

const DeviceHealthSchema = new mongoose.Schema({
  clientID: { type: String, required: true, unique: true },
  deviceOnline: { type: Boolean, default: true },
  lastSeen: { type: Date, default: Date.now },
  firmwareVersion: String,
  sensors: [{
    type: { type: String },                         // "MQ-2", "MQ-4", etc.
    health: { type: String, default: "OK" },        // "OK" | "Weak" | "Disconnected"
    lastValue: Number,
    lastUpdated: Date
  }]
}, { timestamps: true });

module.exports = mongoose.model("DeviceHealth", DeviceHealthSchema);
