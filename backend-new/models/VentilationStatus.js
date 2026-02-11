const mongoose = require('mongoose');

const ventilationStatusSchema = new mongoose.Schema({
  // Zone/Client ID
  clientID: {
    type: String,
    required: true,
    index: true
  },

  // Ventilation State
  isActive: {
    type: Boolean,
    default: false
  },

  // Mode: AUTO (ML triggered) or FORCED (CRITICAL - cannot be overridden)
  mode: {
    type: String,
    enum: ['OFF', 'AUTO', 'FORCED'],
    default: 'OFF'
  },

  // Trigger Information
  triggeredBy: {
    riskState: String,
    timestamp: Date,
    reason: String
  },

  // Duration tracking
  activatedAt: Date,
  deactivatedAt: Date,

  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('VentilationStatus', ventilationStatusSchema);
