/**
 * GasGuard Backend Logger
 *
 * Logs all sensor readings, ML predictions, and system actions to file
 */

const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Log file paths
const LOG_FILE = path.join(logsDir, 'gasguard.log');
const PREDICTIONS_FILE = path.join(logsDir, 'predictions.log');
const ALERTS_FILE = path.join(logsDir, 'alerts.log');

// Color codes for console (optional)
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m'
};

/**
 * Format timestamp
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Write to log file
 */
function writeToFile(filepath, content) {
  const timestamp = getTimestamp();
  const logEntry = `[${timestamp}] ${content}\n`;

  fs.promises.appendFile(filepath, logEntry, 'utf8').catch(error => {
    console.error('Error writing to log file:', error);
  });
}

/**
 * Log incoming sensor reading
 */
function logSensorInput(clientID, gases, environmental) {
  const logMessage = `
${'='.repeat(80)}
📥 INCOMING SENSOR READING
${'='.repeat(80)}
Client ID: ${clientID}
Timestamp: ${getTimestamp()}

Gas Readings (PPM):
  Methane (CH4):           ${gases.methane.toFixed(2)} ppm
  LPG:                     ${gases.lpg.toFixed(2)} ppm
  Carbon Monoxide (CO):    ${gases.carbonMonoxide.toFixed(2)} ppm
  Hydrogen Sulfide (H2S):  ${gases.hydrogenSulfide.toFixed(2)} ppm

Environmental:
  Temperature: ${environmental?.temperature?.toFixed(1) || 'N/A'}°C
  Humidity:    ${environmental?.humidity?.toFixed(1) || 'N/A'}%
  Pressure:    ${environmental?.pressure?.toFixed(1) || 'N/A'} hPa
`;

  writeToFile(LOG_FILE, logMessage);
  console.log(`${colors.cyan}📥 Sensor reading from ${clientID}${colors.reset}`);
}

/**
 * Log ML service request
 */
function logMLRequest(payload) {
  const logMessage = `
🤖 ML SERVICE REQUEST
${'─'.repeat(80)}
Sending to ML Service: http://127.0.0.1:5000/predict

Payload:
${JSON.stringify(payload, null, 2)}
`;

  writeToFile(PREDICTIONS_FILE, logMessage);
  console.log(`${colors.blue}🤖 Calling ML service...${colors.reset}`);
}

/**
 * Log ML service response (prediction)
 */
function logMLResponse(mlPrediction, clientID) {
  const riskColors = {
    'NORMAL': colors.green,
    'LOW_ANOMALY': colors.yellow,
    'UNUSUAL': colors.yellow,
    'ALERT': colors.yellow,
    'WARNING': colors.red,
    'CRITICAL': colors.red + colors.bright
  };

  const riskColor = riskColors[mlPrediction.riskState] || colors.reset;

  const logMessage = `
✨ ML SERVICE RESPONSE
${'─'.repeat(80)}
Client: ${clientID}

FINAL CLASSIFICATION:
  Risk State:        ${mlPrediction.riskState}
  Confidence:        ${mlPrediction.confidence}
  Leak Probability:  ${(mlPrediction.leakProbability * 100).toFixed(1)}%
  Method:            ${mlPrediction.classificationMethod}

PPM-BASED CLASSIFICATION:
  Overall Risk:      ${mlPrediction.ppmClassification.overallRisk}
  Dominant Gas:      ${mlPrediction.ppmClassification.dominantGas}

  Individual Gas Risks:
    Methane:         ${mlPrediction.ppmClassification?.gasRisks?.methane?.ppm?.toFixed(2) ?? 'N/A'} ppm → ${mlPrediction.ppmClassification?.gasRisks?.methane?.risk ?? 'N/A'}
    LPG:             ${mlPrediction.ppmClassification?.gasRisks?.lpg?.ppm?.toFixed(2) ?? 'N/A'} ppm → ${mlPrediction.ppmClassification?.gasRisks?.lpg?.risk ?? 'N/A'}
    CO:              ${mlPrediction.ppmClassification?.gasRisks?.carbonMonoxide?.ppm?.toFixed(2) ?? 'N/A'} ppm → ${mlPrediction.ppmClassification?.gasRisks?.carbonMonoxide?.risk ?? 'N/A'}
    H2S:             ${mlPrediction.ppmClassification?.gasRisks?.hydrogenSulfide?.ppm?.toFixed(2) ?? 'N/A'} ppm → ${mlPrediction.ppmClassification?.gasRisks?.hydrogenSulfide?.risk ?? 'N/A'}

LSTM ANOMALY DETECTION:
  Risk:              ${mlPrediction.anomalyDetection?.risk ?? 'N/A'}
  Prediction Error:  ${mlPrediction.anomalyDetection?.predictionError?.toFixed(4) ?? 'N/A'}
  Trend:             ${mlPrediction.anomalyDetection?.trend ?? 'N/A'}

RECOMMENDED ACTIONS:
  Notify:            ${mlPrediction.notify ? 'YES' : 'NO'}
  Alarm:             ${mlPrediction.alarm ? 'YES' : 'NO'}
  Ventilation:       ${mlPrediction.ventilation ? 'YES' : 'NO'}
  Action:            ${mlPrediction.recommendedAction?.toUpperCase() ?? 'N/A'}
`;

  writeToFile(PREDICTIONS_FILE, logMessage);
  console.log(`${riskColor}✨ ML prediction: ${mlPrediction.riskState} (confidence: ${mlPrediction.confidence})${colors.reset}`);
}

/**
 * Log backend actions taken
 */
function logActions(clientID, actions, mlPrediction) {
  const logMessage = `
⚙️  BACKEND ACTIONS TAKEN
${'─'.repeat(80)}
Client: ${clientID}
Risk State: ${mlPrediction.riskState}

Actions:
  Alert Created:          ${actions.alertCreated ? '✓ YES' : '✗ NO'}${actions.alertId ? ` (ID: ${actions.alertId})` : ''}
  Ventilation Triggered:  ${actions.ventilationTriggered ? '✓ YES' : '✗ NO'}${actions.ventilationMode ? ` (Mode: ${actions.ventilationMode})` : ''}
  WebSocket Broadcast:    ✓ YES
  Saved to Database:      ✓ YES

${'='.repeat(80)}
`;

  writeToFile(LOG_FILE, logMessage);

  // Console output
  if (actions.alertCreated) {
    console.log(`${colors.red}🚨 Alert created: ${mlPrediction.riskState}${colors.reset}`);
  }
  if (actions.ventilationTriggered) {
    console.log(`${colors.yellow}💨 Ventilation triggered: ${actions.ventilationMode}${colors.reset}`);
  }
}

/**
 * Log alert creation
 */
function logAlert(alert) {
  const logMessage = `
${'='.repeat(80)}
🚨 ALERT CREATED
${'='.repeat(80)}
Timestamp: ${getTimestamp()}
Client ID: ${alert.clientID}
Severity:  ${alert.severity.toUpperCase()}
Risk State: ${alert.riskState}

Message: ${alert.message}

Gas Levels:
  Methane: ${alert.gasLevels.methane.toFixed(2)} ppm
  LPG:     ${alert.gasLevels.lpg.toFixed(2)} ppm
  CO:      ${alert.gasLevels.carbonMonoxide.toFixed(2)} ppm
  H2S:     ${alert.gasLevels.hydrogenSulfide.toFixed(2)} ppm

Metadata:
  Confidence:          ${alert.metadata.confidence}
  PPM Risk:            ${alert.metadata.ppmRisk}
  Anomaly Risk:        ${alert.metadata.anomalyRisk}
  Classification:      ${alert.metadata.classificationMethod}
  Prediction Error:    ${alert.metadata.predictionError?.toFixed(4) || 'N/A'}
  Leak Probability:    ${(alert.metadata.leakProbability * 100).toFixed(1)}%

Status: ${alert.status.toUpperCase()}
${'='.repeat(80)}
`;

  writeToFile(ALERTS_FILE, logMessage);
}

/**
 * Log error
 */
function logError(context, error) {
  const logMessage = `
${'!'.repeat(80)}
❌ ERROR
${'!'.repeat(80)}
Timestamp: ${getTimestamp()}
Context: ${context}

Error: ${error.message}
Stack: ${error.stack}
${'!'.repeat(80)}
`;

  writeToFile(LOG_FILE, logMessage);
  console.error(`${colors.red}❌ Error in ${context}: ${error.message}${colors.reset}`);
}

/**
 * Log system startup
 */
function logStartup(port, mongoStatus, mlServiceUrl) {
  const logMessage = `
${'█'.repeat(80)}
🚀 GASGUARD BACKEND STARTED
${'█'.repeat(80)}
Timestamp: ${getTimestamp()}
Port: ${port}
MongoDB: ${mongoStatus ? 'CONNECTED' : 'DISCONNECTED'}
ML Service: ${mlServiceUrl}

Logging to:
  - ${LOG_FILE}
  - ${PREDICTIONS_FILE}
  - ${ALERTS_FILE}
${'█'.repeat(80)}
`;

  writeToFile(LOG_FILE, logMessage);
  console.log(`${colors.green}${colors.bright}🚀 Backend started - Logging enabled${colors.reset}`);
}

/**
 * Log statistics summary
 */
function logStats(totalReadings, activeAlerts, riskDistribution) {
  const logMessage = `
📊 STATISTICS SUMMARY
${'─'.repeat(80)}
Timestamp: ${getTimestamp()}

Total Readings Processed: ${totalReadings}
Active Alerts: ${activeAlerts}

Risk Distribution (Last 100):
${Object.entries(riskDistribution).map(([risk, count]) =>
  `  ${risk.padEnd(15)}: ${count.toString().padStart(4)} ${count > 0 ? '█'.repeat(Math.floor(count / 5)) : ''}`
).join('\n')}
`;

  writeToFile(LOG_FILE, logMessage);
}

// Export logger functions
module.exports = {
  logSensorInput,
  logMLRequest,
  logMLResponse,
  logActions,
  logAlert,
  logError,
  logStartup,
  logStats
};
