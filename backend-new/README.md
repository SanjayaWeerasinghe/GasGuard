# GasGuard Backend API v2.0

Clean, production-ready backend for GasGuard IoT gas detection system with ML integration.

## Features

✅ **IoT Data Processing** - Receives sensor readings from IoT devices
✅ **ML Integration** - Forwards data to ML service for hybrid classification
✅ **MongoDB Storage** - Persists readings, alerts, and system state
✅ **Real-time Updates** - WebSocket broadcasting for live dashboards
✅ **Automated Alerts** - Creates alerts for UNUSUAL+ risk states
✅ **Ventilation Control** - Auto-triggers for WARNING/CRITICAL states
✅ **RESTful API** - Clean, documented endpoints

## Architecture

```
IoT Device → POST /api/readings → Backend
                                     ├─→ Call ML Service (classification)
                                     ├─→ Save to MongoDB
                                     ├─→ Create Alert (if needed)
                                     ├─→ Trigger Ventilation (if needed)
                                     └─→ WebSocket Broadcast
```

## Quick Start

### 1. Install Dependencies

```bash
cd backend-new
npm install
```

### 2. Configure Environment

Create `.env` file:
```env
PORT=3001
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/gasguard
ML_SERVICE_URL=http://localhost:5000
```

### 3. Start Server

```bash
npm start
# or for development with auto-reload:
npm run dev
```

### 4. Verify

```bash
curl http://localhost:3001/api/health
```

## API Endpoints

### Health Check
```http
GET /api/health
```

### Submit Sensor Reading
```http
POST /api/readings
Content-Type: application/json

{
  "clientID": "ZONE_A_01",
  "gases": {
    "methane": 1500,
    "lpg": 800,
    "carbonMonoxide": 45,
    "hydrogenSulfide": 12
  },
  "environmental": {
    "temperature": 25,
    "humidity": 60,
    "pressure": 1013
  }
}
```

**Response:**
```json
{
  "success": true,
  "reading": {
    "id": "...",
    "clientID": "ZONE_A_01",
    "riskState": "UNUSUAL",
    "confidence": "high",
    "timestamp": "2026-02-04T..."
  },
  "classification": {
    "riskState": "UNUSUAL",
    "confidence": "high",
    "ppmClassification": {...},
    "anomalyDetection": {...}
  },
  "actions": {
    "alertCreated": true,
    "alertId": "...",
    "ventilationTriggered": false
  }
}
```

### Get Readings History
```http
GET /api/readings?clientID=ZONE_A_01&limit=50
```

### Get Active Alerts
```http
GET /api/alerts?status=active&limit=20
```

### Acknowledge Alert
```http
PUT /api/alerts/:id/acknowledge
```

### Get System Statistics
```http
GET /api/stats
```

## WebSocket Events

### Client → Server

**Subscribe to zone:**
```javascript
socket.emit('subscribe', { clientID: 'ZONE_A_01' });
```

### Server → Client

**Sensor update:**
```javascript
socket.on('sensor-update', (data) => {
  console.log(data);
  // {
  //   clientID: 'ZONE_A_01',
  //   riskState: 'UNUSUAL',
  //   gasReadings: {...},
  //   timestamp: '...',
  //   alert: { severity: 'medium', message: '...' }
  // }
});
```

## Decision Engine Logic

| Risk State | Alert Created | Ventilation | Mode |
|------------|---------------|-------------|------|
| NORMAL | ❌ | ❌ | - |
| LOW_ANOMALY | ❌ | ❌ | - |
| UNUSUAL | ✅ | ❌ | - |
| ALERT | ✅ | ❌ | - |
| WARNING | ✅ | ✅ | AUTO |
| CRITICAL | ✅ | ✅ | FORCED |

## Database Models

### SensorReading
- Raw IoT sensor data
- ML classification results
- Actions taken log

### Alert
- Alert details and severity
- Gas levels and dominant gas
- Status tracking (active/acknowledged/resolved)

### VentilationStatus
- Ventilation system state
- Mode (OFF/AUTO/FORCED)
- Trigger information

## Testing

### Manual Test
```bash
curl -X POST http://localhost:3001/api/readings \
  -H "Content-Type: application/json" \
  -d '{
    "clientID": "TEST001",
    "gases": {
      "methane": 100,
      "lpg": 50,
      "carbonMonoxide": 10,
      "hydrogenSulfide": 2
    }
  }'
```

### Check Response
```bash
curl http://localhost:3001/api/readings?clientID=TEST001&limit=1
```

## Dependencies

- **express** - Web framework
- **mongoose** - MongoDB ODM
- **socket.io** - Real-time WebSocket
- **axios** - HTTP client for ML service
- **cors** - Cross-origin resource sharing
- **dotenv** - Environment configuration

## Production Deployment

1. Set `NODE_ENV=production`
2. Use process manager (PM2)
3. Enable MongoDB replica set
4. Configure reverse proxy (nginx)
5. Enable HTTPS/TLS
6. Set up monitoring

## License

MIT
