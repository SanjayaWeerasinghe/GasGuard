const mongoose = require('mongoose');

const sensorReadingSchema = new mongoose.Schema({
  // IoT Client Information
  clientID: {
    type: String,
    required: true,
    index: true
  },

  // Gas Sensor Readings (PPM values)
  gasReadings: {
    methane: { type: Number, required: true },
    lpg: { type: Number, required: true },
    carbonMonoxide: { type: Number, required: true },
    hydrogenSulfide: { type: Number, required: true }
  },

  // Environmental Data (optional)
  environmental: {
    temperature: Number,
    humidity: Number,
    pressure: Number
  },

  // ML Prediction Results
  mlPrediction: {
    riskState: {
      type: String,
      enum: ['NORMAL', 'LOW_ANOMALY', 'UNUSUAL', 'ALERT', 'WARNING', 'CRITICAL']
    },
    confidence: {
      type: String,
      enum: ['high', 'medium', 'low']
    },
    ppmClassification: {
      overallRisk: String,
      dominantGas: String,
      gasRisks: mongoose.Schema.Types.Mixed
    },
    anomalyDetection: {
      risk: String,
      predictionError: Number,
      trend: String
    },
    leakProbability: Number,
    classificationMethod: String
  },

  // Actions Taken
  actionsTaken: {
    alertCreated: { type: Boolean, default: false },
    ventilationTriggered: { type: Boolean, default: false },
    blockchainLogged: { type: Boolean, default: false },
    notificationSent: { type: Boolean, default: false }
  },

  // Metadata
  source: {
    type: String,
    default: 'iot_device'
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
sensorReadingSchema.index({ clientID: 1, timestamp: -1 });
sensorReadingSchema.index({ 'mlPrediction.riskState': 1 });

module.exports = mongoose.model('SensorReading', sensorReadingSchema);
