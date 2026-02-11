import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import io from 'socket.io-client';

const SIMULATOR_API = `http://${window.location.hostname}:5001`;
const BACKEND_API = `http://${window.location.hostname}:3001`;

const ZONES = ['ZONE_A_01', 'ZONE_B_02', 'ZONE_C_03', 'ZONE_D_04'];

const SCENARIOS = [
  { name: 'NORMAL', label: 'Normal', color: '#4ade80' },
  { name: 'LOW_ANOMALY', label: 'Low Anomaly', color: '#86efac' },
  { name: 'UNUSUAL', label: 'Unusual', color: '#fbbf24' },
  { name: 'ALERT', label: 'Alert', color: '#fb923c' },
  { name: 'WARNING', label: 'Warning', color: '#f97373' },
  { name: 'CRITICAL', label: 'Critical', color: '#fb7185' },
  { name: 'GRADUAL_LEAK', label: 'Gradual Leak', color: '#a855f7' },
  { name: 'SUDDEN_SPIKE', label: 'Sudden Spike', color: '#f472b6' },
];

const DURATIONS = [
  { label: '30s', value: 30 },
  { label: '60s', value: 60 },
  { label: '2 min', value: 120 },
  { label: '5 min', value: 300 },
  { label: 'Indefinite', value: null },
];

const REFERENCE_TABLE = [
  { scenario: 'NORMAL', methane: '50-300', lpg: '20-200', co: '5-20', h2s: '0.5-4' },
  { scenario: 'LOW_ANOMALY', methane: '1000-1400', lpg: '500-700', co: '25-32', h2s: '5-8' },
  { scenario: 'UNUSUAL', methane: '2500-3500', lpg: '1000-1400', co: '35-48', h2s: '10-14' },
  { scenario: 'ALERT', methane: '4000-4800', lpg: '1500-1900', co: '50-95', h2s: '15-19' },
  { scenario: 'WARNING', methane: '5000-6800', lpg: '2000-2900', co: '100-190', h2s: '20-45' },
  { scenario: 'CRITICAL', methane: '7000-10000', lpg: '3000-5000', co: '200-400', h2s: '50-100' },
];

const getRiskColor = (risk) => {
  const colors = {
    NORMAL: '#4ade80', LOW_ANOMALY: '#86efac', UNUSUAL: '#fbbf24',
    ALERT: '#fb923c', WARNING: '#f97373', CRITICAL: '#fb7185',
    GRADUAL_LEAK: '#a855f7', SUDDEN_SPIKE: '#f472b6', CUSTOM: '#38bdf8',
  };
  return colors[risk] || '#a6b0d8';
};

const App = () => {
  const [simulatorStatus, setSimulatorStatus] = useState('connecting');
  const [zoneStates, setZoneStates] = useState({});
  const [simStats, setSimStats] = useState({});
  const [selectedZone, setSelectedZone] = useState(ZONES[0]);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [selectedDuration, setSelectedDuration] = useState(60);
  const [customMode, setCustomMode] = useState(false);
  const [customLevels, setCustomLevels] = useState({
    methane: 100, lpg: 50, carbonMonoxide: 10, hydrogenSulfide: 2,
  });
  const [liveReading, setLiveReading] = useState(null);
  const [liveMl, setLiveMl] = useState(null);
  const [log, setLog] = useState([]);
  const [showReference, setShowReference] = useState(false);

  const addLog = useCallback((msg) => {
    const ts = new Date().toLocaleTimeString();
    setLog((prev) => [`[${ts}] ${msg}`, ...prev.slice(0, 49)]);
  }, []);

  // Poll simulator status
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await axios.get(`${SIMULATOR_API}/status`);
        setZoneStates(res.data.zones || {});
        setSimStats(res.data.stats || {});
        setSimulatorStatus('online');
      } catch {
        setSimulatorStatus('offline');
      }
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, []);

  // WebSocket to backend for live sensor + ML data
  useEffect(() => {
    const socket = io(BACKEND_API, {
      transports: ['websocket', 'polling'],
      reconnection: true,
    });

    socket.on('sensor-reading', (data) => {
      if (data.clientID === selectedZone) {
        setLiveReading(data);
      }
    });

    socket.on('ml-prediction', (data) => {
      if (data.clientID === selectedZone) {
        setLiveMl(data);
      }
    });

    return () => socket.disconnect();
  }, [selectedZone]);

  const activateScenario = async () => {
    const scenario = customMode ? 'CUSTOM' : selectedScenario;
    if (!scenario) {
      addLog('Select a scenario first');
      return;
    }

    const payload = {
      zone: selectedZone,
      scenario,
      duration: selectedDuration,
    };
    if (customMode) {
      payload.gasLevels = customLevels;
    }

    try {
      await axios.post(`${SIMULATOR_API}/scenario`, payload);
      addLog(`Activated ${scenario} on ${selectedZone} (${selectedDuration ? selectedDuration + 's' : 'indefinite'})`);
    } catch (err) {
      addLog(`Failed: ${err.response?.data?.error || err.message}`);
    }
  };

  const resetZone = async (zone) => {
    try {
      await axios.post(`${SIMULATOR_API}/reset`, { zone });
      addLog(`Reset ${zone} to NORMAL`);
    } catch (err) {
      addLog(`Reset failed: ${err.message}`);
    }
  };

  const resetAll = async () => {
    try {
      await axios.post(`${SIMULATOR_API}/reset`, { zone: 'all' });
      addLog('All zones reset to NORMAL');
    } catch (err) {
      addLog(`Reset all failed: ${err.message}`);
    }
  };

  return (
    <div className="App">
      {/* Header */}
      <header className="App-header">
        <h1>GasGuard Scenario Controller</h1>
        <div className="status-bar">
          <div className="status-item">
            <span style={{ color: simulatorStatus === 'online' ? '#4ade80' : '#fb7185' }}>&#9679;</span>
            Simulator: {simulatorStatus}
          </div>
          <div className="status-item">
            Readings Sent: {simStats.total_sent || 0}
          </div>
          <div className="status-item">
            Errors: {simStats.errors || 0}
          </div>
        </div>
      </header>

      <main className="main-content">
        {/* Zone Status Grid */}
        <section className="section">
          <h2 className="section-title">Zone Status</h2>
          <div className="zone-grid">
            {ZONES.map((zone) => {
              const state = zoneStates[zone] || {};
              const scenario = state.scenario || 'NORMAL';
              const borderColor = getRiskColor(scenario);
              return (
                <div key={zone} className="zone-card" style={{ borderColor }}>
                  <div className="zone-name">{zone}</div>
                  <div className="zone-scenario" style={{ color: borderColor }}>
                    {scenario}
                  </div>
                  {state.remaining != null && (
                    <div className="zone-remaining">
                      {state.remaining * 2}s remaining
                    </div>
                  )}
                  {state.leakProgress != null && (
                    <div className="zone-progress">
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${state.leakProgress * 100}%`, background: borderColor }}
                        />
                      </div>
                      <span>{(state.leakProgress * 100).toFixed(0)}%</span>
                    </div>
                  )}
                  {scenario !== 'NORMAL' && (
                    <button className="btn-small btn-reset" onClick={() => resetZone(zone)}>
                      Reset
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Scenario Control Panel */}
        <section className="section">
          <h2 className="section-title">Scenario Control</h2>
          <div className="control-card">
            {/* Zone selector */}
            <div className="control-row">
              <label>Target Zone:</label>
              <select
                className="select-input"
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
              >
                {ZONES.map((z) => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
            </div>

            {/* Scenario buttons */}
            <div className="control-row">
              <label>Scenario:</label>
              <div className="scenario-grid">
                {SCENARIOS.map((s) => (
                  <button
                    key={s.name}
                    className={`scenario-btn ${selectedScenario === s.name && !customMode ? 'active' : ''}`}
                    style={{
                      '--btn-color': s.color,
                      background: selectedScenario === s.name && !customMode
                        ? s.color : 'rgba(255,255,255,0.1)',
                      color: selectedScenario === s.name && !customMode ? '#fff' : s.color,
                      borderColor: s.color,
                    }}
                    onClick={() => { setSelectedScenario(s.name); setCustomMode(false); }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom mode toggle */}
            <div className="control-row">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={customMode}
                  onChange={(e) => setCustomMode(e.target.checked)}
                />
                Custom Gas Levels
              </label>
            </div>

            {/* Custom sliders */}
            {customMode && (
              <div className="custom-sliders">
                {[
                  { key: 'methane', label: 'Methane (CH4)', max: 10000 },
                  { key: 'lpg', label: 'LPG', max: 5000 },
                  { key: 'carbonMonoxide', label: 'CO', max: 400 },
                  { key: 'hydrogenSulfide', label: 'H2S', max: 100 },
                ].map((gas) => (
                  <div key={gas.key} className="slider-row">
                    <label>{gas.label}</label>
                    <input
                      type="range"
                      min="0"
                      max={gas.max}
                      step={gas.max > 1000 ? 10 : 1}
                      value={customLevels[gas.key]}
                      onChange={(e) =>
                        setCustomLevels((prev) => ({
                          ...prev,
                          [gas.key]: parseFloat(e.target.value),
                        }))
                      }
                      className="slider"
                    />
                    <span className="slider-value">{customLevels[gas.key]} ppm</span>
                  </div>
                ))}
              </div>
            )}

            {/* Duration selector */}
            <div className="control-row">
              <label>Duration:</label>
              <div className="duration-group">
                {DURATIONS.map((d) => (
                  <button
                    key={d.label}
                    className={`duration-btn ${selectedDuration === d.value ? 'active' : ''}`}
                    onClick={() => setSelectedDuration(d.value)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="control-row action-row">
              <button className="btn btn-activate" onClick={activateScenario}>
                Activate Scenario
              </button>
              <button className="btn btn-reset-all" onClick={resetAll}>
                Reset All Zones
              </button>
            </div>
          </div>
        </section>

        {/* Live Feedback Panel */}
        <section className="section">
          <h2 className="section-title">
            Live Feedback — {selectedZone}
          </h2>
          <div className="feedback-card">
            {liveReading ? (
              <div className="feedback-grid">
                <div className="feedback-item">
                  <span className="feedback-label">Methane</span>
                  <span className="feedback-value">
                    {(liveReading.gases?.methane || 0).toFixed(1)} ppm
                  </span>
                </div>
                <div className="feedback-item">
                  <span className="feedback-label">LPG</span>
                  <span className="feedback-value">
                    {(liveReading.gases?.lpg || 0).toFixed(1)} ppm
                  </span>
                </div>
                <div className="feedback-item">
                  <span className="feedback-label">CO</span>
                  <span className="feedback-value">
                    {(liveReading.gases?.carbonMonoxide || 0).toFixed(1)} ppm
                  </span>
                </div>
                <div className="feedback-item">
                  <span className="feedback-label">H2S</span>
                  <span className="feedback-value">
                    {(liveReading.gases?.hydrogenSulfide || 0).toFixed(1)} ppm
                  </span>
                </div>
                {liveMl && (
                  <>
                    <div className="feedback-item full-width">
                      <span className="feedback-label">ML Risk State</span>
                      <span
                        className="feedback-value risk-badge"
                        style={{ color: getRiskColor(liveMl.riskState) }}
                      >
                        {liveMl.riskState}
                      </span>
                    </div>
                    <div className="feedback-item">
                      <span className="feedback-label">Leak Probability</span>
                      <span className="feedback-value">
                        {((liveMl.mlResult?.leakProbability || 0) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="feedback-item">
                      <span className="feedback-label">Confidence</span>
                      <span className="feedback-value">
                        {liveMl.mlResult?.confidence || '—'}
                      </span>
                    </div>
                    <div className="feedback-item">
                      <span className="feedback-label">Action</span>
                      <span className="feedback-value">
                        {liveMl.mlResult?.recommendedAction || '—'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="no-data">Waiting for data from {selectedZone}...</div>
            )}
          </div>
        </section>

        {/* Activity Log */}
        <section className="section">
          <h2 className="section-title">Activity Log</h2>
          <div className="log-panel">
            {log.length === 0 ? (
              <div className="no-data">No activity yet</div>
            ) : (
              log.map((entry, i) => (
                <div key={i} className="log-entry">{entry}</div>
              ))
            )}
          </div>
        </section>

        {/* Scenario Reference Table */}
        <section className="section">
          <h2
            className="section-title clickable"
            onClick={() => setShowReference(!showReference)}
          >
            Scenario Reference {showReference ? '(hide)' : '(show)'}
          </h2>
          {showReference && (
            <div className="reference-table-container">
              <table className="reference-table">
                <thead>
                  <tr>
                    <th>Scenario</th>
                    <th>Methane (ppm)</th>
                    <th>LPG (ppm)</th>
                    <th>CO (ppm)</th>
                    <th>H2S (ppm)</th>
                  </tr>
                </thead>
                <tbody>
                  {REFERENCE_TABLE.map((row) => (
                    <tr key={row.scenario}>
                      <td style={{ color: getRiskColor(row.scenario), fontWeight: 'bold' }}>
                        {row.scenario}
                      </td>
                      <td>{row.methane}</td>
                      <td>{row.lpg}</td>
                      <td>{row.co}</td>
                      <td>{row.h2s}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default App;
