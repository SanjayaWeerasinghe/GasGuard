/**
 * GasGuard - MQ Sensor PPM Converter
 *
 * Converts MQ sensor analog readings to PPM (parts per million) values.
 * Supports: MQ-4 (Methane), MQ-6 (LPG), MQ-7 (CO), MQ-136 (H2S)
 *
 * IMPORTANT: Sensors must be calibrated in clean air before use!
 */

#include <Arduino.h>
#include <math.h>

// ============================================================================
// SENSOR CONFIGURATION
// ============================================================================

// Analog pins for each sensor (adjust based on your wiring)
#define MQ4_PIN   34   // Methane (CH4)
#define MQ6_PIN   35   // LPG
#define MQ7_PIN   32   // Carbon Monoxide (CO)
#define MQ136_PIN 33   // Hydrogen Sulfide (H2S)

// ADC Configuration
#define ADC_BITS      12        // ESP32 has 12-bit ADC (0-4095)
#define ADC_MAX       4095.0
#define V_REF         3.3       // ESP32 reference voltage

// Load Resistance (RL) - typically 10kΩ for MQ sensors
#define RL_VALUE      10.0      // in kΩ

// Sensor calibration values (R0 = sensor resistance in clean air)
// MUST BE CALIBRATED! These are typical values, adjust for your sensors
#define MQ4_R0        10.0      // MQ-4 R0 in kΩ
#define MQ6_R0        10.0      // MQ-6 R0 in kΩ
#define MQ7_R0        10.0      // MQ-7 R0 in kΩ
#define MQ136_R0      10.0      // MQ-136 R0 in kΩ

// Conversion curve parameters (from datasheets)
// PPM = A * (Rs/R0)^B

// MQ-4 (Methane)
#define MQ4_A         1012.0
#define MQ4_B         -2.786

// MQ-6 (LPG)
#define MQ6_A         1009.0
#define MQ6_B         -2.35

// MQ-7 (Carbon Monoxide)
#define MQ7_A         99.042
#define MQ7_B         -1.518

// MQ-136 (Hydrogen Sulfide)
#define MQ136_A       44.947
#define MQ136_B       -3.445

// Sampling configuration
#define NUM_SAMPLES   10        // Number of readings to average
#define SAMPLE_DELAY  50        // Delay between samples (ms)

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Read analog value and convert to voltage
 */
float readVoltage(int pin) {
  int sum = 0;

  // Take multiple samples and average
  for (int i = 0; i < NUM_SAMPLES; i++) {
    sum += analogRead(pin);
    delay(SAMPLE_DELAY);
  }

  float avgValue = sum / (float)NUM_SAMPLES;
  float voltage = avgValue * (V_REF / ADC_MAX);

  return voltage;
}

/**
 * Calculate sensor resistance (Rs) from voltage
 */
float calculateRs(float voltage) {
  if (voltage <= 0.0 || voltage >= V_REF) {
    return -1.0;  // Invalid reading
  }

  // Rs = [(Vc * RL) / Vout] - RL
  float Rs = ((V_REF * RL_VALUE) / voltage) - RL_VALUE;

  return Rs;
}

/**
 * Convert Rs/R0 ratio to PPM using power law
 * PPM = A * (Rs/R0)^B
 */
float convertToPPM(float Rs, float R0, float A, float B) {
  if (Rs <= 0 || R0 <= 0) {
    return 0.0;  // Invalid
  }

  float ratio = Rs / R0;
  float ppm = A * pow(ratio, B);

  // Ensure non-negative result
  if (ppm < 0) ppm = 0;

  return ppm;
}

// ============================================================================
// SENSOR READING FUNCTIONS
// ============================================================================

/**
 * Read MQ-4 sensor and return Methane concentration in PPM
 */
float readMethanePPM() {
  float voltage = readVoltage(MQ4_PIN);
  float Rs = calculateRs(voltage);

  if (Rs < 0) {
    Serial.println("❌ MQ-4: Invalid reading");
    return 0.0;
  }

  float ppm = convertToPPM(Rs, MQ4_R0, MQ4_A, MQ4_B);

  Serial.printf("MQ-4 (CH4): V=%.2f, Rs=%.2f, PPM=%.2f\n", voltage, Rs, ppm);

  return ppm;
}

/**
 * Read MQ-6 sensor and return LPG concentration in PPM
 */
float readLPG_PPM() {
  float voltage = readVoltage(MQ6_PIN);
  float Rs = calculateRs(voltage);

  if (Rs < 0) {
    Serial.println("❌ MQ-6: Invalid reading");
    return 0.0;
  }

  float ppm = convertToPPM(Rs, MQ6_R0, MQ6_A, MQ6_B);

  Serial.printf("MQ-6 (LPG): V=%.2f, Rs=%.2f, PPM=%.2f\n", voltage, Rs, ppm);

  return ppm;
}

/**
 * Read MQ-7 sensor and return Carbon Monoxide concentration in PPM
 */
float readCO_PPM() {
  float voltage = readVoltage(MQ7_PIN);
  float Rs = calculateRs(voltage);

  if (Rs < 0) {
    Serial.println("❌ MQ-7: Invalid reading");
    return 0.0;
  }

  float ppm = convertToPPM(Rs, MQ7_R0, MQ7_A, MQ7_B);

  Serial.printf("MQ-7 (CO): V=%.2f, Rs=%.2f, PPM=%.2f\n", voltage, Rs, ppm);

  return ppm;
}

/**
 * Read MQ-136 sensor and return Hydrogen Sulfide concentration in PPM
 */
float readH2S_PPM() {
  float voltage = readVoltage(MQ136_PIN);
  float Rs = calculateRs(voltage);

  if (Rs < 0) {
    Serial.println("❌ MQ-136: Invalid reading");
    return 0.0;
  }

  float ppm = convertToPPM(Rs, MQ136_R0, MQ136_A, MQ136_B);

  Serial.printf("MQ-136 (H2S): V=%.2f, Rs=%.2f, PPM=%.2f\n", voltage, Rs, ppm);

  return ppm;
}

// ============================================================================
// CALIBRATION FUNCTION (CRITICAL!)
// ============================================================================

/**
 * Calibrate sensor in clean air
 * Run this function once before first use
 *
 * INSTRUCTIONS:
 * 1. Place sensors in clean air (outdoor or well-ventilated area)
 * 2. Wait 24-48 hours for sensor warm-up
 * 3. Run this calibration function
 * 4. Record the R0 values printed
 * 5. Update the R0 constants at the top of this file
 */
void calibrateSensors() {
  Serial.println("\n🔧 Starting Sensor Calibration...");
  Serial.println("⚠️  Ensure sensors are in CLEAN AIR!");
  Serial.println("⏳ Warming up for 60 seconds...\n");

  delay(60000);  // 60 second warm-up

  // MQ-4 Calibration
  float v_mq4 = readVoltage(MQ4_PIN);
  float r0_mq4 = calculateRs(v_mq4);
  Serial.printf("MQ-4 R0 = %.2f kΩ\n", r0_mq4);

  // MQ-6 Calibration
  float v_mq6 = readVoltage(MQ6_PIN);
  float r0_mq6 = calculateRs(v_mq6);
  Serial.printf("MQ-6 R0 = %.2f kΩ\n", r0_mq6);

  // MQ-7 Calibration
  float v_mq7 = readVoltage(MQ7_PIN);
  float r0_mq7 = calculateRs(v_mq7);
  Serial.printf("MQ-7 R0 = %.2f kΩ\n", r0_mq7);

  // MQ-136 Calibration
  float v_mq136 = readVoltage(MQ136_PIN);
  float r0_mq136 = calculateRs(v_mq136);
  Serial.printf("MQ-136 R0 = %.2f kΩ\n", r0_mq136);

  Serial.println("\n✅ Calibration Complete!");
  Serial.println("📝 Copy these R0 values to the top of this file:");
  Serial.printf("#define MQ4_R0    %.2f\n", r0_mq4);
  Serial.printf("#define MQ6_R0    %.2f\n", r0_mq6);
  Serial.printf("#define MQ7_R0    %.2f\n", r0_mq7);
  Serial.printf("#define MQ136_R0  %.2f\n", r0_mq136);
}

// ============================================================================
// MAIN SENSOR READING FUNCTION
// ============================================================================

/**
 * Read all sensors and return gas concentrations
 */
struct GasReadings {
  float methane;
  float lpg;
  float carbonMonoxide;
  float hydrogenSulfide;
  bool valid;
};

GasReadings readAllSensors() {
  GasReadings readings;

  readings.methane = readMethanePPM();
  readings.lpg = readLPG_PPM();
  readings.carbonMonoxide = readCO_PPM();
  readings.hydrogenSulfide = readH2S_PPM();

  // Check if readings are valid (all non-zero and within reasonable range)
  readings.valid = (readings.methane >= 0 && readings.methane < 100000) &&
                   (readings.lpg >= 0 && readings.lpg < 100000) &&
                   (readings.carbonMonoxide >= 0 && readings.carbonMonoxide < 10000) &&
                   (readings.hydrogenSulfide >= 0 && readings.hydrogenSulfide < 1000);

  return readings;
}

// ============================================================================
// ARDUINO SETUP & LOOP (Example)
// ============================================================================

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("🚀 GasGuard Sensor System Starting...");

  // Configure ADC
  analogReadResolution(ADC_BITS);
  analogSetAttenuation(ADC_11db);  // Full range 0-3.3V

  // Uncomment to run calibration (first time only)
  // calibrateSensors();

  Serial.println("✅ Sensors initialized");
  Serial.println("📊 Reading gas concentrations...\n");
}

void loop() {
  GasReadings readings = readAllSensors();

  if (readings.valid) {
    Serial.println("\n📊 Current Gas Levels:");
    Serial.printf("  CH4:  %.2f ppm\n", readings.methane);
    Serial.printf("  LPG:  %.2f ppm\n", readings.lpg);
    Serial.printf("  CO:   %.2f ppm\n", readings.carbonMonoxide);
    Serial.printf("  H2S:  %.2f ppm\n", readings.hydrogenSulfide);

    // TODO: Send to backend via HTTP/MQTT
    // sendToBackend(readings);
  } else {
    Serial.println("⚠️  Invalid sensor readings!");
  }

  delay(5000);  // Read every 5 seconds
}

// ============================================================================
// NOTES & IMPORTANT INFORMATION
// ============================================================================

/*
 * CALIBRATION IS CRITICAL!
 * ========================
 * MQ sensors MUST be calibrated in clean air before use.
 * Without calibration, PPM values will be inaccurate.
 *
 * Calibration Process:
 * 1. Place sensors outdoors or in well-ventilated clean area
 * 2. Power on and wait 24-48 hours (pre-heating period)
 * 3. Run calibrateSensors() function
 * 4. Note the R0 values printed
 * 5. Update R0 constants in code
 *
 *
 * SENSOR WARM-UP TIME:
 * ====================
 * - MQ sensors require 24-48 hours of initial warm-up
 * - After power-on, wait at least 3 minutes before reading
 * - Keep sensors powered continuously for best accuracy
 *
 *
 * PPM CONVERSION ACCURACY:
 * ========================
 * - MQ sensors have ±10-20% accuracy (typical)
 * - Affected by temperature and humidity
 * - Cross-sensitivity to other gases exists
 * - Professional gas analyzers are more accurate but expensive
 *
 *
 * DATASHEET REFERENCES:
 * =====================
 * - MQ-4:  https://www.pololu.com/file/0J309/MQ4.pdf
 * - MQ-6:  https://www.pololu.com/file/0J310/MQ6.pdf
 * - MQ-7:  https://www.pololu.com/file/0J311/MQ7.pdf
 * - MQ-136: https://www.olimex.com/Products/Components/Sensors/MQ-136/resources/MQ-136.pdf
 *
 *
 * ALTERNATIVE: Use Pre-Calibrated Digital Sensors
 * ================================================
 * If you need higher accuracy, consider:
 * - SGP30 (TVOC and eCO2)
 * - CCS811 (eCO2 and TVOC)
 * - MH-Z19 (CO2 with UART output)
 * - Alphasense sensors (professional grade, expensive)
 */
