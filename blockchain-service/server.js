// blockchain-service/server.js
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const DATA_FILE = path.join(__dirname, 'blockchain-data.json');
const MAX_TRANSACTIONS = 10000;
const MAX_BLOCKS = 2000;

// In-memory blockchain simulation
let blockchainSimulation = {
  blocks: [],
  transactions: [],
  currentBlock: 0
};

// ============================================================================
// PERSISTENCE
// ============================================================================

function saveToFile() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(blockchainSimulation, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save blockchain data:', err.message);
  }
}

function loadFromFile() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.transactions) && Array.isArray(data.blocks)) {
        blockchainSimulation = data;
        console.log(`Loaded ${data.transactions.length} transactions, ${data.blocks.length} blocks from disk`);
        return;
      }
    }
  } catch (err) {
    console.error('Failed to load blockchain data:', err.message);
  }
  // If load fails or no file, start fresh
  blockchainSimulation = { blocks: [], transactions: [], currentBlock: 0 };
}

// Load persisted data on startup
loadFromFile();

// ============================================================================
// BLOCKCHAIN SERVICE CLASS
// ============================================================================

class BlockchainService {
  constructor() {
    this.isConnected = false;
    this.contractAddress = null;
    this.initializeBlockchain();
  }

  async initializeBlockchain() {
    try {
      console.log('Attempting to connect to Ganache...');
      this.isConnected = false;
      this.initializeSimulation();
    } catch (error) {
      console.log('Ganache not available, using simulation mode');
      this.isConnected = false;
      this.initializeSimulation();
    }
  }

  initializeSimulation() {
    // Only add init transactions if the chain is empty (fresh start)
    if (blockchainSimulation.transactions.length === 0) {
      this.addSimulatedTransaction('system_start', { action: 'initialization' });
      this.addSimulatedTransaction('sensor_calibration', { sensors: 24 });
    }
    console.log('Blockchain simulation initialized');
  }

  async logEvent(eventType, data) {
    if (this.isConnected) {
      try {
        return {
          success: true,
          transactionHash: this.generateHash(),
          blockNumber: ++blockchainSimulation.currentBlock,
          gasUsed: 21000
        };
      } catch (error) {
        console.error('Blockchain transaction failed:', error);
        return this.logEventSimulated(eventType, data);
      }
    } else {
      return this.logEventSimulated(eventType, data);
    }
  }

  logEventSimulated(eventType, data) {
    const transaction = this.addSimulatedTransaction(eventType, data);
    return {
      success: true,
      transactionHash: transaction.hash,
      blockNumber: transaction.blockNumber,
      gasUsed: 21000,
      simulated: true
    };
  }

  addSimulatedTransaction(eventType, data) {
    const transaction = {
      hash: this.generateHash(),
      eventType,
      data,
      timestamp: new Date().toISOString(),
      blockNumber: ++blockchainSimulation.currentBlock,
      gasUsed: 21000,
      from: '0x1234567890123456789012345678901234567890'
    };

    blockchainSimulation.transactions.push(transaction);

    // Memory cap: keep only the most recent transactions
    if (blockchainSimulation.transactions.length > MAX_TRANSACTIONS) {
      blockchainSimulation.transactions = blockchainSimulation.transactions.slice(-MAX_TRANSACTIONS);
    }

    // Create block every 5 transactions
    if (blockchainSimulation.transactions.length % 5 === 0) {
      this.createSimulatedBlock();
    }

    // Persist after each transaction
    saveToFile();

    return transaction;
  }

  createSimulatedBlock() {
    const blockTransactions = blockchainSimulation.transactions.slice(-5);
    const block = {
      number: blockchainSimulation.currentBlock,
      hash: this.generateHash(),
      parentHash: blockchainSimulation.blocks.length > 0
        ? blockchainSimulation.blocks[blockchainSimulation.blocks.length - 1].hash
        : '0x0000000000000000000000000000000000000000000000000000000000000000',
      timestamp: new Date().toISOString(),
      transactions: blockTransactions.map(tx => tx.hash),
      gasUsed: blockTransactions.reduce((sum, tx) => sum + tx.gasUsed, 0),
      gasLimit: 8000000
    };

    blockchainSimulation.blocks.push(block);

    // Memory cap for blocks
    if (blockchainSimulation.blocks.length > MAX_BLOCKS) {
      blockchainSimulation.blocks = blockchainSimulation.blocks.slice(-MAX_BLOCKS);
    }
  }

  generateHash() {
    return '0x' + crypto.randomBytes(32).toString('hex');
  }

  async getTransactions(limit = 10) {
    return this.getSimulatedTransactions(limit);
  }

  getSimulatedTransactions(limit = 10) {
    return blockchainSimulation.transactions
      .slice(-limit)
      .map(tx => ({
        eventType: tx.eventType,
        data: tx.data,
        timestamp: tx.timestamp,
        transactionHash: tx.hash,
        blockNumber: tx.blockNumber,
        gasUsed: tx.gasUsed,
        simulated: true
      }));
  }

  getNetworkStatus() {
    return {
      connected: this.isConnected,
      networkId: this.isConnected ? 5777 : 'simulation',
      blockNumber: blockchainSimulation.currentBlock,
      accounts: this.isConnected ? 10 : 1,
      contractAddress: this.contractAddress || '0x1234567890123456789012345678901234567890',
      mode: this.isConnected ? 'ganache' : 'simulation'
    };
  }
}

// Initialize blockchain service
const blockchainService = new BlockchainService();

// ============================================================================
// EXISTING ROUTES
// ============================================================================

app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'Blockchain Logger',
    network: blockchainService.getNetworkStatus(),
    timestamp: new Date().toISOString()
  });
});

app.post('/log-event', async (req, res) => {
  try {
    const { eventType, data, timestamp } = req.body;

    if (!eventType || !data) {
      return res.status(400).json({ error: 'eventType and data are required' });
    }

    const result = await blockchainService.logEvent(eventType, data);

    res.json({
      success: true,
      transaction: result,
      timestamp: timestamp || new Date().toISOString()
    });

  } catch (error) {
    console.error('Log event error:', error);
    res.status(500).json({
      error: 'Failed to log event',
      message: error.message
    });
  }
});

app.post('/log-emergency', async (req, res) => {
  try {
    const { gasType, value, zone, timestamp } = req.body;

    if (!zone) {
      return res.status(400).json({ error: 'zone is required' });
    }

    const emergencyData = {
      type: 'emergency_alert',
      gasType,
      concentration: value,
      zone,
      severity: value > 500 ? 'critical' : 'high',
      timestamp: timestamp || new Date().toISOString()
    };

    const result = await blockchainService.logEvent('emergency_event', emergencyData);

    res.json({
      success: true,
      emergency: emergencyData,
      transaction: result
    });

  } catch (error) {
    console.error('Log emergency error:', error);
    res.status(500).json({
      error: 'Failed to log emergency event',
      message: error.message
    });
  }
});

app.get('/transactions', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const transactions = await blockchainService.getTransactions(parseInt(limit));

    res.json({
      transactions,
      count: transactions.length,
      network: blockchainService.getNetworkStatus()
    });

  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      error: 'Failed to fetch transactions',
      message: error.message
    });
  }
});

app.get('/network-status', (req, res) => {
  res.json(blockchainService.getNetworkStatus());
});

app.get('/contract-info', (req, res) => {
  res.json({
    address: blockchainService.contractAddress || '0x1234567890123456789012345678901234567890',
    functions: ['logEvent', 'getEventCount', 'getEvent'],
    mode: 'simulation'
  });
});

// ============================================================================
// NEW RETRIEVAL ENDPOINTS
// ============================================================================

// GET /transactions/zone/:zone — filter transactions by data.clientID
app.get('/transactions/zone/:zone', (req, res) => {
  try {
    const { zone } = req.params;
    const filtered = blockchainSimulation.transactions.filter(
      tx => tx.data && (tx.data.clientID === zone || tx.data.zone === zone)
    );
    res.json({
      transactions: filtered.map(tx => ({
        eventType: tx.eventType,
        data: tx.data,
        timestamp: tx.timestamp,
        transactionHash: tx.hash,
        blockNumber: tx.blockNumber,
        gasUsed: tx.gasUsed,
        simulated: true
      })),
      count: filtered.length,
      zone
    });
  } catch (error) {
    console.error('Get transactions by zone error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions', message: error.message });
  }
});

// GET /transactions/type/:eventType — filter by event type
app.get('/transactions/type/:eventType', (req, res) => {
  try {
    const { eventType } = req.params;
    const filtered = blockchainSimulation.transactions.filter(
      tx => tx.eventType === eventType
    );
    res.json({
      transactions: filtered.map(tx => ({
        eventType: tx.eventType,
        data: tx.data,
        timestamp: tx.timestamp,
        transactionHash: tx.hash,
        blockNumber: tx.blockNumber,
        gasUsed: tx.gasUsed,
        simulated: true
      })),
      count: filtered.length,
      eventType
    });
  } catch (error) {
    console.error('Get transactions by type error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions', message: error.message });
  }
});

// GET /transactions/range?from=ISO&to=ISO — date range filter
app.get('/transactions/range', (req, res) => {
  try {
    const { from, to } = req.query;
    let filtered = blockchainSimulation.transactions;

    if (from) {
      const fromDate = new Date(from);
      filtered = filtered.filter(tx => new Date(tx.timestamp) >= fromDate);
    }
    if (to) {
      const toDate = new Date(to);
      filtered = filtered.filter(tx => new Date(tx.timestamp) <= toDate);
    }

    res.json({
      transactions: filtered.map(tx => ({
        eventType: tx.eventType,
        data: tx.data,
        timestamp: tx.timestamp,
        transactionHash: tx.hash,
        blockNumber: tx.blockNumber,
        gasUsed: tx.gasUsed,
        simulated: true
      })),
      count: filtered.length,
      range: { from: from || null, to: to || null }
    });
  } catch (error) {
    console.error('Get transactions by range error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions', message: error.message });
  }
});

// GET /blocks?limit=50 — return blocks
app.get('/blocks', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 500);
    const blocks = blockchainSimulation.blocks.slice(-limit);
    res.json({
      blocks,
      count: blocks.length,
      totalBlocks: blockchainSimulation.blocks.length
    });
  } catch (error) {
    console.error('Get blocks error:', error);
    res.status(500).json({ error: 'Failed to fetch blocks', message: error.message });
  }
});

// GET /report — aggregated report
app.get('/report', (req, res) => {
  try {
    const txs = blockchainSimulation.transactions;
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // By event type
    const byEventType = {};
    txs.forEach(tx => {
      byEventType[tx.eventType] = (byEventType[tx.eventType] || 0) + 1;
    });

    // By zone (from data.clientID or data.zone)
    const byZone = {};
    txs.forEach(tx => {
      const zone = tx.data?.clientID || tx.data?.zone || 'unknown';
      byZone[zone] = (byZone[zone] || 0) + 1;
    });

    // By risk state (from data.riskState)
    const byRiskState = {};
    txs.forEach(tx => {
      const risk = tx.data?.riskState || 'N/A';
      byRiskState[risk] = (byRiskState[risk] || 0) + 1;
    });

    // 24h timeline (group by hour)
    const timeline24h = {};
    txs.forEach(tx => {
      const txDate = new Date(tx.timestamp);
      if (txDate >= oneDayAgo) {
        const hour = txDate.toISOString().substring(0, 13) + ':00:00Z';
        timeline24h[hour] = (timeline24h[hour] || 0) + 1;
      }
    });

    res.json({
      success: true,
      report: {
        totalTransactions: txs.length,
        totalBlocks: blockchainSimulation.blocks.length,
        currentBlockNumber: blockchainSimulation.currentBlock,
        byEventType,
        byZone,
        byRiskState,
        timeline24h,
        generatedAt: now.toISOString()
      }
    });
  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({ error: 'Failed to generate report', message: error.message });
  }
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

const PORT = process.env.PORT || 3002;

app.listen(PORT, () => {
  console.log(`Blockchain service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Network status: http://localhost:${PORT}/network-status`);
  console.log(`Report: http://localhost:${PORT}/report`);
  console.log(`Blocks: http://localhost:${PORT}/blocks`);
});

module.exports = { app, blockchainService };
