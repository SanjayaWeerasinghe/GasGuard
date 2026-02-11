/**
 * GasGuard Backend Server
 * Version 2.0 - Clean Architecture
 *
 * Features:
 * - IoT sensor data processing
 * - ML service integration
 * - Real-time WebSocket updates
 * - MongoDB data persistence
 * - Automated alert system
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const logger = require('./utils/logger');

// ===================================
// Configuration
// ===================================

const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGO_URI;
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000';

if (!MONGO_URI) {
  console.error('❌ Error: MONGO_URI not found in .env file');
  process.exit(1);
}

// ===================================
// Initialize Express App
// ===================================

const app = express();
const server = http.createServer(app);

// ===================================
// Initialize Socket.IO
// ===================================

const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Make io accessible to routes
app.set('io', io);

// ===================================
// Middleware
// ===================================

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// ===================================
// Routes
// ===================================

const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'GasGuard Backend API',
    version: '2.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      readings: '/api/readings',
      alerts: '/api/alerts',
      stats: '/api/stats',
      emergency: '/api/emergency',
      ventilation: '/api/ventilation',
      blockchainTransactions: '/api/blockchain/transactions',
      blockchainReport: '/api/blockchain/report',
      blockchainAuditTrail: '/api/blockchain/audit-trail',
      blockchainBlocks: '/api/blockchain/blocks'
    },
    documentation: 'https://github.com/gasguard/api-docs'
  });
});

// ===================================
// Socket.IO Connection Handling
// ===================================

io.on('connection', (socket) => {
  console.log(`🔌 WebSocket client connected: ${socket.id}`);

  // Send welcome message
  socket.emit('connected', {
    message: 'Connected to GasGuard real-time updates',
    timestamp: new Date().toISOString()
  });

  socket.on('disconnect', () => {
    console.log(`🔌 WebSocket client disconnected: ${socket.id}`);
  });

  // Handle client subscription to specific zones
  socket.on('subscribe', (data) => {
    if (!data || typeof data !== 'object') return;
    const { clientID } = data;
    if (clientID && typeof clientID === 'string' && /^[a-zA-Z0-9_-]+$/.test(clientID)) {
      socket.join(`zone-${clientID}`);
      console.log(`📍 Client ${socket.id} subscribed to zone-${clientID}`);
    }
  });
});

// ===================================
// MongoDB Connection
// ===================================

console.log('🔄 Connecting to MongoDB...');

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
.then(() => {
  console.log('✅ MongoDB connected successfully');
  console.log(`📊 Database: ${mongoose.connection.name}`);

  // Start server after successful DB connection
  server.listen(PORT, () => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('    🚀 GasGuard Backend Server Started');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  Port:           ${PORT}`);
    console.log(`  Environment:    ${process.env.NODE_ENV || 'development'}`);
    console.log(`  ML Service:     ${ML_SERVICE_URL}`);
    console.log(`  API Endpoints:  http://localhost:${PORT}/api`);
    console.log(`  Health Check:   http://localhost:${PORT}/api/health`);
    console.log(`  WebSocket:      ws://localhost:${PORT}`);
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    console.log('📡 Ready to receive sensor data...');

    // Log startup
    logger.logStartup(PORT, mongoose.connection.readyState === 1, ML_SERVICE_URL);
  });
})
.catch((err) => {
  console.error('❌ MongoDB connection error:', err.message);
  process.exit(1);
});

// ===================================
// Error Handling
// ===================================

// Handle MongoDB connection errors after initial connection
mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');

  // Close server
  server.close(() => {
    console.log('✅ HTTP server closed');
  });

  // Close MongoDB connection
  await mongoose.connection.close();
  console.log('✅ MongoDB connection closed');

  process.exit(0);
});

// ===================================
// Export for testing
// ===================================

module.exports = { app, server, io };
