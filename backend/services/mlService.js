const axios = require("axios");

// URL of the ML service (Python)
const ML_URL = "http://localhost:5000/predict";

// Send gas values to ML and receive risk decision
async function getRiskPrediction(gasValues) {
  try {
    const response = await axios.post(ML_URL, {
      values: gasValues
    });

    return response.data;
  } catch (error) {
    console.error("❌ ML Service Error:", error.message);

    // Safe fallback if ML is unreachable
    return {
      riskState: "UNKNOWN",
      notify: false,
      alarm: false,
      ventilation: false
    };
  }
}

module.exports = { getRiskPrediction };
