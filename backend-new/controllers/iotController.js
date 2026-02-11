const axios = require('axios');
const SensorReading = require('../models/SensorReading');
const Alert = require('../models/Alert');
const VentilationStatus = require('../models/VentilationStatus');
const logger = require('../utils/logger');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000';
const BLOCKCHAIN_URL = process.env.BLOCKCHAIN_URL || 'http://localhost:3002';
const BLOCKCHAIN_ENABLED = process.env.BLOCKCHAIN_ENABLED === 'true';
const ML_TIMEOUT = parseInt(process.env.ML_SERVICE_TIMEOUT) || 5000;
const MAX_QUERY_LIMIT = 500;

// Risk state hierarchy for decision making
const RISK_HIERARCHY = {
  'NORMAL': 0,
  'LOW_ANOMALY': 1,
  'UNUSUAL': 2,
  'ALERT': 3,
  'WARNING': 4,
  'CRITICAL': 5
};

// Severity mapping for alerts
const SEVERITY_MAP = {
  'LOW_ANOMALY': 'low',
  'UNUSUAL': 'medium',
  'ALERT': 'medium',
  'WARNING': 'high',
  'CRITICAL': 'critical'
};

/**
 * Validate gas reading value — must be a finite non-negative number
 */
function isValidGasReading(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/**
 * Safely parse a query limit with a max cap
 */
function parseLimit(value) {
  const parsed = parseInt(value) || 50;
  return Math.min(Math.max(parsed, 1), MAX_QUERY_LIMIT);
}

/**
 * Process IoT sensor reading
 * Main endpoint: POST /api/readings
 */
exports.processSensorReading = async (req, res) => {
  try {
    const { clientID, gases, environmental, source } = req.body;

    // Validate required fields
    if (!clientID || !gases) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: clientID and gases'
      });
    }

    // Validate gas readings exist and are valid numbers
    const { methane, lpg, carbonMonoxide, hydrogenSulfide } = gases;
    if (methane === undefined || lpg === undefined ||
        carbonMonoxide === undefined || hydrogenSulfide === undefined) {
      return res.status(400).json({
        success: false,
        error: 'All gas readings required: methane, lpg, carbonMonoxide, hydrogenSulfide'
      });
    }

    if (!isValidGasReading(methane) || !isValidGasReading(lpg) ||
        !isValidGasReading(carbonMonoxide) || !isValidGasReading(hydrogenSulfide)) {
      return res.status(400).json({
        success: false,
        error: 'Gas readings must be non-negative finite numbers'
      });
    }

    // Log incoming sensor reading
    logger.logSensorInput(clientID, gases, environmental || {});

    // Step 1: Call ML Service for classification
    let mlPrediction;
    try {
      const mlPayload = {
        sensorData: [{
          gases: { methane, lpg, carbonMonoxide, hydrogenSulfide },
          environmental: environmental || {}
        }]
      };

      logger.logMLRequest(mlPayload);

      const mlResponse = await axios.post(`${ML_SERVICE_URL}/predict`, mlPayload, {
        timeout: ML_TIMEOUT,
        headers: { 'Content-Type': 'application/json' }
      });

      mlPrediction = mlResponse.data;

      // Validate ML response has required fields
      if (!mlPrediction || !mlPrediction.riskState || !mlPrediction.ppmClassification) {
        throw new Error('ML service returned incomplete response');
      }

      logger.logMLResponse(mlPrediction, clientID);
    } catch (mlError) {
      logger.logError('ML Service Call', mlError);
      return res.status(503).json({
        success: false,
        error: 'ML service unavailable',
        details: mlError.message
      });
    }

    // Step 2: Save sensor reading to database
    const reading = new SensorReading({
      clientID,
      gasReadings: { methane, lpg, carbonMonoxide, hydrogenSulfide },
      environmental: environmental || {},
      mlPrediction: {
        riskState: mlPrediction.riskState,
        confidence: mlPrediction.confidence,
        ppmClassification: mlPrediction.ppmClassification,
        anomalyDetection: mlPrediction.anomalyDetection,
        leakProbability: mlPrediction.leakProbability,
        classificationMethod: mlPrediction.classificationMethod
      },
      source: source || 'iot_device',
      actionsTaken: {
        alertCreated: false,
        ventilationTriggered: false,
        blockchainLogged: false,
        notificationSent: false
      }
    });

    // Step 3: Decision Engine - Take actions based on risk state
    const riskState = mlPrediction.riskState;
    const riskLevel = RISK_HIERARCHY[riskState] || 0;

    let alert = null;
    let ventilationAction = null;

    // Create alert for UNUSUAL and above
    if (riskLevel >= RISK_HIERARCHY['UNUSUAL']) {
      alert = await createAlert(clientID, mlPrediction, gases, reading._id);
      reading.actionsTaken.alertCreated = true;
      logger.logAlert(alert);
    }

    // Trigger ventilation for WARNING and CRITICAL
    if (riskLevel >= RISK_HIERARCHY['WARNING']) {
      ventilationAction = await triggerVentilation(clientID, riskState);
      reading.actionsTaken.ventilationTriggered = true;
    }

    // Log to blockchain for WARNING and above
    if (BLOCKCHAIN_ENABLED && riskLevel >= RISK_HIERARCHY['WARNING']) {
      try {
        await axios.post(`${BLOCKCHAIN_URL}/log-event`, {
          eventType: 'GAS_ALERT',
          data: {
            clientID,
            riskState,
            gasLevels: gases,
            alertId: alert ? alert._id.toString() : null,
            confidence: mlPrediction.confidence
          },
          timestamp: new Date().toISOString()
        }, { timeout: 3000 });
        reading.actionsTaken.blockchainLogged = true;
      } catch (bcError) {
        logger.logError('Blockchain Logging', bcError);
      }
    }

    // Update reading with actions taken
    await reading.save();

    // Log actions taken
    logger.logActions(clientID, {
      alertCreated: reading.actionsTaken.alertCreated,
      alertId: alert ? alert._id : null,
      ventilationTriggered: reading.actionsTaken.ventilationTriggered,
      ventilationMode: ventilationAction ? ventilationAction.mode : null
    }, mlPrediction);

    // Step 4: Broadcast to connected clients via WebSocket
    const io = req.app.get('io');
    if (io) {
      const sensorPayload = {
        clientID,
        riskState,
        gases,
        environmental: environmental || {},
        timestamp: reading.timestamp
      };

      const mlPayloadWs = {
        clientID,
        riskState: mlPrediction.riskState,
        severity: SEVERITY_MAP[mlPrediction.riskState] || 'low',
        mlResult: {
          leakProbability: mlPrediction.leakProbability,
          confidence: mlPrediction.confidence,
          ppmClassification: mlPrediction.ppmClassification,
          anomalyDetection: mlPrediction.anomalyDetection,
          classificationMethod: mlPrediction.classificationMethod,
          recommendedAction: mlPrediction.recommendedAction
        }
      };

      // Emit specific events the frontend expects
      io.to(`zone-${clientID}`).emit('sensor-reading', sensorPayload);
      io.to(`zone-${clientID}`).emit('ml-prediction', mlPayloadWs);

      // Also broadcast generic update to all clients
      io.emit('sensor-update', sensorPayload);
      io.emit('sensor-reading', sensorPayload);
      io.emit('ml-prediction', mlPayloadWs);

      if (alert) {
        const alertPayload = {
          clientID,
          severity: alert.severity,
          riskState: alert.riskState,
          message: alert.message,
          gasLevels: alert.gasLevels,
          timestamp: alert.timestamp
        };
        io.to(`zone-${clientID}`).emit('alert', alertPayload);
        io.emit('alert', alertPayload);
      }

      if (ventilationAction) {
        const ventPayload = {
          zone: clientID,
          status: ventilationAction.isActive ? 'ON' : 'OFF',
          isOn: ventilationAction.isActive,
          mode: ventilationAction.mode,
          trigger: riskState,
          timestamp: ventilationAction.timestamp || new Date().toISOString()
        };
        io.to(`zone-${clientID}`).emit('ventilation', ventPayload);
        io.to(`zone-${clientID}`).emit('ventilation-status', ventPayload);
        io.emit('ventilation', ventPayload);
      }
    }

    // Step 5: Send response
    res.status(200).json({
      success: true,
      reading: {
        id: reading._id,
        clientID: reading.clientID,
        riskState: mlPrediction.riskState,
        confidence: mlPrediction.confidence,
        timestamp: reading.timestamp
      },
      classification: mlPrediction,
      actions: {
        alertCreated: reading.actionsTaken.alertCreated,
        alertId: alert ? alert._id : null,
        ventilationTriggered: reading.actionsTaken.ventilationTriggered,
        ventilationMode: ventilationAction ? ventilationAction.mode : null,
        blockchainLogged: reading.actionsTaken.blockchainLogged
      }
    });

  } catch (error) {
    logger.logError('Processing Sensor Reading', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
};

/**
 * Create alert based on ML classification
 */
async function createAlert(clientID, mlPrediction, gasLevels, readingId) {
  const { riskState, confidence, ppmClassification, anomalyDetection, leakProbability } = mlPrediction;

  const severity = SEVERITY_MAP[riskState] || 'medium';
  const dominantGas = ppmClassification?.dominantGas || 'unknown';

  let message = `${riskState} risk detected in ${clientID}`;
  if (dominantGas !== 'unknown') {
    const gasName = dominantGas === 'carbonMonoxide' ? 'CO' :
                    dominantGas === 'hydrogenSulfide' ? 'H2S' :
                    dominantGas.toUpperCase();
    message += ` - ${gasName} levels elevated`;
  }

  const alert = new Alert({
    clientID,
    severity,
    riskState,
    message,
    gasLevels: {
      methane: gasLevels.methane,
      lpg: gasLevels.lpg,
      carbonMonoxide: gasLevels.carbonMonoxide,
      hydrogenSulfide: gasLevels.hydrogenSulfide
    },
    dominantGas,
    metadata: {
      confidence,
      ppmRisk: ppmClassification?.overallRisk,
      anomalyRisk: anomalyDetection?.risk,
      classificationMethod: mlPrediction.classificationMethod,
      predictionError: anomalyDetection?.predictionError,
      leakProbability
    },
    actions: {
      ventilation: RISK_HIERARCHY[riskState] >= RISK_HIERARCHY['WARNING'],
      blockchain: BLOCKCHAIN_ENABLED && RISK_HIERARCHY[riskState] >= RISK_HIERARCHY['WARNING']
    },
    readingId
  });

  await alert.save();
  return alert;
}

/**
 * Trigger ventilation system — uses findOneAndUpdate to prevent race conditions
 */
async function triggerVentilation(clientID, riskState) {
  const mode = riskState === 'CRITICAL' ? 'FORCED' : 'AUTO';

  const ventStatus = await VentilationStatus.findOneAndUpdate(
    { clientID },
    {
      $set: {
        isActive: true,
        mode,
        triggeredBy: {
          riskState,
          timestamp: new Date(),
          reason: `${riskState} risk detected`
        },
        activatedAt: new Date()
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return ventStatus;
}

/**
 * Handle emergency protocol
 * POST /api/emergency
 */
exports.handleEmergency = async (req, res) => {
  try {
    const { clientID, event, details } = req.body;

    if (!clientID) {
      return res.status(400).json({ success: false, error: 'clientID required' });
    }

    // Activate FORCED ventilation for the zone
    const ventStatus = await triggerVentilation(clientID, 'CRITICAL');

    // Create a CRITICAL alert
    const alert = new Alert({
      clientID,
      severity: 'critical',
      riskState: 'CRITICAL',
      message: `EMERGENCY triggered in ${clientID}: ${event || 'MANUAL_EMERGENCY'}`,
      gasLevels: { methane: 0, lpg: 0, carbonMonoxide: 0, hydrogenSulfide: 0 },
      dominantGas: 'unknown',
      metadata: {
        confidence: 'high',
        ppmRisk: 'CRITICAL',
        anomalyRisk: 'CRITICAL',
        classificationMethod: 'manual_emergency',
        leakProbability: 1.0
      },
      actions: { ventilation: true, blockchain: BLOCKCHAIN_ENABLED }
    });
    await alert.save();

    // Log to blockchain
    if (BLOCKCHAIN_ENABLED) {
      try {
        await axios.post(`${BLOCKCHAIN_URL}/log-emergency`, {
          gasType: 'emergency',
          value: 0,
          zone: clientID,
          timestamp: new Date().toISOString()
        }, { timeout: 3000 });
      } catch (bcError) {
        logger.logError('Blockchain Emergency Log', bcError);
      }
    }

    // Broadcast emergency via WebSocket
    const io = req.app.get('io');
    if (io) {
      io.emit('emergency-event', {
        clientID,
        event: event || 'MANUAL_EMERGENCY',
        details: details || {},
        ventilation: { isActive: true, mode: 'FORCED' },
        timestamp: new Date().toISOString()
      });
    }

    logger.logAlert(alert);

    res.json({
      success: true,
      message: 'Emergency protocol activated',
      alert: { id: alert._id, severity: alert.severity },
      ventilation: { isActive: true, mode: 'FORCED' }
    });
  } catch (error) {
    logger.logError('Emergency Handler', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Manual ventilation control
 * POST /api/ventilation
 */
exports.controlVentilation = async (req, res) => {
  try {
    const { clientID, isOn, mode, reason } = req.body;

    if (!clientID) {
      return res.status(400).json({ success: false, error: 'clientID required' });
    }

    let ventStatus;
    if (isOn) {
      ventStatus = await VentilationStatus.findOneAndUpdate(
        { clientID },
        {
          $set: {
            isActive: true,
            mode: mode || 'AUTO',
            triggeredBy: {
              riskState: 'MANUAL',
              timestamp: new Date(),
              reason: reason || 'Manual activation from dashboard'
            },
            activatedAt: new Date()
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } else {
      ventStatus = await VentilationStatus.findOneAndUpdate(
        { clientID },
        {
          $set: {
            isActive: false,
            mode: 'OFF',
            deactivatedAt: new Date()
          }
        },
        { new: true }
      );
    }

    // Broadcast via WebSocket
    const io = req.app.get('io');
    if (io) {
      const payload = {
        zone: clientID,
        status: isOn ? 'ON' : 'OFF',
        isOn: !!isOn,
        mode: isOn ? (mode || 'AUTO') : 'OFF',
        trigger: 'MANUAL',
        timestamp: new Date().toISOString()
      };
      io.to(`zone-${clientID}`).emit('ventilation-status', payload);
      io.emit('ventilation', payload);
    }

    res.json({
      success: true,
      ventilation: ventStatus || { clientID, isActive: false, mode: 'OFF' }
    });
  } catch (error) {
    logger.logError('Ventilation Control', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get recent readings
 * GET /api/readings
 */
exports.getReadings = async (req, res) => {
  try {
    const { clientID, limit = 50, riskState } = req.query;

    const query = {};
    if (clientID) query.clientID = clientID;
    if (riskState) query['mlPrediction.riskState'] = riskState;

    const readings = await SensorReading.find(query)
      .sort({ timestamp: -1 })
      .limit(parseLimit(limit));

    res.json({
      success: true,
      count: readings.length,
      readings
    });
  } catch (error) {
    logger.logError('Fetching Readings', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get active alerts
 * GET /api/alerts
 */
exports.getAlerts = async (req, res) => {
  try {
    const { clientID, status = 'active', limit = 50 } = req.query;

    const query = { status };
    if (clientID) query.clientID = clientID;

    const alerts = await Alert.find(query)
      .sort({ timestamp: -1 })
      .limit(parseLimit(limit))
      .populate('readingId', 'gasReadings timestamp');

    res.json({
      success: true,
      count: alerts.length,
      alerts
    });
  } catch (error) {
    logger.logError('Fetching Alerts', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Acknowledge alert
 * PUT /api/alerts/:id/acknowledge
 */
exports.acknowledgeAlert = async (req, res) => {
  try {
    const { id } = req.params;

    const alert = await Alert.findByIdAndUpdate(
      id,
      {
        status: 'acknowledged',
        acknowledgedAt: new Date()
      },
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }

    res.json({
      success: true,
      alert
    });
  } catch (error) {
    logger.logError('Acknowledging Alert', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
