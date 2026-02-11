const express = require('express');
const router = express.Router();
const axios = require('axios');
const iotController = require('../controllers/iotController');

const BLOCKCHAIN_URL = process.env.BLOCKCHAIN_URL || 'http://localhost:3002';

/**
 * IoT Sensor Routes
 */

// POST /api/readings - Process new sensor reading
router.post('/readings', iotController.processSensorReading);

// GET /api/readings - Get sensor readings history
router.get('/readings', iotController.getReadings);

// GET /api/alerts - Get alerts
router.get('/alerts', iotController.getAlerts);

// PUT /api/alerts/:id/acknowledge - Acknowledge an alert
router.put('/alerts/:id/acknowledge', iotController.acknowledgeAlert);

// POST /api/emergency - Trigger emergency protocol
router.post('/emergency', iotController.handleEmergency);

// POST /api/ventilation - Manual ventilation control
router.post('/ventilation', iotController.controlVentilation);

/**
 * Health Check Route
 */
router.get('/health', async (req, res) => {
  const mongoose = require('mongoose');

  res.json({
    status: 'ok',
    service: 'GasGuard Backend API',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    database: {
      connected: mongoose.connection.readyState === 1,
      state: mongoose.connection.readyState
    },
    mlService: {
      url: process.env.ML_SERVICE_URL || 'http://localhost:5000'
    }
  });
});

/**
 * Statistics Route
 */
router.get('/stats', async (req, res) => {
  try {
    const SensorReading = require('../models/SensorReading');
    const Alert = require('../models/Alert');

    const totalReadings = await SensorReading.countDocuments();
    const activeAlerts = await Alert.countDocuments({ status: 'active' });

    // Risk state distribution (last 100 readings)
    const recentReadings = await SensorReading.find()
      .sort({ timestamp: -1 })
      .limit(100)
      .select('mlPrediction.riskState');

    const riskDistribution = {
      NORMAL: 0,
      LOW_ANOMALY: 0,
      UNUSUAL: 0,
      ALERT: 0,
      WARNING: 0,
      CRITICAL: 0
    };

    recentReadings.forEach(reading => {
      const risk = reading.mlPrediction?.riskState;
      if (risk && riskDistribution.hasOwnProperty(risk)) {
        riskDistribution[risk]++;
      }
    });

    res.json({
      success: true,
      stats: {
        totalReadings,
        activeAlerts,
        riskDistribution
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Blockchain Proxy Routes
 */

// GET /api/blockchain/transactions — proxy to blockchain service
router.get('/blockchain/transactions', async (req, res) => {
  try {
    const { limit } = req.query;
    const url = `${BLOCKCHAIN_URL}/transactions${limit ? `?limit=${limit}` : ''}`;
    const response = await axios.get(url, { timeout: 5000 });
    res.json(response.data);
  } catch (error) {
    res.status(502).json({ success: false, error: 'Blockchain service unavailable', details: error.message });
  }
});

// GET /api/blockchain/report — proxy to blockchain report
router.get('/blockchain/report', async (req, res) => {
  try {
    const response = await axios.get(`${BLOCKCHAIN_URL}/report`, { timeout: 5000 });
    res.json(response.data);
  } catch (error) {
    res.status(502).json({ success: false, error: 'Blockchain service unavailable', details: error.message });
  }
});

// GET /api/blockchain/audit-trail?zone=X&from=&to= — smart routing
router.get('/blockchain/audit-trail', async (req, res) => {
  try {
    const { zone, from, to } = req.query;
    let url;

    if (zone) {
      url = `${BLOCKCHAIN_URL}/transactions/zone/${encodeURIComponent(zone)}`;
    } else if (from || to) {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      url = `${BLOCKCHAIN_URL}/transactions/range?${params.toString()}`;
    } else {
      url = `${BLOCKCHAIN_URL}/transactions?limit=100`;
    }

    const response = await axios.get(url, { timeout: 5000 });
    res.json(response.data);
  } catch (error) {
    res.status(502).json({ success: false, error: 'Blockchain service unavailable', details: error.message });
  }
});

// GET /api/blockchain/blocks — proxy to blockchain blocks
router.get('/blockchain/blocks', async (req, res) => {
  try {
    const { limit } = req.query;
    const url = `${BLOCKCHAIN_URL}/blocks${limit ? `?limit=${limit}` : ''}`;
    const response = await axios.get(url, { timeout: 5000 });
    res.json(response.data);
  } catch (error) {
    res.status(502).json({ success: false, error: 'Blockchain service unavailable', details: error.message });
  }
});

module.exports = router;
