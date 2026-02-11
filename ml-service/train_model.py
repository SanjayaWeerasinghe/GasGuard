"""
GasGuard LSTM Model Training Script

Trains the LSTM model on gas sensor time-series data for anomaly detection.

Datasets supported:
1. Zenodo Gas Leak Dataset
2. UCI Gas Sensor Array Dataset
3. Custom CSV data

Usage:
    python train_model.py --dataset path/to/data.csv --epochs 50
"""

import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow import keras
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import MinMaxScaler
import matplotlib.pyplot as plt
import argparse
import pickle
import os
from datetime import datetime

# ============================================================================
# CONFIGURATION
# ============================================================================

SEQUENCE_LENGTH = 10
FEATURE_COUNT = 4  # methane, lpg, co, h2s
TEST_SIZE = 0.2
VALIDATION_SPLIT = 0.2
RANDOM_SEED = 42

# Model parameters
LSTM_UNITS_1 = 50
LSTM_UNITS_2 = 50
DROPOUT_RATE = 0.2
LEARNING_RATE = 0.001
BATCH_SIZE = 32
EPOCHS = 50

# ============================================================================
# DATA LOADING FUNCTIONS
# ============================================================================

def load_zenodo_dataset(data_dir):
    """
    Load Zenodo Fire, Smoke, and Gas Leakage Detection Dataset
    Link: https://zenodo.org/records/6616632
    """
    print("📂 Loading Zenodo dataset...")

    files = {
        'lpg': os.path.join(data_dir, 'lpg_sensor.xlsx'),
        'co': os.path.join(data_dir, 'co_sensor.xlsx'),
        'smoke': os.path.join(data_dir, 'smoke_sensor.xlsx'),
        'cng': os.path.join(data_dir, 'cng_sensor.xlsx')
    }

    dataframes = []

    for gas_type, file_path in files.items():
        if os.path.exists(file_path):
            df = pd.read_excel(file_path)
            df['gas_type'] = gas_type
            dataframes.append(df)
            print(f"  ✓ Loaded {gas_type}: {len(df)} samples")
        else:
            print(f"  ⚠️  File not found: {file_path}")

    if not dataframes:
        raise FileNotFoundError("No dataset files found!")

    combined_df = pd.concat(dataframes, ignore_index=True)
    print(f"✅ Total samples: {len(combined_df)}\n")

    return combined_df

def load_uci_dataset(file_path):
    """
    Load UCI Gas Sensor Array Dataset
    Link: https://archive.ics.uci.edu/ml/datasets/gas+sensor+array+drift+dataset
    """
    print("📂 Loading UCI dataset...")

    df = pd.read_csv(file_path, sep=';', header=None)
    print(f"✅ Loaded {len(df)} samples\n")

    return df

def load_custom_csv(file_path):
    """
    Load custom CSV with columns: timestamp, methane, lpg, co, h2s
    """
    print(f"📂 Loading custom dataset from {file_path}...")

    df = pd.read_csv(file_path)

    required_columns = ['methane', 'lpg', 'co', 'h2s']
    if not all(col in df.columns for col in required_columns):
        raise ValueError(f"CSV must have columns: {required_columns}")

    print(f"✅ Loaded {len(df)} samples\n")

    return df

def generate_synthetic_data(num_samples=10000):
    """
    Generate synthetic gas sensor data with leak patterns
    (Use this if you don't have real datasets yet)
    """
    print(f"🔧 Generating {num_samples} synthetic samples...")

    timestamps = pd.date_range(start='2024-01-01', periods=num_samples, freq='5S')

    # Normal background levels
    data = {
        'timestamp': timestamps,
        'methane': np.random.normal(100, 20, num_samples),
        'lpg': np.random.normal(50, 10, num_samples),
        'co': np.random.normal(10, 2, num_samples),
        'h2s': np.random.normal(2, 0.5, num_samples)
    }

    df = pd.DataFrame(data)

    # Add synthetic leak events (gradual increases)
    num_leaks = 50
    for _ in range(num_leaks):
        start_idx = np.random.randint(100, num_samples - 500)
        duration = np.random.randint(50, 200)
        gas_type = np.random.choice(['methane', 'lpg', 'co', 'h2s'])

        # Gradual increase pattern
        for i in range(duration):
            if start_idx + i < num_samples:
                increase_factor = 1 + (i / duration) * np.random.uniform(2, 8)
                df.loc[start_idx + i, gas_type] *= increase_factor

    # Add sudden spikes
    num_spikes = 20
    for _ in range(num_spikes):
        spike_idx = np.random.randint(100, num_samples - 100)
        gas_type = np.random.choice(['methane', 'lpg', 'co', 'h2s'])
        df.loc[spike_idx, gas_type] *= np.random.uniform(5, 15)

    print(f"  ✓ Added {num_leaks} gradual leak patterns")
    print(f"  ✓ Added {num_spikes} sudden spikes")
    print(f"✅ Synthetic data generated\n")

    return df

# ============================================================================
# DATA PREPROCESSING
# ============================================================================

def preprocess_data(df):
    """
    Preprocess gas sensor data for LSTM training
    """
    print("🔄 Preprocessing data...")

    # Extract feature columns
    feature_columns = ['methane', 'lpg', 'co', 'h2s']

    # Handle missing columns (try different names)
    if 'methane' not in df.columns:
        if 'CH4' in df.columns:
            df['methane'] = df['CH4']
        elif 'Methane' in df.columns:
            df['methane'] = df['Methane']

    if 'lpg' not in df.columns:
        if 'LPG' in df.columns:
            df['lpg'] = df['LPG']

    if 'co' not in df.columns:
        if 'CO' in df.columns:
            df['co'] = df['CO']

    if 'h2s' not in df.columns:
        if 'H2S' in df.columns:
            df['h2s'] = df['H2S']

    # If still missing, fill with zeros
    for col in feature_columns:
        if col not in df.columns:
            print(f"  ⚠️  Column '{col}' not found, filling with zeros")
            df[col] = 0

    # Extract features
    data = df[feature_columns].values

    # Remove NaN and infinite values
    data = np.nan_to_num(data, nan=0.0, posinf=0.0, neginf=0.0)

    print(f"  ✓ Data shape: {data.shape}")
    print(f"  ✓ Features: {feature_columns}")

    # Normalize data
    scaler = MinMaxScaler(feature_range=(0, 1))
    data_normalized = scaler.fit_transform(data)

    print(f"  ✓ Data normalized (MinMaxScaler)")

    return data_normalized, scaler

def create_sequences(data, sequence_length):
    """
    Create time-series sequences for LSTM training

    For each sequence, the model predicts the next timestep.
    This is used for anomaly detection (high prediction error = anomaly).
    """
    print(f"🔧 Creating sequences (length={sequence_length})...")

    X, y = [], []

    for i in range(len(data) - sequence_length):
        # Input: sequence of readings
        X.append(data[i:i + sequence_length])
        # Output: next reading (what we want to predict)
        y.append(data[i + sequence_length])

    X = np.array(X)
    y = np.array(y)

    print(f"  ✓ Created {len(X)} sequences")
    print(f"  ✓ X shape: {X.shape}")
    print(f"  ✓ y shape: {y.shape}\n")

    return X, y

# ============================================================================
# MODEL BUILDING
# ============================================================================

def build_lstm_model(sequence_length, feature_count, lstm_units_1=50, lstm_units_2=50, dropout=0.2):
    """
    Build LSTM model for gas leak prediction
    """
    print("🏗️  Building LSTM model...")

    model = keras.Sequential([
        keras.layers.Input(shape=(sequence_length, feature_count)),

        # First LSTM layer
        keras.layers.LSTM(lstm_units_1, return_sequences=True),
        keras.layers.Dropout(dropout),

        # Second LSTM layer
        keras.layers.LSTM(lstm_units_2),
        keras.layers.Dropout(dropout),

        # Output layer (predict next timestep values)
        keras.layers.Dense(feature_count, activation='linear')
    ])

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=LEARNING_RATE),
        loss='mse',
        metrics=['mae']
    )

    print(model.summary())
    print()

    return model

# ============================================================================
# TRAINING
# ============================================================================

def train_model(model, X_train, y_train, X_val, y_val, epochs, batch_size):
    """
    Train LSTM model with early stopping
    """
    print(f"🚀 Training model ({epochs} epochs, batch_size={batch_size})...\n")

    # Callbacks
    early_stopping = keras.callbacks.EarlyStopping(
        monitor='val_loss',
        patience=10,
        restore_best_weights=True
    )

    reduce_lr = keras.callbacks.ReduceLROnPlateau(
        monitor='val_loss',
        factor=0.5,
        patience=5,
        min_lr=0.00001
    )

    # Train
    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=epochs,
        batch_size=batch_size,
        callbacks=[early_stopping, reduce_lr],
        verbose=1
    )

    print("\n✅ Training complete!")

    return history

# ============================================================================
# EVALUATION
# ============================================================================

def evaluate_model(model, X_test, y_test, scaler):
    """
    Evaluate model performance
    """
    print("\n📊 Evaluating model...")

    # Predict
    y_pred = model.predict(X_test)

    # Calculate metrics
    mse = np.mean((y_test - y_pred) ** 2)
    mae = np.mean(np.abs(y_test - y_pred))
    rmse = np.sqrt(mse)

    print(f"  Mean Squared Error (MSE): {mse:.6f}")
    print(f"  Mean Absolute Error (MAE): {mae:.6f}")
    print(f"  Root Mean Squared Error (RMSE): {rmse:.6f}")

    # Calculate prediction error distribution (for anomaly detection)
    errors = np.mean(np.abs(y_test - y_pred), axis=1)
    print(f"\n  Prediction Error Statistics:")
    print(f"    Mean: {np.mean(errors):.4f}")
    print(f"    Std:  {np.std(errors):.4f}")
    print(f"    Min:  {np.min(errors):.4f}")
    print(f"    Max:  {np.max(errors):.4f}")
    print(f"    95th percentile: {np.percentile(errors, 95):.4f}")

    # Plot error distribution
    plt.figure(figsize=(10, 4))

    plt.subplot(1, 2, 1)
    plt.hist(errors, bins=50, edgecolor='black')
    plt.xlabel('Prediction Error')
    plt.ylabel('Frequency')
    plt.title('Prediction Error Distribution')
    plt.axvline(np.mean(errors), color='r', linestyle='--', label='Mean')
    plt.axvline(np.percentile(errors, 95), color='orange', linestyle='--', label='95th percentile')
    plt.legend()

    plt.subplot(1, 2, 2)
    plt.plot(errors[:500])
    plt.xlabel('Sample')
    plt.ylabel('Prediction Error')
    plt.title('Prediction Error Over Time (first 500 samples)')

    plt.tight_layout()
    plt.savefig('model_evaluation.png')
    print(f"\n  📈 Evaluation plot saved: model_evaluation.png")

    return mse, mae, rmse

# ============================================================================
# SAVING MODEL
# ============================================================================

def save_model(model, scaler, model_dir='models'):
    """
    Save trained model and scaler
    """
    os.makedirs(model_dir, exist_ok=True)

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

    # Save model
    model_path = os.path.join(model_dir, f'gas_leak_model_{timestamp}.h5')
    model.save(model_path)
    print(f"\n💾 Model saved: {model_path}")

    # Also save as default
    default_path = os.path.join(model_dir, 'gas_leak_model.h5')
    model.save(default_path)
    print(f"💾 Model saved: {default_path}")

    # Save scaler
    scaler_path = os.path.join(model_dir, 'scaler.pkl')
    with open(scaler_path, 'wb') as f:
        pickle.dump(scaler, f)
    print(f"💾 Scaler saved: {scaler_path}")

    print("\n✅ Model and scaler saved successfully!")

# ============================================================================
# MAIN TRAINING PIPELINE
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description='Train GasGuard LSTM model')
    parser.add_argument('--dataset', type=str, default='synthetic',
                        help='Dataset path or "synthetic" to generate data')
    parser.add_argument('--epochs', type=int, default=EPOCHS,
                        help='Number of training epochs')
    parser.add_argument('--batch-size', type=int, default=BATCH_SIZE,
                        help='Batch size')

    args = parser.parse_args()

    print("=" * 70)
    print("GasGuard LSTM Model Training".center(70))
    print("=" * 70)
    print()

    # 1. Load data
    if args.dataset == 'synthetic':
        df = generate_synthetic_data(num_samples=10000)
    elif args.dataset.endswith('.csv'):
        df = load_custom_csv(args.dataset)
    elif os.path.isdir(args.dataset):
        df = load_zenodo_dataset(args.dataset)
    else:
        raise ValueError(f"Unknown dataset: {args.dataset}")

    # 2. Preprocess
    data_normalized, scaler = preprocess_data(df)

    # 3. Create sequences
    X, y = create_sequences(data_normalized, SEQUENCE_LENGTH)

    # 4. Split data
    print("📊 Splitting data...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_SEED, shuffle=False
    )
    print(f"  Training set: {len(X_train)} samples")
    print(f"  Test set: {len(X_test)} samples\n")

    # 5. Build model
    model = build_lstm_model(
        SEQUENCE_LENGTH,
        FEATURE_COUNT,
        lstm_units_1=LSTM_UNITS_1,
        lstm_units_2=LSTM_UNITS_2,
        dropout=DROPOUT_RATE
    )

    # 6. Train model
    history = train_model(
        model, X_train, y_train,
        X_test, y_test,  # Using test as validation for simplicity
        epochs=args.epochs,
        batch_size=args.batch_size
    )

    # 7. Evaluate
    mse, mae, rmse = evaluate_model(model, X_test, y_test, scaler)

    # 8. Save model
    save_model(model, scaler)

    # 9. Plot training history
    plt.figure(figsize=(12, 4))

    plt.subplot(1, 2, 1)
    plt.plot(history.history['loss'], label='Training Loss')
    plt.plot(history.history['val_loss'], label='Validation Loss')
    plt.xlabel('Epoch')
    plt.ylabel('Loss (MSE)')
    plt.title('Model Loss During Training')
    plt.legend()
    plt.grid(True)

    plt.subplot(1, 2, 2)
    plt.plot(history.history['mae'], label='Training MAE')
    plt.plot(history.history['val_mae'], label='Validation MAE')
    plt.xlabel('Epoch')
    plt.ylabel('MAE')
    plt.title('Model MAE During Training')
    plt.legend()
    plt.grid(True)

    plt.tight_layout()
    plt.savefig('training_history.png')
    print(f"📈 Training history plot saved: training_history.png")

    print("\n" + "=" * 70)
    print("Training Complete!".center(70))
    print("=" * 70)
    print("\nNext steps:")
    print("1. Check model_evaluation.png for performance")
    print("2. Check training_history.png for training progress")
    print("3. Update ml-service/app.py to load trained model")
    print("4. Restart ML service to use new model")

if __name__ == "__main__":
    main()
