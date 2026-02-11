import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './App.css';

const IoTHealthPage = () => {
  const [mapView, setMapView] = useState('factory');

  return (
    <div className="gg-shell">

      {/* HEADER */}
      <div className="gg-header">
        <div className="gg-title-block">
          <h1>GasGuard &ndash; <span>IoT Hardware Health</span></h1>
          <p>Monitor sensor connectivity, ESP32 status, and automatic ventilation hardware.</p>
        </div>
        <div className="gg-header-actions">
          <Link to="/" className="gg-chip">Live Dashboard</Link>
          <Link to="/blockchain" className="gg-chip">Blockchain</Link>
          <Link to="/digital-twin" className="gg-chip">Digital Twin</Link>
          <span className="gg-chip active">
            <span className="gg-chip-dot"></span>
            IoT Health
          </span>
        </div>
      </div>

      {/* STATUS STRIP */}
      <div className="iot-status-strip">
        <div className="iot-status-pill"><strong>System</strong><span className="iot-pill-dot ok"></span> Online</div>
        <div className="iot-status-pill"><strong>ESP32</strong><span className="iot-pill-dot ok"></span> Connected</div>
        <div className="iot-status-pill"><strong>MQTT</strong><span className="iot-pill-dot ok"></span> Connected</div>
        <div className="iot-status-pill"><strong>Sensors</strong><span>4 / 4</span></div>
        <div className="iot-status-pill"><strong>Vent</strong><span className="iot-pill-dot ok"></span> Active</div>
      </div>

      {/* SENSOR & DEVICE HEALTH */}
      <div className="gg-card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h2 className="gg-section-title" style={{ margin: 0 }}>SENSOR &amp; DEVICE HEALTH</h2>
          <span style={{ fontSize: '11px', color: 'var(--gg-text-sub)' }}>Real-time signal stability and heartbeat.</span>
        </div>
        <div className="iot-hw-grid">
          <div className="iot-hw-card mq2">
            <div className="iot-hw-name">MQ-2 LPG</div>
            <div className="iot-hw-status"><span className="iot-hw-dot ok"></span> Online</div>
            <div className="iot-hw-meta"><span>Stability: 98%</span><span>ID: MQ2-01</span></div>
          </div>
          <div className="iot-hw-card mq4">
            <div className="iot-hw-name">MQ-4 Methane</div>
            <div className="iot-hw-status"><span className="iot-hw-dot ok"></span> Online</div>
            <div className="iot-hw-meta"><span>Stability: 99%</span><span>ID: MQ4-01</span></div>
          </div>
          <div className="iot-hw-card mq7">
            <div className="iot-hw-name">MQ-7 CO</div>
            <div className="iot-hw-status"><span className="iot-hw-dot ok"></span> Online</div>
            <div className="iot-hw-meta"><span>Stability: 94%</span><span>ID: MQ7-01</span></div>
          </div>
          <div className="iot-hw-card mq136">
            <div className="iot-hw-name">MQ-136 H&#8322;S</div>
            <div className="iot-hw-status"><span className="iot-hw-dot ok"></span> Online</div>
            <div className="iot-hw-meta"><span>Stability: 96%</span><span>ID: MQ136-01</span></div>
          </div>
        </div>
      </div>

      {/* SPATIAL GAS INTELLIGENCE MAP */}
      <div className="gg-card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <h2 className="gg-section-title" style={{ margin: 0 }}>SPATIAL GAS INTELLIGENCE MAP</h2>
            <span style={{ fontSize: '11px', color: 'var(--gg-text-sub)' }}>Real-time sensor fusion &amp; ventilation visualization</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className={`iot-view-btn ${mapView === 'factory' ? 'active' : ''}`}
              onClick={() => setMapView('factory')}
            >Full Factory View</button>
            <button
              className={`iot-view-btn ${mapView === 'zones' ? 'active' : ''}`}
              onClick={() => setMapView('zones')}
            >Zonal Analysis</button>
          </div>
        </div>

        <div className="iot-map-wrapper">
          <svg viewBox="0 0 800 500" style={{ width: '100%', maxHeight: '400px' }}>
            {/* UNIFIED FACTORY VIEW */}
            <g style={{ display: mapView === 'factory' ? 'block' : 'none' }}>
              <path d="M 50,50 L 750,50 L 750,450 L 50,450 Z" fill="rgba(15,23,42,0.5)" stroke="var(--gg-border-soft, #1f2b4d)" strokeWidth="2" />
              <path d="M 400,50 L 400,200 M 400,300 L 400,450 M 50,250 L 750,250" stroke="rgba(31,43,77,0.8)" strokeWidth="2" strokeDasharray="8,4" />
              <path d="M 100,100 L 700,100 L 700,400 L 100,400 Z" fill="none" stroke="rgba(56,189,248,0.2)" strokeWidth="6" />

              {/* Zone A */}
              <text x="70" y="80" className="iot-zone-label">Zone A: Storage</text>
              <circle cx="160" cy="150" r="80" fill="#22c55e" filter="url(#gasBlur)" opacity="0.45" />
              <circle cx="140" cy="140" r="5" fill="#22c55e" />

              {/* Zone B */}
              <text x="420" y="80" className="iot-zone-label">Zone B: Compression</text>
              <circle cx="580" cy="150" r="60" fill="#fbbf24" filter="url(#gasBlur)" opacity="0.45" />
              <circle cx="600" cy="140" r="5" fill="#fbbf24" />

              {/* Zone C */}
              <text x="70" y="280" className="iot-zone-label">Zone C: Refinery</text>
              <circle cx="200" cy="350" r="100" fill="#ef4444" filter="url(#gasBlur)" opacity="0.45" />
              <circle cx="180" cy="340" r="5" fill="#22c55e" />

              {/* Zone D */}
              <text x="420" y="280" className="iot-zone-label">Zone D: Utility Area</text>
              <circle cx="580" cy="350" r="70" fill="#22c55e" filter="url(#gasBlur)" opacity="0.45" />
              <circle cx="600" cy="340" r="5" fill="#22c55e" />
            </g>

            {/* ZONAL ANALYSIS VIEW */}
            <g style={{ display: mapView === 'zones' ? 'block' : 'none' }}>
              <g transform="translate(40 60)">
                <rect width="340" height="180" rx="12" fill="rgba(255,255,255,0.02)" stroke="#38bdf8" strokeWidth="1.5" />
                <text x="15" y="25" className="iot-zone-label">Zone A</text>
                <text x="15" y="40" className="iot-zone-sublabel">Primary Intake</text>
                <circle cx="170" cy="110" r="70" fill="#22c55e" filter="url(#gasBlur)" opacity="0.45" />
              </g>
              <g transform="translate(420 60)">
                <rect width="340" height="180" rx="12" fill="rgba(255,255,255,0.02)" stroke="#fbbf24" strokeWidth="1.5" />
                <text x="15" y="25" className="iot-zone-label">Zone B</text>
                <text x="15" y="40" className="iot-zone-sublabel">Compression Unit</text>
                <circle cx="170" cy="110" r="65" fill="#fbbf24" filter="url(#gasBlur)" opacity="0.45" />
              </g>
              <g transform="translate(40 260)">
                <rect width="340" height="180" rx="12" fill="rgba(255,255,255,0.02)" stroke="#f97373" strokeWidth="1.5" />
                <text x="15" y="25" className="iot-zone-label">Zone C</text>
                <text x="15" y="40" className="iot-zone-sublabel">Refinery Link</text>
                <circle cx="170" cy="110" r="80" fill="#ef4444" filter="url(#gasBlur)" opacity="0.45" />
              </g>
              <g transform="translate(420 260)">
                <rect width="340" height="180" rx="12" fill="rgba(255,255,255,0.02)" stroke="#22c55e" strokeWidth="1.5" />
                <text x="15" y="25" className="iot-zone-label">Zone D</text>
                <text x="15" y="40" className="iot-zone-sublabel">Utility Area</text>
                <circle cx="170" cy="110" r="60" fill="#22c55e" filter="url(#gasBlur)" opacity="0.45" />
              </g>
            </g>

            {/* Blur filter for gas clouds */}
            <defs>
              <filter id="gasBlur"><feGaussianBlur stdDeviation="18" /></filter>
            </defs>
          </svg>
        </div>

        {/* Legend */}
        <div className="iot-map-legend">
          <div className="iot-legend-item"><div className="iot-legend-symbol" style={{ background: 'var(--gg-accent)', borderRadius: '50%' }}></div><span><b>Sensor:</b> Active</span></div>
          <div className="iot-legend-item"><div className="iot-legend-symbol" style={{ background: '#fbbf24', borderRadius: '50%' }}></div><span><b>Sensor:</b> Check</span></div>
          <div className="iot-legend-item"><div className="iot-legend-symbol" style={{ border: '2px solid #60a5fa', background: 'transparent' }}></div><span><b>Vent:</b> Active</span></div>
          <div className="iot-legend-item"><div className="iot-legend-symbol" style={{ background: '#ef4444', filter: 'blur(4px)', opacity: 0.6 }}></div><span><b>Gas:</b> Alert</span></div>
        </div>
      </div>

      {/* DIAGNOSTICS LOG */}
      <div className="gg-card">
        <h2 className="gg-section-title">IOT DIAGNOSTICS LOG</h2>
        <table className="iot-diag-table">
          <thead>
            <tr>
              <th style={{ width: '120px' }}>Time</th>
              <th style={{ width: '120px' }}>Device</th>
              <th style={{ width: '80px' }}>Level</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>23:14:02</td><td>ESP32-01</td><td><span className="iot-diag-type info">INFO</span></td><td>Heartbeat received via MQTT</td></tr>
            <tr><td>23:13:45</td><td>MQ-4</td><td><span className="iot-diag-type info">INFO</span></td><td>Baseline calibration stable</td></tr>
            <tr><td>23:12:30</td><td>MQ-2</td><td><span className="iot-diag-type warn">WARN</span></td><td>Slight drift detected — recalibrating</td></tr>
            <tr><td>23:11:18</td><td>ESP32-01</td><td><span className="iot-diag-type info">INFO</span></td><td>WiFi RSSI: -42 dBm (Excellent)</td></tr>
            <tr><td>23:10:05</td><td>Vent-01</td><td><span className="iot-diag-type info">INFO</span></td><td>Fan RPM nominal — 1200 RPM</td></tr>
            <tr><td>23:08:52</td><td>MQ-7</td><td><span className="iot-diag-type warn">WARN</span></td><td>CO baseline elevated — monitoring</td></tr>
            <tr><td>23:07:40</td><td>MQ-136</td><td><span className="iot-diag-type info">INFO</span></td><td>H&#8322;S sensor warmup complete</td></tr>
            <tr><td>23:06:15</td><td>ESP32-01</td><td><span className="iot-diag-type info">INFO</span></td><td>MQTT broker reconnected successfully</td></tr>
          </tbody>
        </table>
      </div>

      <div style={{ textAlign: 'center', marginTop: '30px', opacity: 0.6, fontSize: '11px', color: 'var(--gg-text-sub)' }}>
        IoT Layer &mdash; Hardware observability for GasGuard
      </div>
    </div>
  );
};

export default IoTHealthPage;
