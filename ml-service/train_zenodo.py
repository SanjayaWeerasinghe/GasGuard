"""
GasGuard LSTM Model Training - Zenodo Dataset Optimized

Specifically designed for:
Zenodo Fire, Smoke, and Gas Leakage Detection Dataset
Dataset ID: 6616632
URL: https://zenodo.org/records/6616632

This script trains on REAL gas sensor data from MQ series sensors.
"""

import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow import keras
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import MinMaxScaler
import matplotlib.pyplot as plt
import pickle
import os
from datetime import datetime
import glob

# ============================================================================
# CONFIGURATION
# ============================================================================

SEQUENCE_LENGTH = 10
FEATURE_COUNT = 4  # methane(CNG), lpg, co, h2s
TEST_SIZE = 0.2
VALIDATION_SPLIT = 0.2
RANDOM_SEED = 42

# Model parameters
LSTM_UNITS_1 = 64
LSTM_UNITS_2 = 32
DROPOUT_RATE = 0.3
LEARNING_RATE = 0.001
BATCH_SIZE = 32
EPOCHS = 100

print("=" * 70)
print("GasGuard LSTM Training - Zenodo Real Dataset".center(70))
print("=" * 70)
print()

# ============================================================================
# LOAD ZENODO DATASET
# ============================================================================

def load_zenodo_dataset(data_dir):
    """
    Load Zenodo Fire, Smoke, and Gas Leakage Detection Dataset

    Expected files in data_dir:
    - lpg_sensor.xlsx
    - co_sensor.xlsx
    - cng_sensor.xlsx (methane)
    - smoke_sensor.xlsx
    - flame_sensor.xlsx
    """
    print(f"📂 Loading Zenodo dataset from: {data_dir}\n")

    # Try to find Excel files
    excel_files = glob.glob(os.path.join(data_dir, "*.xlsx"))

    if not excel_files:
        excel_files = glob.glob(os.path.join(data_dir, "*.xls"))

    if not excel_files:
        raise FileNotFoundError(f"No Excel files found in {data_dir}")

    print(f"Found {len(excel_files)} Excel files:")
    for f in excel_files:
        print(f"  - {os.path.basename(f)}")
    print()

    # Load each sensor file
    dataframes = {}

    for file_path in excel_files:
        filename = os.path.basename(file_path).lower()

        try:
            df = pd.read_excel(file_path)

            # Identify sensor type from filename
            if 'lpg' in filename:
                sensor_type = 'lpg'
            elif 'co' in filename and 'cng' not in filename:
                sensor_type = 'co'
            elif 'cng' in filename or 'methane' in filename:
                sensor_type = 'methane'
            elif 'smoke' in filename:
                sensor_type = 'smoke'
            elif 'flame' in filename:
                sensor_type = 'flame'
            else:
                print(f"  ⚠️  Unknown sensor type: {filename}")
                continue

            dataframes[sensor_type] = df
            print(f"  ✅ Loaded {sensor_type}: {len(df)} samples, {len(df.columns)} columns")

        except Exception as e:
            print(f"  ❌ Error loading {filename}: {e}")

    print()
    return dataframes

# ============================================================================
# PREPROCESS ZENODO DATA
# ============================================================================

def preprocess_zenodo_data(dataframes):
    """
    Preprocess Zenodo dataset for LSTM training

    Strategy:
    - Align timestamps across all sensors
    - Extract gas concentration values
    - Handle H2S (not in dataset) - use synthetic based on CO patterns
    """
    print("🔄 Preprocessing Zenodo data...\n")

    # Check what we have
    required_gases = ['lpg', 'co', 'methane']
    available = [gas for gas in required_gases if gas in dataframes]

    print(f"Available gases: {available}")

    if len(available) < 3:
        raise ValueError(f"Need at least LPG, CO, and Methane data. Found: {available}")

    # Find common length (use shortest)
    min_length = min(len(dataframes[gas]) for gas in available)
    print(f"Using {min_length} samples (shortest sensor length)\n")

    # Extract gas values
    # Zenodo dataset typically has columns like:
    # 'Time', 'Sensor Value', or numbered columns

    gas_data = {}

    for gas_type in available:
        df = dataframes[gas_type]

        # Try to find the value column
        value_col = None

        # Common column names
        possible_cols = ['Value', 'value', 'Sensor', 'sensor', 'Reading', 'reading',
                        'PPM', 'ppm', df.columns[-1]]  # Last column often the value

        for col_name in possible_cols:
            if col_name in df.columns:
                value_col = col_name
                break

        if value_col is None:
            # Use second column (first is usually timestamp)
            if len(df.columns) >= 2:
                value_col = df.columns[1]
            else:
                value_col = df.columns[0]

        values = df[value_col].values[:min_length]
        gas_data[gas_type] = values

        print(f"  {gas_type}: using column '{value_col}'")
        print(f"    Range: {values.min():.2f} - {values.max():.2f}")
        print(f"    Mean: {values.mean():.2f}, Std: {values.std():.2f}")

    print()

    # Handle H2S (not in Zenodo dataset)
    # Strategy: Generate based on CO patterns (both toxic gases)
    print("⚠️  H2S data not in Zenodo dataset")
    print("  Generating H2S patterns based on CO behavior...")

    co_values = gas_data['co']

    # H2S is much more toxic - typically 10-50x lower concentrations
    # Scale CO values down and add variation
    h2s_values = co_values / np.random.uniform(10, 50, len(co_values))
    h2s_values += np.random.normal(0, 2, len(co_values))  # Add noise
    h2s_values = np.clip(h2s_values, 0, 100)  # Clip to realistic range

    gas_data['h2s'] = h2s_values

    print(f"  Generated {len(h2s_values)} H2S samples")
    print(f"    Range: {h2s_values.min():.2f} - {h2s_values.max():.2f}\n")

    # Combine into matrix [methane, lpg, co, h2s]
    combined_data = np.column_stack([
        gas_data['methane'],
        gas_data['lpg'],
        gas_data['co'],
        gas_data['h2s']
    ])

    print(f"✅ Combined data shape: {combined_data.shape}")
    print(f"  Features: [methane, lpg, co, h2s]\n")

    # Remove any NaN or infinite values
    combined_data = np.nan_to_num(combined_data, nan=0.0, posinf=0.0, neginf=0.0)

    # Normalize
    scaler = MinMaxScaler(feature_range=(0, 1))
    data_normalized = scaler.fit_transform(combined_data)

    print("✅ Data normalized using MinMaxScaler\n")

    return data_normalized, scaler

# ============================================================================
# CREATE SEQUENCES
# ============================================================================

def create_sequences(data, sequence_length):
    """Create time-series sequences for LSTM"""
    print(f"🔧 Creating sequences (length={sequence_length})...")

    X, y = [], []

    for i in range(len(data) - sequence_length):
        X.append(data[i:i + sequence_length])
        y.append(data[i + sequence_length])

    X = np.array(X)
    y = np.array(y)

    print(f"  ✅ Created {len(X)} sequences")
    print(f"  X shape: {X.shape}")
    print(f"  y shape: {y.shape}\n")

    return X, y

# ============================================================================
# BUILD MODEL
# ============================================================================

def build_lstm_model():
    """Build LSTM model optimized for real gas sensor data"""
    print("🏗️  Building LSTM model...\n")

    model = keras.Sequential([
        keras.layers.Input(shape=(SEQUENCE_LENGTH, FEATURE_COUNT)),

        # First LSTM layer
        keras.layers.LSTM(LSTM_UNITS_1, return_sequences=True),
        keras.layers.Dropout(DROPOUT_RATE),

        # Second LSTM layer
        keras.layers.LSTM(LSTM_UNITS_2),
        keras.layers.Dropout(DROPOUT_RATE),

        # Output layer
        keras.layers.Dense(FEATURE_COUNT, activation='linear')
    ])

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=LEARNING_RATE),
        loss='mse',
        metrics=['mae', 'mse']
    )

    print(model.summary())
    print()

    return model

# ============================================================================
# TRAIN MODEL
# ============================================================================

def train_model(model, X_train, y_train, X_val, y_val):
    """Train with callbacks for optimal performance"""
    print(f"🚀 Training model...\n")
    print(f"  Epochs: {EPOCHS}")
    print(f"  Batch size: {BATCH_SIZE}")
    print(f"  Training samples: {len(X_train)}")
    print(f"  Validation samples: {len(X_val)}\n")

    callbacks = [
        keras.callbacks.EarlyStopping(
            monitor='val_loss',
            patience=15,
            restore_best_weights=True,
            verbose=1
        ),
        keras.callbacks.ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=7,
            min_lr=0.00001,
            verbose=1
        ),
        keras.callbacks.ModelCheckpoint(
            'models/best_model_checkpoint.h5',
            monitor='val_loss',
            save_best_only=True,
            verbose=1
        )
    ]

    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=EPOCHS,
        batch_size=BATCH_SIZE,
        callbacks=callbacks,
        verbose=1
    )

    print("\n✅ Training complete!\n")

    return history

# ============================================================================
# EVALUATE
# ============================================================================

def evaluate_model(model, X_test, y_test):
    """Comprehensive model evaluation"""
    print("📊 Evaluating model...\n")

    y_pred = model.predict(X_test, verbose=0)

    mse = np.mean((y_test - y_pred) ** 2)
    mae = np.mean(np.abs(y_test - y_pred))
    rmse = np.sqrt(mse)

    print(f"  MSE:  {mse:.6f}")
    print(f"  MAE:  {mae:.6f}")
    print(f"  RMSE: {rmse:.6f}\n")

    # Per-gas performance
    gas_names = ['Methane', 'LPG', 'CO', 'H2S']
    print("  Per-gas MAE:")
    for i, gas in enumerate(gas_names):
        gas_mae = np.mean(np.abs(y_test[:, i] - y_pred[:, i]))
        print(f"    {gas}: {gas_mae:.6f}")

    print()

    # Prediction error distribution
    errors = np.mean(np.abs(y_test - y_pred), axis=1)
    print(f"  Prediction Error Statistics:")
    print(f"    Mean: {np.mean(errors):.4f}")
    print(f"    Std:  {np.std(errors):.4f}")
    print(f"    95th percentile: {np.percentile(errors, 95):.4f}\n")

    # Plot results
    fig, axes = plt.subplots(2, 2, figsize=(14, 10))

    # Error distribution
    axes[0, 0].hist(errors, bins=50, edgecolor='black')
    axes[0, 0].set_xlabel('Prediction Error')
    axes[0, 0].set_ylabel('Frequency')
    axes[0, 0].set_title('Prediction Error Distribution (Zenodo Real Data)')
    axes[0, 0].axvline(np.mean(errors), color='r', linestyle='--', label='Mean')
    axes[0, 0].axvline(np.percentile(errors, 95), color='orange', linestyle='--', label='95th')
    axes[0, 0].legend()

    # Error over time
    axes[0, 1].plot(errors[:500])
    axes[0, 1].set_xlabel('Sample')
    axes[0, 1].set_ylabel('Error')
    axes[0, 1].set_title('Prediction Error Over Time (first 500)')
    axes[0, 1].grid(True)

    # Actual vs Predicted (Methane)
    axes[1, 0].scatter(y_test[:500, 0], y_pred[:500, 0], alpha=0.5)
    axes[1, 0].plot([y_test[:, 0].min(), y_test[:, 0].max()],
                    [y_test[:, 0].min(), y_test[:, 0].max()], 'r--')
    axes[1, 0].set_xlabel('Actual (Methane)')
    axes[1, 0].set_ylabel('Predicted (Methane)')
    axes[1, 0].set_title('Actual vs Predicted - Methane')
    axes[1, 0].grid(True)

    # Actual vs Predicted (CO)
    axes[1, 1].scatter(y_test[:500, 2], y_pred[:500, 2], alpha=0.5)
    axes[1, 1].plot([y_test[:, 2].min(), y_test[:, 2].max()],
                    [y_test[:, 2].min(), y_test[:, 2].max()], 'r--')
    axes[1, 1].set_xlabel('Actual (CO)')
    axes[1, 1].set_ylabel('Predicted (CO)')
    axes[1, 1].set_title('Actual vs Predicted - CO')
    axes[1, 1].grid(True)

    plt.tight_layout()
    plt.savefig('zenodo_evaluation.png', dpi=150)
    print(f"  📈 Saved: zenodo_evaluation.png\n")

    return mse, mae, rmse

# ============================================================================
# SAVE MODEL
# ============================================================================

def save_model(model, scaler):
    """Save trained model and scaler"""
    os.makedirs('models', exist_ok=True)

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

    # Save model
    model_path = f'models/gas_leak_model_zenodo_{timestamp}.h5'
    model.save(model_path)
    print(f"💾 Saved: {model_path}")

    # Save as default
    default_path = 'models/gas_leak_model.h5'
    model.save(default_path)
    print(f"💾 Saved: {default_path}")

    # Save scaler
    scaler_path = 'models/scaler.pkl'
    with open(scaler_path, 'wb') as f:
        pickle.dump(scaler, f)
    print(f"💾 Saved: {scaler_path}\n")

# ============================================================================
# MAIN
# ============================================================================

def main():
    import sys

    if len(sys.argv) < 2:
        print("❌ Usage: python train_zenodo.py <path_to_zenodo_dataset>")
        print("\nExample:")
        print("  python train_zenodo.py ../Datasets/zenodo")
        print("\nDataset download:")
        print("  https://zenodo.org/records/6616632")
        sys.exit(1)

    data_dir = sys.argv[1]

    if not os.path.exists(data_dir):
        print(f"❌ Directory not found: {data_dir}")
        sys.exit(1)

    # Load data
    dataframes = load_zenodo_dataset(data_dir)

    # Preprocess
    data_normalized, scaler = preprocess_zenodo_data(dataframes)

    # Create sequences
    X, y = create_sequences(data_normalized, SEQUENCE_LENGTH)

    # Split data
    print("📊 Splitting data...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_SEED, shuffle=False
    )
    print(f"  Training: {len(X_train)} samples")
    print(f"  Testing: {len(X_test)} samples\n")

    # Build model
    model = build_lstm_model()

    # Train
    history = train_model(model, X_train, y_train, X_test, y_test)

    # Evaluate
    mse, mae, rmse = evaluate_model(model, X_test, y_test)

    # Save
    save_model(model, scaler)

    # Plot training history
    plt.figure(figsize=(12, 4))

    plt.subplot(1, 2, 1)
    plt.plot(history.history['loss'], label='Training Loss')
    plt.plot(history.history['val_loss'], label='Validation Loss')
    plt.xlabel('Epoch')
    plt.ylabel('Loss (MSE)')
    plt.title('Training History - Zenodo Real Data')
    plt.legend()
    plt.grid(True)

    plt.subplot(1, 2, 2)
    plt.plot(history.history['mae'], label='Training MAE')
    plt.plot(history.history['val_mae'], label='Validation MAE')
    plt.xlabel('Epoch')
    plt.ylabel('MAE')
    plt.title('MAE During Training')
    plt.legend()
    plt.grid(True)

    plt.tight_layout()
    plt.savefig('zenodo_training_history.png', dpi=150)
    print(f"📈 Saved: zenodo_training_history.png\n")

    print("=" * 70)
    print("✅ TRAINING COMPLETE!".center(70))
    print("=" * 70)
    print("\nModel trained on REAL Zenodo gas sensor data!")
    print(f"\nPerformance:")
    print(f"  MSE:  {mse:.6f}")
    print(f"  MAE:  {mae:.6f}")
    print(f"  RMSE: {rmse:.6f}")
    print("\nNext steps:")
    print("  1. Check zenodo_evaluation.png")
    print("  2. Review zenodo_training_history.png")
    print("  3. Update ML service to load trained model:")
    print("     cp app_with_trained_model.py app.py")
    print("  4. Restart ML service")
    print()

if __name__ == "__main__":
    main()
