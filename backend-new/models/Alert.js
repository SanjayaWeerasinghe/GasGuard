const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  // Client Information
  clientID: {
    type: String,
    required: true,
    index: true
  },

  // Alert Severity
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true
  },

  // Risk State that triggered the alert
  riskState: {
    type: String,
    enum: ['LOW_ANOMALY', 'UNUSUAL', 'ALERT', 'WARNING', 'CRITICAL'],
    required: true
  },

  // Alert Message
  message: {
    type: String,
    required: true
  },

  // Gas Details
  gasLevels: {
    methane: Number,
    lpg: Number,
    carbonMonoxide: Number,
    hydrogenSulfide: Number
  },

  // Dominant Gas causing the alert
  dominantGas: String,

  // ML Classification Details
  metadata: {
    confidence: String,
    ppmRisk: String,
    anomalyRisk: String,
    classificationMethod: String,
    predictionError: Number,
    leakProbability: Number
  },

  // Alert Status
  status: {
    type: String,
    enum: ['active', 'acknowledged', 'resolved'],
    default: 'active'
  },

  // Actions Taken
  actions: {
    ventilation: { type: Boolean, default: false },
    blockchain: { type: Boolean, default: false },
    notification: { type: Boolean, default: false }
  },

  // Timestamps
  acknowledgedAt: Date,
  resolvedAt: Date,

  // Reference to original reading
  readingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SensorReading'
  },

  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Indexes
alertSchema.index({ clientID: 1, status: 1, timestamp: -1 });
alertSchema.index({ riskState: 1 });

module.exports = mongoose.model('Alert', alertSchema);
