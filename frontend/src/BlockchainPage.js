import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './App.css';

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : `http://${window.location.hostname}:3001`;

const RISK_COLORS = {
  NORMAL: '#4ade80',
  LOW_ANOMALY: '#86efac',
  UNUSUAL: '#fbbf24',
  ALERT: '#fb923c',
  WARNING: '#f97373',
  CRITICAL: '#fb7185',
};

const getRiskColor = (risk) => RISK_COLORS[risk] || '#a6b0d8';

const BlockchainPage = () => {
  const [blockchainTxs, setBlockchainTxs] = useState([]);
  const [blockchainReport, setBlockchainReport] = useState(null);
  const [status, setStatus] = useState('connecting');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [txRes, reportRes] = await Promise.all([
          axios.get(`${API_BASE}/api/blockchain/transactions?limit=50`),
          axios.get(`${API_BASE}/api/blockchain/report`)
        ]);
        setBlockchainTxs(txRes.data.transactions || txRes.data || []);
        if (reportRes.data?.report) {
          setBlockchainReport(reportRes.data.report);
        }
        setStatus('online');
      } catch (error) {
        console.error('Blockchain fetch failed:', error);
        setStatus('offline');
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="gg-shell">

      {/* HEADER */}
      <div className="gg-header">
        <div className="gg-title-block">
          <h1>GasGuard &ndash; <span>Blockchain Audit</span></h1>
          <p>Immutable ledger of gas detection events, alerts, and emergency actions.</p>
        </div>
        <div className="gg-header-actions">
          <Link to="/" className="gg-chip">Live Dashboard</Link>
          <span className="gg-chip active">
            <span className="gg-chip-dot"></span>
            Blockchain
          </span>
          <Link to="/digital-twin" className="gg-chip">Digital Twin</Link>
          <Link to="/iot-health" className="gg-chip">IoT Health</Link>
        </div>
      </div>

      {/* STATUS */}
      <div className="gg-status-strip">
        <div className="gg-status-pill">
          <strong>Blockchain</strong>
          <div className="gg-pill-value">
            <span className={`gg-pill-dot${status === 'online' ? '' : ' offline'}`}></span>
            {status}
          </div>
        </div>
        <div className="gg-status-pill">
          <strong>Transactions</strong>
          <div className="gg-pill-value">{blockchainReport?.totalTransactions || '--'}</div>
        </div>
        <div className="gg-status-pill">
          <strong>Blocks</strong>
          <div className="gg-pill-value">{blockchainReport?.totalBlocks || '--'}</div>
        </div>
        <div className="gg-status-pill">
          <strong>Last Sync</strong>
          <div className="gg-pill-value">{new Date().toLocaleTimeString()}</div>
        </div>
      </div>

      {/* AUDIT REPORT */}
      {blockchainReport && (
        <div className="gg-panel" style={{ marginBottom: 'var(--gg-gap)' }}>
          <div className="gg-panel-title-row">
            <h2>Blockchain Audit Report</h2>
            <span className="gg-panel-caption">Immutable Ledger</span>
          </div>

          <div className="gg-report-stats">
            <div className="gg-report-stat">
              <span className="gg-report-stat-label">Total Transactions</span>
              <span className="gg-report-stat-value" style={{ color: '#4ade80' }}>
                {blockchainReport.totalTransactions}
              </span>
            </div>
            <div className="gg-report-stat">
              <span className="gg-report-stat-label">Total Blocks</span>
              <span className="gg-report-stat-value" style={{ color: '#38bdf8' }}>
                {blockchainReport.totalBlocks}
              </span>
            </div>
            <div className="gg-report-stat">
              <span className="gg-report-stat-label">GAS_ALERT Events</span>
              <span className="gg-report-stat-value" style={{ color: '#fbbf24' }}>
                {blockchainReport.byEventType?.GAS_ALERT || 0}
              </span>
            </div>
            <div className="gg-report-stat">
              <span className="gg-report-stat-label">Emergency Events</span>
              <span className="gg-report-stat-value" style={{ color: '#fb7185' }}>
                {blockchainReport.byEventType?.emergency_event || 0}
              </span>
            </div>
          </div>

          {/* Events by Zone */}
          {blockchainReport.byZone && Object.keys(blockchainReport.byZone).length > 0 && (
            <div className="gg-report-section">
              <h4>Events by Zone</h4>
              <table className="gg-report-table">
                <thead>
                  <tr>
                    <th>Zone</th>
                    <th>Events</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(blockchainReport.byZone).map(([zone, count]) => (
                    <tr key={zone}>
                      <td>{zone}</td>
                      <td>{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Events by Risk State */}
          {blockchainReport.byRiskState && Object.keys(blockchainReport.byRiskState).length > 0 && (
            <div className="gg-report-section" style={{ marginTop: '14px' }}>
              <h4>Events by Risk State</h4>
              <div className="gg-risk-badges">
                {Object.entries(blockchainReport.byRiskState).map(([risk, count]) => (
                  <div key={risk} className="gg-risk-badge" style={{
                    borderLeftColor: getRiskColor(risk)
                  }}>
                    <span className="gg-risk-badge-label" style={{ color: getRiskColor(risk) }}>{risk}</span>
                    <span className="gg-risk-badge-count">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SYNC + LOG */}
      <div className="gg-bottom-row">
        <div className="gg-chain-mini">
          <h3>Blockchain Sync</h3>
          <p><b>Status:</b> <span>{status === 'online' ? 'Connected' : 'Disconnected'}</span></p>
          <p><b>Transactions:</b> <span>{blockchainReport?.totalTransactions || '--'}</span></p>
          <p><b>Blocks:</b> <span>{blockchainReport?.totalBlocks || '--'}</span></p>
          <hr className="gg-chain-hr" />
          <p><b>Latest Tx:</b> <span>
            {blockchainTxs.length > 0
              ? (blockchainTxs[blockchainTxs.length - 1].transactionHash || blockchainTxs[blockchainTxs.length - 1].hash || 'N/A').substring(0, 18) + '...'
              : '--'}
          </span></p>
          <p><b>Event Type:</b> <span>
            {blockchainTxs.length > 0
              ? blockchainTxs[blockchainTxs.length - 1].eventType || 'N/A'
              : '--'}
          </span></p>
        </div>

        <div className="gg-log-card">
          <h3>Blockchain Audit Log</h3>
          <div className="gg-log-meta">Latest immutable transactions (WARNING+ events)</div>
          <pre className="gg-log-pre" style={{ maxHeight: '400px' }}>
            {blockchainTxs.length === 0
              ? 'No blockchain transactions yet.\nTransactions are logged for WARNING and CRITICAL events only.'
              : blockchainTxs.slice(-30).reverse().map((tx) => {
                  const time = tx.timestamp ? new Date(tx.timestamp).toLocaleString() : 'N/A';
                  const block = tx.blockNumber || 'N/A';
                  const type = tx.eventType || 'Event';
                  const risk = tx.data?.riskState || '';
                  const hash = (tx.transactionHash || tx.hash || 'N/A').substring(0, 20);
                  return `[${time}] Block #${block} | ${type} ${risk ? '| ' + risk : ''} | ${hash}...`;
                }).join('\n')
            }
          </pre>
        </div>
      </div>

      {/* ALL TRANSACTIONS TABLE */}
      {blockchainTxs.length > 0 && (
        <div className="gg-panel" style={{ marginTop: 'var(--gg-gap)' }}>
          <div className="gg-panel-title-row">
            <h2>All Transactions</h2>
            <span className="gg-panel-caption">{blockchainTxs.length} records</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="gg-report-table">
              <thead>
                <tr>
                  <th>Block</th>
                  <th>Time</th>
                  <th>Event</th>
                  <th>Zone</th>
                  <th>Risk</th>
                  <th>Tx Hash</th>
                </tr>
              </thead>
              <tbody>
                {blockchainTxs.slice().reverse().map((tx, i) => (
                  <tr key={i}>
                    <td>#{tx.blockNumber || 'N/A'}</td>
                    <td style={{ fontSize: '11px' }}>
                      {tx.timestamp ? new Date(tx.timestamp).toLocaleString() : 'N/A'}
                    </td>
                    <td>{tx.eventType || 'Event'}</td>
                    <td>{tx.data?.clientID || tx.data?.zone || '--'}</td>
                    <td style={{ color: getRiskColor(tx.data?.riskState), fontWeight: 600 }}>
                      {tx.data?.riskState || '--'}
                    </td>
                    <td style={{ fontFamily: '"JetBrains Mono","Consolas",monospace', fontSize: '10px' }}>
                      {(tx.transactionHash || tx.hash || 'N/A').substring(0, 22)}...
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};

export default BlockchainPage;
