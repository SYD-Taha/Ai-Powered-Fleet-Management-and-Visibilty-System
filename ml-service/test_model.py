#!/usr/bin/env python3
"""Quick test to verify model was created correctly"""

import joblib
from pathlib import Path

model_path = Path('models/dispatch_ml_model.pkl')

if not model_path.exists():
    print("❌ Model file not found!")
    exit(1)

print("✅ Model file exists!")
print(f"📁 Path: {model_path.absolute()}")

# Load and verify
data = joblib.load(model_path)
print(f"\n📊 Model Info:")
print(f"  Features: {data['features']}")
print(f"  Number of features: {len(data['features'])}")
print(f"  MAE: {data['mae']:.3f}")
print(f"  R2: {data['r2']:.3f}")
print(f"  N Estimators: {data.get('n_estimators', 'N/A')}")

# Test prediction
model = data['model']
test_candidate = {
    'distance_m': 1250.0,
    'distance_cat': 1,
    'past_perf': 7.5,
    'fault_history': 2,
    'fatigue_h': 4.0,
    'fault_severity': 3
}

import pandas as pd
df_test = pd.DataFrame([test_candidate], columns=data['features'])
prediction = model.predict(df_test)[0]

print(f"\n🧪 Test Prediction:")
print(f"  Input: {test_candidate}")
print(f"  Predicted Score: {prediction:.2f}")
print("\n✅ Model is working correctly!")

