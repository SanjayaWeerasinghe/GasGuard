const mongoose = require("mongoose");

const zoneSchema = new mongoose.Schema({
  _id: String,
  label: String,

  position: {
    x: Number,
    y: Number,
    z: { type: Number, default: 0 }
  },

  type: { type: String, enum: ["circular", "rectangular"], default: "circular" },

  radius: Number,

  width: Number,
  height: Number,

  priority: Number,

  thresholdOverride: {
    CH4: Number,
    CO: Number,
    LPG: Number,
    H2S: Number
  }
});

module.exports = mongoose.model("Zone", zoneSchema);
