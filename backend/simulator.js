/**
 * GasGuard – Sensor Data Simulator
 * Acts as a real-time IoT replacement
 */

const axios = require("axios");

const BACKEND_URL = "http://localhost:3001/api/readings";
const CLIENT_ID = "SIM-PLANT-01";

// Gas configuration
const GAS_TYPES = ["LPG", "CH4", "CO", "H2S"];

// Baseline safe values
let baseValues = {
  LPG: 120,
  CH4: 180,
  CO: 40,
  H2S: 10
};

// Utility: random variation
function vary(value, range) {
  return Math.max(0, value + (Math.random() * range - range / 2));
}

// Simulate one reading
function generateReading() {
  return GAS_TYPES.map(gas => {
    switch (gas) {
      case "LPG": return vary(baseValues.LPG, 40);
      case "CH4": return vary(baseValues.CH4, 60);
      case "CO":  return vary(baseValues.CO, 20);
      case "H2S": return vary(baseValues.H2S, 10);
      default: return 0;
    }
  });
}

// Send reading to backend
async function sendReading() {
  const values = generateReading();

const payload = {
  clientID: CLIENT_ID,
  gasTypes: GAS_TYPES,
  values,
  zone: "Zone_A",
  source: "simulator"
};


  try {
    await axios.post(BACKEND_URL, payload);
    console.log("📡 Sent reading:", values.map(v => v.toFixed(1)));
} catch (err) {
  if (err.response) {
    console.error("❌ Simulator error:", err.response.status, err.response.data);
  } else {
    console.error("❌ Simulator error:", err.message);
  }
}
}


// Start real-time simulation
console.log("🚀 GasGuard Simulator started");
setInterval(sendReading, 2500); // every 2.5 seconds
