import React from 'react';
import { Link } from 'react-router-dom';
import './App.css';

const DigitalTwinPage = () => {
  return (
    <div className="gg-shell" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* HEADER */}
      <div className="gg-header">
        <div className="gg-title-block">
          <h1>GasGuard &ndash; <span>Digital Twin</span></h1>
          <p>3D facility visualization with real-time gas dispersion simulation.</p>
        </div>
        <div className="gg-header-actions">
          <Link to="/" className="gg-chip">Live Dashboard</Link>
          <Link to="/blockchain" className="gg-chip">Blockchain</Link>
          <Link to="/iot-health" className="gg-chip">IoT Health</Link>
          <span className="gg-chip active">
            <span className="gg-chip-dot"></span>
            Digital Twin
          </span>
        </div>
      </div>

      {/* 3D SCENE */}
      <iframe
        src="/zone-3d.html"
        title="GasGuard Digital Twin"
        style={{
          flex: 1,
          width: '100%',
          border: 'none',
          borderRadius: '16px',
          marginTop: '8px',
          minHeight: '500px',
        }}
      />
    </div>
  );
};

export default DigitalTwinPage;
