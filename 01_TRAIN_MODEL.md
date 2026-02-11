# 🎓 Step 1: Train Your LSTM Model

**Estimated Time:** 30 minutes

This guide will train your LSTM neural network on **REAL Zenodo gas sensor data**.

---

## ✅ Prerequisites

Before starting, verify:

- [ ] Zenodo dataset downloaded
- [ ] Files in `D:\AAA\Final Submission\Datasets\zenodo\`
- [ ] Python 3.8+ installed (`python --version`)
- [ ] Internet connection (for package downloads)

---

## 📦 Part 1: Install Dependencies (5 minutes)

### **Open Terminal/Command Prompt:**

```bash
cd "D:\AAA\Final Submission\GasGuard\ml-service"
```

### **Install Required Packages:**

```bash
pip install tensorflow numpy pandas scikit-learn matplotlib openpyxl
```

**What's being installed:**
- `tensorflow` - For LSTM neural network
- `numpy` - For numerical operations
- `pandas` - For data processing
- `scikit-learn` - For data normalization
- `matplotlib` - For plotting results
- `openpyxl` - For reading Excel files

**Expected output:**
```
Collecting tensorflow...
Successfully installed tensorflow-2.x.x numpy-1.x.x pandas-2.x.x ...
```

### **Verify Installation:**

```bash
python -c "import tensorflow; print(tensorflow.__version__)"
```

**Should output:** `2.x.x` (any 2.x version is fine)

✅ **Checkpoint:** Packages installed successfully

---

## 🧠 Part 2: Train the Model (20 minutes)

### **Run Training Script:**

```bash
python train_zenodo.py "D:\AAA\Final Submission\Datasets\zenodo"
```

**Alternative if path has issues:**
```bash
python train_zenodo.py ..\Datasets\zenodo
```

### **What You'll See:**

**Phase 1: Loading Data**
```
======================================================================
        GasGuard LSTM Training - Zenodo Real Dataset
======================================================================

📂 Loading Zenodo dataset from: D:\AAA\Final Submission\Datasets\zenodo

Found 3 Excel files:
  - cng_sensor.xlsx
  - co_sensor.xlsx
  - lpg_sensor.xlsx

  ✅ Loaded lpg: 5000 samples, 2 columns
  ✅ Loaded co: 5000 samples, 2 columns
  ✅ Loaded methane: 5000 samples, 2 columns
```

**Phase 2: Preprocessing**
```
🔄 Preprocessing Zenodo data...

Available gases: ['lpg', 'co', 'methane']
Using 5000 samples (shortest sensor length)

  lpg: using column 'Value'
    Range: 0.00 - 1024.00
    Mean: 512.34, Std: 156.78

  co: using column 'Value'
    Range: 0.00 - 1024.00
    Mean: 487.23, Std: 142.56

  methane: using column 'Value'
    Range: 0.00 - 1024.00
    Mean: 498.76, Std: 151.23

⚠️  H2S data not in Zenodo dataset
  Generating H2S patterns based on CO behavior...
  Generated 5000 H2S samples
    Range: 0.12 - 45.67

✅ Combined data shape: (5000, 4)
  Features: [methane, lpg, co, h2s]

✅ Data normalized using MinMaxScaler
```

**Phase 3: Model Building**
```
🏗️  Building LSTM model...

Model: "sequential"
_________________________________________________________________
Layer (type)                 Output Shape              Param #
=================================================================
lstm (LSTM)                  (None, 10, 64)            17664
dropout (Dropout)            (None, 10, 64)            0
lstm_1 (LSTM)                (None, 32)                12416
dropout_1 (Dropout)          (None, 32)                0
dense (Dense)                (None, 4)                 132
=================================================================
Total params: 30,212
Trainable params: 30,212
Non-trainable params: 0
```

**Phase 4: Training** (This takes 10-15 minutes)
```
🚀 Training model...

  Epochs: 100
  Batch size: 32
  Training samples: 3992
  Validation samples: 998

Epoch 1/100
125/125 ━━━━━━━━━━━━━━━━━━━━ 15s 95ms/step - loss: 0.0452 - mae: 0.1567 - val_loss: 0.0234 - val_mae: 0.1123
Epoch 2/100
125/125 ━━━━━━━━━━━━━━━━━━━━ 12s 89ms/step - loss: 0.0198 - mae: 0.1034 - val_loss: 0.0145 - val_mae: 0.0891
Epoch 3/100
125/125 ━━━━━━━━━━━━━━━━━━━━ 11s 87ms/step - loss: 0.0134 - mae: 0.0856 - val_loss: 0.0098 - val_mae: 0.0723
...

[Early stopping may activate around Epoch 40-60]

Epoch 45/100
125/125 ━━━━━━━━━━━━━━━━━━━━ 11s 88ms/step - loss: 0.0012 - mae: 0.0234 - val_loss: 0.0015 - val_mae: 0.0289

Restoring model weights from the end of the best epoch: 35.

✅ Training complete!
```

**Phase 5: Evaluation**
```
📊 Evaluating model...

  MSE:  0.001456
  MAE:  0.028934
  RMSE: 0.038157

  Per-gas MAE:
    Methane: 0.025678
    LPG: 0.029456
    CO: 0.031234
    H2S: 0.029367

  Prediction Error Statistics:
    Mean: 0.0289
    Std:  0.0156
    95th percentile: 0.0567

  📈 Saved: zenodo_evaluation.png
```

**Phase 6: Saving**
```
💾 Saved: models/gas_leak_model_zenodo_20260204_143022.h5
💾 Saved: models/gas_leak_model.h5
💾 Saved: models/scaler.pkl

📈 Saved: zenodo_training_history.png

======================================================================
                    ✅ TRAINING COMPLETE!
======================================================================

Model trained on REAL Zenodo gas sensor data!

Performance:
  MSE:  0.001456
  MAE:  0.028934
  RMSE: 0.038157

Next steps:
  1. Check zenodo_evaluation.png
  2. Review zenodo_training_history.png
  3. Update ML service to load trained model:
     cp app_with_trained_model.py app.py
  4. Restart ML service
```

✅ **Checkpoint:** Training completed successfully

---

## 📊 Part 3: Verify Model Quality (5 minutes)

### **Check Files Created:**

```bash
# Check model files
dir models
```

**You should see:**
```
gas_leak_model.h5              (2-5 MB)
scaler.pkl                      (few KB)
best_model_checkpoint.h5        (2-5 MB)
```

✅ All files present

### **Check Performance Plots:**

```bash
# Check plot files
dir *.png
```

**You should see:**
```
zenodo_evaluation.png
zenodo_training_history.png
```

### **Open `zenodo_evaluation.png`:**

**What to look for:**
- ✅ Prediction error distribution mostly < 0.1
- ✅ Actual vs Predicted points close to diagonal line
- ✅ No obvious outliers or bad predictions

**Good performance indicators:**
- Most errors in NORMAL range (< 0.15)
- 95th percentile < 0.5
- Actual vs Predicted R² > 0.8

### **Open `zenodo_training_history.png`:**

**What to look for:**
- ✅ Training loss (blue) decreases over time
- ✅ Validation loss (orange) decreases and converges
- ✅ No huge gap between training and validation (no overfitting)
- ✅ MAE decreases steadily

**Good training indicators:**
- Final loss < 0.01
- Training and validation curves close together
- Smooth decrease (not erratic)

✅ **Checkpoint:** Performance looks good

---

## 📝 Part 4: Record Metrics (2 minutes)

**Copy these values from training output:**

### **Dataset Statistics:**
```
Total samples: _______
Training samples: _______
Test samples: _______
```

### **Model Performance:**
```
MSE: _______
MAE: _______
RMSE: _______
95th percentile error: _______
```

### **Training Details:**
```
Epochs completed: _______
Final training loss: _______
Final validation loss: _______
Best epoch: _______
```

**Save this information!** You'll need it for your report.

✅ **Checkpoint:** Metrics recorded

---

## 🔧 Part 5: Update ML Service (2 minutes)

### **Replace ML Service with Trained Version:**

```bash
# Backup original
copy app.py app_old_untrained.py

# Use trained model version
copy app_with_trained_model.py app.py
```

**Verify the update:**
```bash
type app.py | findstr "load_trained_model"
```

Should show: `def load_trained_model():`

✅ **Checkpoint:** ML service updated

---

## ✅ Final Verification

### **Quick Test - Start ML Service:**

```bash
python app.py
```

**Expected output:**
```
======================================================================
          🚀 GasGuard ML Service (With Trained Model)
======================================================================
Model Status: ✅ TRAINED
Scaler Status: ✅ LOADED
======================================================================
📦 Loading trained model from models/gas_leak_model.h5
✅ Model loaded successfully
📦 Loading scaler from models/scaler.pkl
✅ Scaler loaded successfully
======================================================================

 * Running on http://0.0.0.0:5000
```

**If you see "✅ TRAINED" - SUCCESS!** 🎉

Press `Ctrl+C` to stop for now.

---

## 📋 Completion Checklist

- [ ] Python packages installed
- [ ] Training completed without errors
- [ ] `models/gas_leak_model.h5` exists
- [ ] `models/scaler.pkl` exists
- [ ] Performance plots created
- [ ] Evaluation plot looks reasonable
- [ ] Training history shows convergence
- [ ] Metrics recorded for report
- [ ] ML service updated (`app.py`)
- [ ] ML service loads model successfully

---

## 🐛 Troubleshooting

### **Problem: "No Excel files found"**

**Solution:**
```bash
# Check dataset path
dir "D:\AAA\Final Submission\Datasets\zenodo"

# If empty, re-download from:
# https://zenodo.org/records/6616632
```

### **Problem: "ModuleNotFoundError: No module named 'tensorflow'"**

**Solution:**
```bash
pip install tensorflow
# or
pip install --upgrade tensorflow
```

### **Problem: "Out of memory" during training**

**Solution:**
Edit `train_zenodo.py` line ~20:
```python
BATCH_SIZE = 16  # Reduce from 32 to 16
```

### **Problem: Training is very slow**

**Normal!** Training takes 10-20 minutes on CPU.
- Epoch 1 is slowest (15s)
- Later epochs faster (10s)
- Early stopping may finish before 100 epochs

### **Problem: "openpyxl not found"**

**Solution:**
```bash
pip install openpyxl
```

### **Problem: High prediction error (MAE > 0.1)**

**Acceptable!** For normalized data:
- MAE < 0.05 = Excellent
- MAE < 0.1 = Good
- MAE < 0.2 = Acceptable
- MAE > 0.2 = May need retraining

---

## 📊 Understanding Your Results

### **What the Metrics Mean:**

**MSE (Mean Squared Error):**
- Lower is better
- < 0.01 = Excellent
- < 0.05 = Good
- Penalizes large errors heavily

**MAE (Mean Absolute Error):**
- Lower is better
- < 0.03 = Excellent
- < 0.1 = Good
- Average prediction error

**RMSE (Root Mean Squared Error):**
- Lower is better
- Between MSE and MAE
- Similar scale to original data

**95th Percentile Error:**
- Shows worst-case performance
- < 0.5 = Good
- Most predictions better than this

### **Why H2S is Synthetic:**

H2S data isn't in Zenodo dataset because:
- Very toxic (hard to generate test data)
- Expensive sensors
- Limited public datasets

**Our solution:**
- Generate based on CO patterns (both toxic gases)
- Scale to H2S typical ranges (0-100 ppm)
- Add realistic noise
- Use PPM thresholds for classification

**Academic validity:** ✅ Acknowledged limitation with engineering solution

---

## 🎉 Success!

If all checkboxes are marked, you're ready for **Step 2**!

📖 **Next Guide:** `02_START_SERVICES.md`

This will:
1. Start ML service with trained model
2. Start backend
3. Verify integration
4. Test real-time communication

---

**Well done! You now have a REAL trained LSTM model! 🚀**
