// frontend/src/App.js - Fixed Version with Proper Backend Integration
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import './App.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// API Configuration - All traffic routes through backend
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : `http://${window.location.hostname}:3001`;

// Risk state color map (Dashboard design system)
const RISK_COLORS = {
  NORMAL: '#4ade80',
  LOW_ANOMALY: '#86efac',
  UNUSUAL: '#fbbf24',
  ALERT: '#fb923c',
  WARNING: '#f97373',
  CRITICAL: '#fb7185',
};

// Helper: Convert backend format { gasTypes, values } to { gases: {...} }
const transformReading = (reading) => {
  if (!reading) return null;

  // If already in the correct format, return as-is
  if (reading.gases) return reading;

  const gases = {};
  const gasTypeMap = {
    'CH4': 'methane',
    'LPG': 'lpg',
    'CO': 'carbonMonoxide',
    'H2S': 'hydrogenSulfide'
  };

  if (reading.gasTypes && reading.values) {
    reading.gasTypes.forEach((gas, i) => {
      const key = gasTypeMap[gas] || gas.toLowerCase();
      gases[key] = reading.values[i] || 0;
    });
  }

  return {
    ...reading,
    gases,
    timestamp: reading.createdAt || reading.timestamp || new Date().toISOString(),
    location: { zone: reading.zone || reading.clientID || 'Zone_A' }
  };
};

const App = () => {
  const [sensorData, setSensorData] = useState([]);
  const [currentReading, setCurrentReading] = useState(null);
  const [zoneReadings, setZoneReadings] = useState({}); // { ZONE_A_01: reading, ... }
  const [zoneSensorData, setZoneSensorData] = useState({}); // { ZONE_A_01: [r1, r2, ...], ... }
  const [mlPrediction, setMLPrediction] = useState(null);
  const [zonePredictions, setZonePredictions] = useState({}); // { ZONE_A_01: prediction, ... }
  const [blockchainReport, setBlockchainReport] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [systemStatus, setSystemStatus] = useState({
    sensors: 'connecting',
    ml: 'unknown',
    blockchain: 'unknown',
    backend: 'connecting'
  });
  const [emergencyActive, setEmergencyActive] = useState(false);
  const [ventilationStatus, setVentilationStatus] = useState({});
  const emergencyTimerRef = useRef(null);

  // Helper to add alerts without duplicates
  const addAlert = useCallback((message) => {
    const timestamp = new Date().toLocaleTimeString();
    setAlerts(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 9)]);
  }, []);

  // Helper to estimate time to threshold based on risk state
  const getTimeToThreshold = useCallback((riskState) => {
    const timeMap = {
      'CRITICAL': '< 5 min',
      'WARNING': '< 30 min',
      'ALERT': '1-2 hours',
      'UNUSUAL': '2-4 hours',
      'LOW_ANOMALY': '> 4 hours',
      'NORMAL': 'N/A'
    };
    return timeMap[riskState] || 'Unknown';
  }, []);

  // Initialize Socket.IO connection to backend (port 3001)
  useEffect(() => {
    const newSocket = io(API_BASE, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10
    });

    newSocket.on('connect', () => {
      console.log('Connected to backend:', newSocket.id);
      setSystemStatus(prev => ({ ...prev, backend: 'online', sensors: 'online' }));
      addAlert('System connected to backend');
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from backend');
      setSystemStatus(prev => ({ ...prev, backend: 'offline', sensors: 'offline' }));
      addAlert('Connection lost to backend');
    });

    newSocket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setSystemStatus(prev => ({ ...prev, backend: 'offline', sensors: 'offline' }));
    });

    // Listen for sensor readings from backend
    newSocket.on('sensor-reading', (data) => {
      const transformed = transformReading(data);
      if (transformed) {
        setCurrentReading(transformed);
        setSensorData(prev => [...prev.slice(-50), transformed]);
        setSystemStatus(prev => ({ ...prev, sensors: 'online' }));

        // Track per-zone: latest + time-series
        const zone = data.clientID || transformed.location?.zone || transformed.zone;
        if (zone) {
          setZoneReadings(prev => ({ ...prev, [zone]: transformed }));
          setZoneSensorData(prev => ({
            ...prev,
            [zone]: [...(prev[zone] || []).slice(-29), transformed]
          }));
        }
      }
    });

    // Listen for ML predictions
    newSocket.on('ml-prediction', (data) => {
      console.log('ML Prediction received:', data);
      const pred = {
        riskState: data.riskState,
        severity: data.severity,
        leakProbability: data.mlResult?.leakProbability || 0,
        confidence: data.mlResult?.confidence || 'unknown',
        timeToThreshold: getTimeToThreshold(data.riskState),
        riskLevel: data.riskState,
        ppmClassification: data.mlResult?.ppmClassification,
        anomalyDetection: data.mlResult?.anomalyDetection
      };
      setMLPrediction(pred);

      // Store per-zone prediction
      const zone = data.clientID;
      if (zone) {
        setZonePredictions(prev => ({ ...prev, [zone]: pred }));
      }
      setSystemStatus(prev => ({ ...prev, ml: 'online' }));
    });

    // Listen for alerts
    newSocket.on('alert', (alert) => {
      console.log('Alert received:', alert);
      const message = `[${alert.severity?.toUpperCase()}] ${alert.message}`;
      addAlert(message);

      // Auto-trigger emergency for critical alerts
      if (alert.severity === 'critical') {
        setEmergencyActive(true);
      }
    });

    // Listen for ventilation updates
    newSocket.on('ventilation', (data) => {
      console.log('Ventilation update:', data);
      setVentilationStatus(prev => ({
        ...prev,
        [data.zone]: {
          active: data.status === 'ON',
          mode: data.mode,
          trigger: data.trigger
        }
      }));
      addAlert(`Ventilation ${data.status} in ${data.zone} (${data.mode} mode)`);
    });

    newSocket.on('ventilation-status', (data) => {
      setVentilationStatus(prev => ({
        ...prev,
        [data.zone || 'Zone_A']: {
          active: data.isOn || data.status === 'ON',
          mode: data.mode
        }
      }));
    });

    // Listen for emergency events
    newSocket.on('emergency-event', (data) => {
      console.log('Emergency event:', data);
      setEmergencyActive(true);
      addAlert(`EMERGENCY: ${data.event}`);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [addAlert, getTimeToThreshold]);

  // Cleanup emergency timer on unmount
  useEffect(() => {
    return () => {
      if (emergencyTimerRef.current) {
        clearTimeout(emergencyTimerRef.current);
      }
    };
  }, []);

  // Fetch initial data on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Fetch recent readings (backend wraps in { success, count, readings })
        const readingsRes = await axios.get(`${API_BASE}/api/readings?limit=50`);
        const readingsArray = readingsRes.data?.readings || (Array.isArray(readingsRes.data) ? readingsRes.data : []);
        if (readingsArray.length > 0) {
          const transformed = readingsArray
            .reverse()
            .map(transformReading)
            .filter(Boolean);
          setSensorData(transformed);
          if (transformed.length > 0) {
            setCurrentReading(transformed[transformed.length - 1]);

            // Build zone maps from historical readings
            const zoneMap = {};
            const zoneHistory = {};
            transformed.forEach(r => {
              const zone = r.clientID || r.location?.zone || r.zone;
              if (zone) {
                zoneMap[zone] = r;
                if (!zoneHistory[zone]) zoneHistory[zone] = [];
                zoneHistory[zone].push(r);
              }
            });
            setZoneReadings(zoneMap);
            // Keep last 30 per zone
            Object.keys(zoneHistory).forEach(z => {
              zoneHistory[z] = zoneHistory[z].slice(-30);
            });
            setZoneSensorData(zoneHistory);
          }
        }

        // Fetch recent alerts (backend wraps in { success, count, alerts })
        const alertsRes = await axios.get(`${API_BASE}/api/alerts?limit=10`);
        const alertsArray = alertsRes.data?.alerts || (Array.isArray(alertsRes.data) ? alertsRes.data : []);
        if (alertsArray.length > 0) {
          const alertMessages = alertsArray.map(a =>
            `[${new Date(a.createdAt).toLocaleTimeString()}] [${a.severity?.toUpperCase()}] ${a.message}`
          );
          setAlerts(alertMessages);
        }

        // Check backend health
        const healthRes = await axios.get(`${API_BASE}/api/health`);
        if (healthRes.data?.status === 'ok') {
          setSystemStatus(prev => ({ ...prev, backend: 'online' }));
        }
      } catch (error) {
        console.error('Failed to fetch initial data:', error);
        setSystemStatus(prev => ({ ...prev, backend: 'offline' }));
      }
    };

    fetchInitialData();
  }, []);

  // Fetch blockchain report periodically (for System Summary)
  useEffect(() => {
    const fetchBlockchainData = async () => {
      try {
        const reportRes = await axios.get(`${API_BASE}/api/blockchain/report`);
        if (reportRes.data?.report) {
          setBlockchainReport(reportRes.data.report);
        }
        setSystemStatus(prev => ({ ...prev, blockchain: 'online' }));
      } catch (error) {
        console.error('Blockchain fetch failed:', error);
        setSystemStatus(prev => ({ ...prev, blockchain: 'offline' }));
      }
    };

    fetchBlockchainData();
    const interval = setInterval(fetchBlockchainData, 15000);
    return () => clearInterval(interval);
  }, []);

  // Trigger emergency protocol
  const triggerEmergencyProtocol = async () => {
    if (emergencyActive) return;

    setEmergencyActive(true);
    addAlert('EMERGENCY PROTOCOL ACTIVATED');

    try {
      await axios.post(`${API_BASE}/api/emergency`, {
        clientID: 'DASHBOARD_USER',
        event: 'MANUAL_EMERGENCY_TRIGGER',
        details: {
          triggeredBy: 'Dashboard User',
          timestamp: new Date().toISOString(),
          action: 'full_shutdown'
        }
      });

      // Activate ventilation for all zones
      await activateVentilation('all');

      addAlert('Emergency services notified');
      addAlert('All ventilation systems activated');

      // Reset emergency state after 60 seconds
      if (emergencyTimerRef.current) {
        clearTimeout(emergencyTimerRef.current);
      }
      emergencyTimerRef.current = setTimeout(() => {
        setEmergencyActive(false);
        addAlert('Emergency protocol ended - system resuming normal operation');
        emergencyTimerRef.current = null;
      }, 60000);

    } catch (error) {
      console.error('Emergency protocol failed:', error);
      addAlert('Emergency protocol error - Manual intervention required');
      setEmergencyActive(false);
    }
  };

  // Activate ventilation
  const activateVentilation = async (zone = 'Zone_A') => {
    try {
      addAlert(`Activating ventilation in ${zone}...`);

      await axios.post(`${API_BASE}/api/ventilation`, {
        clientID: 'DASHBOARD_USER',
        isOn: true,
        mode: 'manual',
        reason: 'Manual activation from dashboard'
      });

      setVentilationStatus(prev => ({
        ...prev,
        [zone]: { active: true, mode: 'MANUAL' }
      }));

      addAlert(`Ventilation system active in ${zone}`);
    } catch (error) {
      console.error('Ventilation activation failed:', error);
      addAlert(`Ventilation activation failed in ${zone}`);
    }
  };

  // Reset system — single setAlerts call to avoid state race
  const resetSystem = async () => {
    try {
      setEmergencyActive(false);
      setVentilationStatus({});
      setMLPrediction(null);
      setZoneReadings({});
      setZoneSensorData({});
      setZonePredictions({});
      if (emergencyTimerRef.current) {
        clearTimeout(emergencyTimerRef.current);
        emergencyTimerRef.current = null;
      }
      setAlerts(['System reset to normal operation — reset complete']);
    } catch (error) {
      console.error('Reset failed:', error);
    }
  };

  // OSHA-compliant thresholds (matching backend/ML service)
  const thresholds = {
    methane: { normal: 1000, warning: 5000, critical: 7000 },
    lpg: { normal: 500, warning: 2000, critical: 3000 },
    carbonMonoxide: { normal: 25, warning: 100, critical: 200 },
    hydrogenSulfide: { normal: 5, warning: 20, critical: 50 }
  };

  const getGasColor = (gasType, value) => {
    const threshold = thresholds[gasType];
    if (!threshold) return '#4ade80';
    if (value >= threshold.critical) return '#fb7185';
    if (value >= threshold.warning) return '#fb923c';
    if (value >= threshold.normal) return '#fbbf24';
    return '#4ade80';
  };

  // Build chart data for a specific zone's time-series
  const buildZoneChartData = (zoneId) => {
    const history = (zoneSensorData[zoneId] || []).slice(-20);
    return {
      labels: history.map(d =>
        new Date(d.timestamp || d.createdAt).toLocaleTimeString()
      ),
      datasets: [
        {
          label: 'CH4',
          data: history.map(d => d.gases?.methane || 0),
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.15)',
          tension: 0.3,
          borderWidth: 2,
          pointRadius: 1,
        },
        {
          label: 'LPG',
          data: history.map(d => d.gases?.lpg || 0),
          borderColor: '#fb923c',
          backgroundColor: 'rgba(251, 146, 60, 0.15)',
          tension: 0.3,
          borderWidth: 2,
          pointRadius: 1,
        },
        {
          label: 'CO',
          data: history.map(d => d.gases?.carbonMonoxide || 0),
          borderColor: '#f97373',
          backgroundColor: 'rgba(249, 115, 115, 0.15)',
          tension: 0.3,
          borderWidth: 2,
          pointRadius: 1,
        },
        {
          label: 'H2S',
          data: history.map(d => d.gases?.hydrogenSulfide || 0),
          borderColor: '#a855f7',
          backgroundColor: 'rgba(168, 85, 247, 0.15)',
          tension: 0.3,
          borderWidth: 2,
          pointRadius: 1,
        },
      ],
    };
  };

  const zoneChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { color: '#a6b0d8', font: { size: 9 }, boxWidth: 10, padding: 8 }
      },
      title: { display: false }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: 'ppm', color: '#a6b0d8', font: { size: 9 } },
        ticks: { color: '#a6b0d8', font: { size: 9 }, maxTicksLimit: 5 },
        grid: { color: 'rgba(148,163,184,0.08)' }
      },
      x: {
        ticks: { color: '#a6b0d8', font: { size: 8 }, maxTicksLimit: 6, maxRotation: 0 },
        grid: { color: 'rgba(148,163,184,0.06)' }
      }
    }
  };

  const getStatusDotClass = (status) => {
    if (status === 'online') return 'gg-pill-dot';
    if (status === 'connecting') return 'gg-pill-dot connecting';
    return 'gg-pill-dot offline';
  };

  const getRiskColor = (risk) => {
    return RISK_COLORS[risk] || '#a6b0d8';
  };

  // Gas display config — each zone shows all 4 gases
  const GAS_PARAMS = [
    { key: 'methane', label: 'CH4', model: 'MQ-4', thresholdKey: 'methane', color: '#38bdf8' },
    { key: 'lpg', label: 'LPG', model: 'MQ-2', thresholdKey: 'lpg', color: '#fb923c' },
    { key: 'carbonMonoxide', label: 'CO', model: 'MQ-7', thresholdKey: 'carbonMonoxide', color: '#f97373' },
    { key: 'hydrogenSulfide', label: 'H2S', model: 'MQ-136', thresholdKey: 'hydrogenSulfide', color: '#a855f7' },
  ];

  // Zone helpers
  const getZoneLabel = (id) => {
    if (id?.includes('A')) return 'Zone A';
    if (id?.includes('B')) return 'Zone B';
    if (id?.includes('C')) return 'Zone C';
    if (id?.includes('D')) return 'Zone D';
    return id || 'Unknown';
  };
  const getZoneCss = (id) => {
    if (id?.includes('A')) return 'zone-a';
    if (id?.includes('B')) return 'zone-b';
    if (id?.includes('C')) return 'zone-c';
    if (id?.includes('D')) return 'zone-d';
    return '';
  };

  // Sorted zone IDs for stable rendering order
  const sortedZoneIds = Object.keys(zoneReadings).sort();

  // Compute worst risk across all zones for summary
  const RISK_SEVERITY = ['NORMAL', 'LOW_ANOMALY', 'UNUSUAL', 'ALERT', 'WARNING', 'CRITICAL'];
  const worstPrediction = Object.values(zonePredictions).reduce((worst, pred) => {
    if (!worst) return pred;
    const wIdx = RISK_SEVERITY.indexOf(worst.riskState);
    const pIdx = RISK_SEVERITY.indexOf(pred.riskState);
    return pIdx > wIdx ? pred : worst;
  }, null);

  return (
    <div className="gg-shell">

      {/* ============ HEADER ============ */}
      <div className="gg-header">
        <div className="gg-title-block">
          <h1>GasGuard &ndash; <span>Smart IoT Gas Detection System</span></h1>
          <p>Real-time gas monitoring with blockchain-backed logging and LSTM-based leak prediction.</p>
        </div>
        <div className="gg-header-actions">
          <span className="gg-chip active">
            <span className="gg-chip-dot"></span>
            Live Dashboard
          </span>
          <Link to="/blockchain" className="gg-chip">Blockchain</Link>
          <Link to="/digital-twin" className="gg-chip">Digital Twin</Link>
          <Link to="/iot-health" className="gg-chip">IoT Health</Link>
        </div>
      </div>

      {/* ============ STATUS STRIP ============ */}
      <div className="gg-status-strip">
        <div className="gg-status-pill">
          <strong>Backend</strong>
          <div className="gg-pill-value">
            <span className={getStatusDotClass(systemStatus.backend)}></span>
            {systemStatus.backend}
          </div>
        </div>
        <div className="gg-status-pill">
          <strong>Sensors</strong>
          <div className="gg-pill-value">
            <span className={getStatusDotClass(systemStatus.sensors)}></span>
            {systemStatus.sensors}
          </div>
        </div>
        <div className="gg-status-pill">
          <strong>ML Engine</strong>
          <div className="gg-pill-value">
            <span className={getStatusDotClass(systemStatus.ml)}></span>
            {systemStatus.ml}
          </div>
        </div>
        <div className="gg-status-pill">
          <strong>Blockchain</strong>
          <div className="gg-pill-value">
            <span className={getStatusDotClass(systemStatus.blockchain)}></span>
            {systemStatus.blockchain}
          </div>
        </div>
      </div>

      {/* ============ EMERGENCY BANNER ============ */}
      {emergencyActive && (
        <div className="gg-emergency-banner">
          EMERGENCY PROTOCOL ACTIVE &mdash; FACILITY IN LOCKDOWN
        </div>
      )}

      {/* ============ ALERTS PANEL ============ */}
      {alerts.length > 0 && (
        <div className="gg-alerts-panel">
          <h3>System Alerts</h3>
          {alerts.slice(0, 5).map((alert, index) => (
            <div key={index} className="gg-alert-item">{alert}</div>
          ))}
        </div>
      )}

      {/* ============ TOP BAR: ML Overview + System Summary ============ */}
      <div className="gg-top-bar">

        {/* ML Overview — worst risk across all zones */}
        {Object.keys(zonePredictions).length > 0 ? (
          <div className={`gg-ml-card${worstPrediction && ['WARNING','CRITICAL'].includes(worstPrediction.riskState) ? ' gg-ml-card-alert' : ''}`}>
            <div className="gg-ml-header">
              <h2>ML Overview</h2>
              <span className="gg-ml-tag">LSTM &bull; {Object.keys(zonePredictions).length} Zones</span>
            </div>

            <div className="gg-ml-grid">
              <div className="gg-ml-cell">
                <span className="gg-ml-label">Highest Risk</span>
                <span className="gg-ml-value">
                  <span className="gg-ml-risk-pill" style={{
                    borderLeft: `3px solid ${getRiskColor(worstPrediction?.riskState)}`,
                    color: getRiskColor(worstPrediction?.riskState)
                  }}>
                    {worstPrediction?.riskState || '--'}
                  </span>
                </span>
              </div>
              <div className="gg-ml-cell">
                <span className="gg-ml-label">Active Zones</span>
                <span className="gg-ml-value">{Object.keys(zonePredictions).length}</span>
              </div>
            </div>

            {/* Per-zone risk summary */}
            <div className="gg-ml-zone-list">
              {sortedZoneIds.map(zoneId => {
                const zp = zonePredictions[zoneId];
                if (!zp) return null;
                return (
                  <div key={zoneId} className="gg-ml-zone-row">
                    <span className="gg-ml-zone-name">{getZoneLabel(zoneId)}</span>
                    <span style={{ color: getRiskColor(zp.riskState), fontWeight: 600, fontSize: '11px' }}>
                      {zp.riskState}
                    </span>
                    <span style={{ fontSize: '10px', color: '#a6b0d8' }}>
                      {(zp.leakProbability * 100).toFixed(0)}%
                    </span>
                  </div>
                );
              })}
            </div>

            {worstPrediction && ['WARNING', 'CRITICAL'].includes(worstPrediction.riskState) && (
              <div className="gg-ml-warning-box">
                <strong>High Risk Detected</strong>
                Automated ventilation activated. Emergency response on standby.
              </div>
            )}
          </div>
        ) : (
          <div className="gg-ml-waiting">
            <h2>ML Prediction Engine</h2>
            <p>Awaiting sensor data for LSTM analysis...</p>
          </div>
        )}

        {/* System Summary */}
        <div className="gg-quick-stats">
          <h3>System Summary</h3>
          <div className="gg-quick-grid">
            <div className="gg-quick-item">
              <span className="gg-quick-label">Last Alert</span>
              <span className="gg-quick-value">
                {alerts.length > 0 ? alerts[0].substring(0, 30) + '...' : '--'}
              </span>
            </div>
            <div className="gg-quick-item">
              <span className="gg-quick-label">Blockchain Block</span>
              <span className="gg-quick-value">
                {blockchainReport ? `#${blockchainReport.totalBlocks || '--'}` : '--'}
              </span>
            </div>
            <div className="gg-quick-item">
              <span className="gg-quick-label">Overall Status</span>
              <span className="gg-quick-value" style={{
                color: emergencyActive ? '#fb7185' : (worstPrediction?.riskState ? getRiskColor(worstPrediction.riskState) : '#4ade80')
              }}>
                {emergencyActive ? 'EMERGENCY' : (worstPrediction?.riskState || 'Normal')}
              </span>
            </div>
            <div className="gg-quick-item">
              <span className="gg-quick-label">Today's Readings</span>
              <span className="gg-quick-value">{sensorData.length}</span>
            </div>
          </div>
        </div>

      </div>

      {/* ============ SENSOR READINGS (full-width) ============ */}
      <div className="gg-panel" style={{ marginBottom: 'var(--gg-gap)' }}>
        <div className="gg-panel-title-row">
          <h2>Sensor Readings</h2>
          <span className="gg-panel-caption">{sortedZoneIds.length} Zone{sortedZoneIds.length !== 1 ? 's' : ''} &bull; Live Data</span>
        </div>

        {sortedZoneIds.length > 0 ? (
          <div className="gg-zone-grid">
            {sortedZoneIds.map(zoneId => {
              const reading = zoneReadings[zoneId];
              const gases = reading?.gases || {};
              const pred = zonePredictions[zoneId];
              return (
                <div key={zoneId} className={`gg-zone-card ${getZoneCss(zoneId)}`}>
                  <div className="gg-zone-header">
                    <span className="gg-zone-name">{getZoneLabel(zoneId)}</span>
                    <span className="gg-zone-id">{zoneId}</span>
                  </div>
                  <div className="gg-zone-gas-list">
                    {GAS_PARAMS.map(({ key, label, model, thresholdKey, color }) => (
                      <div key={key} className="gg-zone-gas-row">
                        <div className="gg-zone-gas-info">
                          <span className="gg-zone-gas-dot" style={{ background: color }}></span>
                          <span className="gg-zone-gas-name">{label}</span>
                          <span className="gg-zone-gas-model">{model}</span>
                        </div>
                        <div className="gg-zone-gas-value" style={{ color: getGasColor(thresholdKey, gases[key]) }}>
                          {(gases[key] || 0).toFixed(1)}
                          <span className="gg-zone-gas-unit">ppm</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Per-zone ML Prediction */}
                  {pred ? (
                    <div className="gg-zone-ml">
                      <div className="gg-zone-ml-header">
                        <span>ML Prediction</span>
                        <span className="gg-zone-ml-tag">LSTM</span>
                      </div>
                      <div className="gg-zone-ml-grid">
                        <div className="gg-zone-ml-item">
                          <span className="gg-zone-ml-label">Leak Prob.</span>
                          <span className="gg-zone-ml-value" style={{
                            color: pred.leakProbability > 0.7 ? '#fb7185' : '#4ade80'
                          }}>
                            {(pred.leakProbability * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="gg-zone-ml-item">
                          <span className="gg-zone-ml-label">Risk</span>
                          <span className="gg-zone-ml-value" style={{ color: getRiskColor(pred.riskState) }}>
                            {pred.riskState}
                          </span>
                        </div>
                        <div className="gg-zone-ml-item">
                          <span className="gg-zone-ml-label">Confidence</span>
                          <span className="gg-zone-ml-value">{pred.confidence}</span>
                        </div>
                        <div className="gg-zone-ml-item">
                          <span className="gg-zone-ml-label">Time to Thresh.</span>
                          <span className="gg-zone-ml-value">{pred.timeToThreshold}</span>
                        </div>
                      </div>
                      {(pred.ppmClassification?.dominantGas || pred.anomalyDetection?.trend) && (
                        <div className="gg-zone-ml-extras">
                          {pred.ppmClassification?.dominantGas && (
                            <span>Dominant: <strong>{pred.ppmClassification.dominantGas}</strong></span>
                          )}
                          {pred.anomalyDetection?.trend && (
                            <span>Trend: <strong>{pred.anomalyDetection.trend}</strong></span>
                          )}
                        </div>
                      )}
                      {['WARNING', 'CRITICAL'].includes(pred.riskState) && (
                        <div className="gg-zone-ml-alert">
                          High risk — ventilation activated
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="gg-zone-ml gg-zone-ml-waiting">
                      <span>ML prediction pending...</span>
                    </div>
                  )}

                  <div className="gg-zone-footer">
                    <div className="gg-sensor-dot"></div>
                    Active
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="gg-zone-grid">
            <div className="gg-zone-card gg-waiting-card">
              <h3>Waiting for sensor data...</h3>
              <p>Start the IoT simulator to see live readings</p>
              <code>python3 iot-simulator.py</code>
            </div>
          </div>
        )}
      </div>

      {/* ============ ZONE CHARTS ============ */}
      {sortedZoneIds.length > 0 && Object.keys(zoneSensorData).length > 0 && (
        <div className="gg-charts-section">
          <div className="gg-panel-title-row" style={{ marginBottom: '12px' }}>
            <h2>Live Gas Trends</h2>
            <span className="gg-panel-caption">{sortedZoneIds.length} Zones &bull; Last 20 readings</span>
          </div>
          <div className="gg-chart-grid">
            {sortedZoneIds.map(zoneId => {
              const history = zoneSensorData[zoneId] || [];
              if (history.length < 2) return null;
              return (
                <div key={zoneId} className={`gg-chart-box gg-chart-zone ${getZoneCss(zoneId)}`}>
                  <div className="gg-chart-header">
                    <span>{getZoneLabel(zoneId)}</span>
                    <span className="gg-chart-caption">{history.length} pts</span>
                  </div>
                  <div className="gg-chart-canvas-wrap">
                    <Line data={buildZoneChartData(zoneId)} options={zoneChartOptions} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============ CONTROLS ROW ============ */}
      <div className="gg-controls-row">

        {/* Emergency Controls */}
        <div className="gg-controls-card">
          <h3>Emergency Controls</h3>
          <div className="gg-btn-row">
            <button
              className="gg-btn emergency"
              onClick={triggerEmergencyProtocol}
              disabled={emergencyActive}
            >
              Emergency Stop
            </button>
            <button
              className="gg-btn success"
              onClick={() => activateVentilation('Zone_A')}
            >
              Ventilation
            </button>
            <button
              className="gg-btn warning"
              onClick={() => addAlert('Alert system test - All systems operational')}
            >
              Test Alert
            </button>
          </div>
        </div>

        {/* Ventilation Status */}
        <div className="gg-controls-card">
          <h3>Ventilation Status</h3>
          {Object.keys(ventilationStatus).length > 0 ? (
            <div className="gg-vent-grid">
              {Object.entries(ventilationStatus).map(([zone, status]) => (
                <div key={zone} className="gg-vent-item">
                  <span className="gg-vent-zone">{zone}</span>
                  <span className="gg-vent-status" style={{
                    color: status.active ? '#4ade80' : '#fb7185'
                  }}>
                    {status.active ? 'ACTIVE' : 'INACTIVE'}
                    {status.mode && ` (${status.mode})`}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: '11px', color: '#a6b0d8' }}>
              No active ventilation zones
            </div>
          )}
        </div>

        {/* System Operations */}
        <div className="gg-controls-card">
          <h3>System Operations</h3>
          <div className="gg-btn-row">
            <button className="gg-btn neutral" onClick={resetSystem}>
              Reset System
            </button>
            <button className="gg-btn neutral" onClick={() => setAlerts([])}>
              Clear Alerts
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};

export default App;
