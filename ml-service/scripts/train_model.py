#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Training script for Dispatch ML Model
Generates synthetic data and trains RandomForest model for vehicle dispatch decisions.
"""

import sys
import os
import argparse
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
import joblib

def dist_cat(m):
    """Calculate distance category from meters"""
    if m < 1000:
        return 0
    elif m < 5000:
        return 1
    else:
        return 2

def generate_synthetic_data(n=3000, random_seed=42):
    """Generate synthetic dispatch data"""
    np.random.seed(random_seed)
    
    # Generate fault count (0-12 faults per day is realistic)
    faults_today = np.random.poisson(lam=3, size=n)  # Average 3 faults per day
    
    df = pd.DataFrame({
        'distance_m': np.random.exponential(scale=2000, size=n),      # distance to fault (meters)
        'past_perf': np.clip(np.random.normal(7, 1.5, n), 1, 10),     # team past performance (1-10)
        'fault_history': np.random.poisson(1.0, n),                   # similar faults handled (count)
        'fatigue_h': np.clip(faults_today * 2, 0, 24),               # crew fatigue (hours) - converted from fault count
        'fault_severity': np.random.choice([1, 2, 3], size=n)         # 1=low,2=medium,3=high
    })
    
    df['distance_cat'] = df['distance_m'].apply(dist_cat)
    
    return df

def calculate_rule_based_score(df):
    """Calculate rule-based dispatch scores"""
    # Rule-based scores (0..1 for each factor)
    dist_score = 1 - df['distance_m'] / (df['distance_m'].max() + 1e-6)
    dist_score = dist_score.clip(0, 1)
    
    fh_score = df['fault_history'] / (df['fault_history'].max() + 1e-6)
    fh_score = fh_score.clip(0, 1)
    
    fatigue_score = 1 - (df['fatigue_h'] / 24.0)
    fatigue_score = fatigue_score.clip(0, 1)
    
    severity_score = df['fault_severity'] / 3.0      # 1/3, 2/3, 1
    perf_score = df['past_perf'] / 10.0              # 0..1
    
    # Weighted rule-based dispatch score
    # Redistributed weights after removing traffic (20% removed)
    # New weights: distance=0.45, fault_history=0.25, fatigue=0.15, severity=0.05, perf=0.10
    rule_score = (
        0.45 * dist_score +      # Increased from 0.4
        0.25 * fh_score +         # Increased from 0.2
        0.15 * fatigue_score +   # Increased from 0.1
        0.05 * severity_score +  # Keep same
        0.10 * perf_score         # Increased from 0.05
    )
    
    # Normalize to 0-100
    dispatch_score = (rule_score - rule_score.min()) / (rule_score.max() - rule_score.min()) * 100
    
    return dispatch_score

def train_model(n_samples=3000, random_seed=42, model_path=None):
    """Train the dispatch ML model"""
    print(f"Generating {n_samples} synthetic records...")
    df = generate_synthetic_data(n=n_samples, random_seed=random_seed)
    
    print("Calculating rule-based dispatch scores...")
    df['dispatch_score'] = calculate_rule_based_score(df)
    
    # Prepare features and target
    feature_columns = ['distance_m', 'distance_cat', 'past_perf', 'fault_history',
                      'fatigue_h', 'fault_severity']
    X = df[feature_columns]
    y = df['dispatch_score']
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=random_seed)
    
    print(f"Training model with {len(X_train)} samples...")
    ml_model = RandomForestRegressor(n_estimators=200, random_state=random_seed, n_jobs=-1)
    ml_model.fit(X_train, y_train)
    
    # Evaluate
    preds = ml_model.predict(X_test)
    mae = mean_absolute_error(y_test, preds)
    r2 = r2_score(y_test, preds)
    
    print(f"\nModel Performance:")
    print(f"  MAE: {mae:.3f}")
    print(f"  R2:  {r2:.3f}")
    
    # Save model
    if model_path is None:
        model_path = Path(__file__).parent.parent / 'models' / 'dispatch_ml_model.pkl'
    else:
        model_path = Path(model_path)
    
    # Ensure directory exists
    model_path.parent.mkdir(parents=True, exist_ok=True)
    
    model_data = {
        'model': ml_model,
        'features': feature_columns,
        'n_estimators': 200,
        'random_seed': random_seed,
        'training_samples': len(X_train),
        'test_samples': len(X_test),
        'mae': float(mae),
        'r2': float(r2)
    }
    
    joblib.dump(model_data, model_path)
    print(f"\nModel saved to: {model_path}")
    
    return {
        'model': ml_model,
        'features': feature_columns,
        'mae': float(mae),
        'r2': float(r2),
        'model_path': str(model_path)
    }

def main():
    parser = argparse.ArgumentParser(description='Train Dispatch ML Model')
    parser.add_argument('--n-samples', type=int, default=3000,
                       help='Number of synthetic samples to generate (default: 3000)')
    parser.add_argument('--random-seed', type=int, default=42,
                       help='Random seed for reproducibility (default: 42)')
    parser.add_argument('--model-path', type=str, default=None,
                       help='Path to save model (default: models/dispatch_ml_model.pkl)')
    
    args = parser.parse_args()
    
    try:
        result = train_model(
            n_samples=args.n_samples,
            random_seed=args.random_seed,
            model_path=args.model_path
        )
        print("\n✅ Training completed successfully!")
        return 0
    except Exception as e:
        print(f"\n❌ Training failed: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1

if __name__ == '__main__':
    sys.exit(main())

