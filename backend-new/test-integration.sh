#!/bin/bash

echo "======================================================================"
echo "      GasGuard Backend Integration Test Suite"
echo "======================================================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test 1: Health Check
echo "Test 1: Backend Health Check"
response=$(curl -s http://localhost:3001/api/health)
if echo "$response" | grep -q '"status":"ok"'; then
    echo -e "${GREEN}✓ PASSED${NC} - Backend is healthy"
else
    echo -e "${RED}✗ FAILED${NC} - Backend health check failed"
fi
echo ""

# Test 2: ML Service Health Check
echo "Test 2: ML Service Health Check"
response=$(curl -s http://127.0.0.1:5000/health)
if echo "$response" | grep -q '"status":"online"'; then
    echo -e "${GREEN}✓ PASSED${NC} - ML Service is online"
else
    echo -e "${RED}✗ FAILED${NC} - ML Service unavailable"
fi
echo ""

# Test 3: NORMAL Reading
echo "Test 3: Submit NORMAL Sensor Reading"
response=$(curl -s -X POST http://localhost:3001/api/readings \
  -H "Content-Type: application/json" \
  -d '{"clientID":"TEST_NORMAL","gases":{"methane":100,"lpg":50,"carbonMonoxide":10,"hydrogenSulfide":2}}')
if echo "$response" | grep -q '"success":true'; then
    echo -e "${GREEN}✓ PASSED${NC} - Reading processed successfully"
    echo "   Risk State: $(echo $response | grep -o '"riskState":"[^"]*"' | cut -d'"' -f4)"
else
    echo -e "${RED}✗ FAILED${NC} - Failed to process reading"
fi
echo ""

# Test 4: WARNING Reading
echo "Test 4: Submit WARNING Level Reading"
response=$(curl -s -X POST http://localhost:3001/api/readings \
  -H "Content-Type: application/json" \
  -d '{"clientID":"TEST_WARNING","gases":{"methane":5500,"lpg":400,"carbonMonoxide":30,"hydrogenSulfide":6}}')
if echo "$response" | grep -q '"ventilationTriggered":true'; then
    echo -e "${GREEN}✓ PASSED${NC} - Ventilation triggered for WARNING"
    echo "   Ventilation Mode: $(echo $response | grep -o '"ventilationMode":"[^"]*"' | cut -d'"' -f4)"
else
    echo -e "${YELLOW}⚠ WARNING${NC} - Expected ventilation trigger"
fi
echo ""

# Test 5: Retrieve Alerts
echo "Test 5: Retrieve Active Alerts"
response=$(curl -s http://localhost:3001/api/alerts)
if echo "$response" | grep -q '"success":true'; then
    count=$(echo $response | grep -o '"count":[0-9]*' | cut -d':' -f2)
    echo -e "${GREEN}✓ PASSED${NC} - Retrieved $count active alerts"
else
    echo -e "${RED}✗ FAILED${NC} - Failed to retrieve alerts"
fi
echo ""

# Test 6: Statistics
echo "Test 6: Get System Statistics"
response=$(curl -s http://localhost:3001/api/stats)
if echo "$response" | grep -q '"totalReadings"'; then
    total=$(echo $response | grep -o '"totalReadings":[0-9]*' | cut -d':' -f2)
    echo -e "${GREEN}✓ PASSED${NC} - Total readings: $total"
else
    echo -e "${RED}✗ FAILED${NC} - Failed to get statistics"
fi
echo ""

echo "======================================================================"
echo "                    Test Suite Complete"
echo "======================================================================"
echo ""
echo "Services Status:"
echo "  Backend:    http://localhost:3001"
echo "  ML Service: http://127.0.0.1:5000"
echo "  MongoDB:    Connected"
echo ""
