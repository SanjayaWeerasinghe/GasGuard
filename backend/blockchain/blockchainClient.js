// backend/blockchain/blockchainClient.js

module.exports = {
  async recordEvent(event) {
    console.log("🔗 Blockchain Event Recorded:", {
      timestamp: event.timestamp,
      zone: event.zone,
      riskLevel: event.riskLevel,
      readingHash: event.readingHash
    });

    // MVP-safe simulated blockchain write
    return true;
  }
};
