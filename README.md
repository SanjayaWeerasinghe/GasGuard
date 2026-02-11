# GasGuard – Blockchain-Enabled Smart IoT Gas Safety System

## Project Overview
GasGuard is a final year project that demonstrates a smartAS: Smart Gas Safety System integrating
real-time gas monitoring, machine learning–based risk prediction, blockchain-backed event logging,
and spatial visualization.

The system is designed as a software prototype using simulated sensor data to represent real-time
industrial gas monitoring scenarios.

## System Architecture
The system follows a modular microservice architecture:

- Backend Service (Node.js, Express, Socket.IO)
- Machine Learning Service (Python, LSTM-based prediction)
- Blockchain Logging Service (HTTP-based, simulation fallback)
- Frontend Dashboards & 3D Digital Twin
- Software-based Sensor Simulator

## Running the System (Development)
1. Start MongoDB (Atlas or local)
2. Start Backend:
   ```bash
   cd backend
   npm install
   npm run dev

## Start Blockchain Service
cd blockchain-service
npm install
npm start

## Start ML Service
python app.py

## Frontend Pages
Open frontend pages using Live Server or browser.

## Notes

- Physical IoT hardware is not included in the final prototype.
- Real-time behavior is achieved using simulated sensor data.
- Blockchain functionality is abstracted through a service layer.

## Author
Shagaan Thevarajah
Final Year Project – Computer Science