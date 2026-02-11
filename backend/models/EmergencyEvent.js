const mongoose = require("mongoose");

const EmergencyEventSchema = new mongoose.Schema({
  clientID: { type: String, required: true },
  event: { type: String, required: true },         // "AUTO_SHUTDOWN", "FAN_TRIGGERED", etc.
  details: String,
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model("EmergencyEvent", EmergencyEventSchema);
