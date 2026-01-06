# Step-by-Step Plan: Update ML Model File for System Integration

## Overview
This plan details the exact changes needed to update `ml .py` to align with the current dispatch system's features and prepare it for microservice integration.

## Current State Analysis

### Current ML Model Features (7 features):
1. `distance_m` - distance to fault (meters) - synthetic exponential
2. `distance_cat` - categorical distance (0, 1, 2)
3. `past_perf` - team performance (1-10 scale) - synthetic normal
4. `fault_history` - count of similar faults - synthetic Poisson
5. `fatigue_h` - crew fatigue in hours (0-24) - synthetic normal
6. `traffic` - traffic level (0-1) - synthetic uniform **TO BE REMOVED**
7. `fault_severity` - severity level (1, 2, 3) - synthetic choice

### Current System Features Available:
- Performance: 0-1 ratio (resolved/assigned faults)
- Fatigue: Count of faults today (not hours)
- Fault History: Count of similar fault_type handled (from `checkFaultTypeExperienceBatch`)
- Category: "High", "Medium", "Low" (needs mapping to 1, 2, 3)
- Distance: Available via routing service `calculateRoute()`

## Step-by-Step Implementation

### STEP 1: Remove Traffic Feature from Synthetic Data Generation

**Location:** Line 35 in `ml .py`

**Current Code:**
```python
df = pd.DataFrame({
    'distance_m': np.random.exponential(scale=2000, size=n),
    'past_perf': np.clip(np.random.normal(7, 1.5, n), 1, 10),
    'fault_history': np.random.poisson(1.0, n),
    'fatigue_h': np.clip(np.random.normal(6, 3, n), 0, 24),
    'traffic': np.random.uniform(0, 1, n),  # <-- REMOVE THIS LINE
    'fault_severity': np.random.choice([1, 2, 3], size=n)
})
```

**Updated Code:**
```python
df = pd.DataFrame({
    'distance_m': np.random.exponential(scale=2000, size=n),      # distance to fault (meters)
    'past_perf': np.clip(np.random.normal(7, 1.5, n), 1, 10),     # team past performance (1-10)
    'fault_history': np.random.poisson(1.0, n),                   # similar faults handled (count)
    'fatigue_h': np.clip(np.random.normal(6, 3, n), 0, 24),       # crew fatigue (hours)
    'fault_severity': np.random.choice([1, 2, 3], size=n)         # 1=low,2=medium,3=high
})
```

**Action:** Delete line 35 containing `'traffic': np.random.uniform(0, 1, n),`

---

### STEP 2: Update Fatigue Calculation to Match System

**Location:** Line 34 in `ml .py`

**Current Code:**
```python
'fatigue_h': np.clip(np.random.normal(6, 3, n), 0, 24),  # synthetic hours
```

**Rationale:** Current system tracks fatigue as count of faults today. We need to convert count to estimated hours. Assume 2 hours per fault, capped at 24 hours.

**Updated Code:**
```python
# Generate fault count (0-12 faults per day is realistic)
faults_today = np.random.poisson(lam=3, size=n)  # Average 3 faults per day
# Convert to hours: 2 hours per fault, max 24 hours
'fatigue_h': np.clip(faults_today * 2, 0, 24),
```

**Action:** Replace line 34 with the new fatigue calculation

---

### STEP 3: Remove Traffic from Rule-Based Scoring

**Location:** Lines 59 and 71 in `ml .py`

**Current Code (Line 59):**
```python
traffic_score = 1 - df['traffic']
```

**Action:** Delete line 59 entirely

**Current Code (Lines 68-75):**
```python
rule_score = (
    0.4 * dist_score +
    0.2 * fh_score +
    0.2 * traffic_score +  # <-- REMOVE THIS LINE
    0.1 * fatigue_score +
    0.05 * severity_score +
    0.05 * perf_score
)
```

**Updated Code:**
```python
# Redistribute weights after removing traffic (20% removed)
# New weights: distance=0.45, fault_history=0.25, fatigue=0.15, severity=0.05, perf=0.10
rule_score = (
    0.45 * dist_score +      # Increased from 0.4
    0.25 * fh_score +         # Increased from 0.2
    0.15 * fatigue_score +   # Increased from 0.1
    0.05 * severity_score +  # Keep same
    0.10 * perf_score         # Increased from 0.05
)
```

**Action:** Update lines 68-75 with new weights

---

### STEP 4: Update Feature List for Model Training

**Location:** Lines 84-85 in `ml .py`

**Current Code:**
```python
X = df[['distance_m','distance_cat','past_perf','fault_history',
        'fatigue_h','traffic','fault_severity']]
```

**Updated Code:**
```python
X = df[['distance_m','distance_cat','past_perf','fault_history',
        'fatigue_h','fault_severity']]
```

**Action:** Remove `'traffic'` from the feature list

---

### STEP 5: Update Display Output

**Location:** Line 80-81 in `ml .py`

**Current Code:**
```python
show_df(df[['distance_m','distance_cat','past_perf','fault_history','fatigue_h',
            'traffic','fault_severity','dispatch_score']], n=20)
```

**Updated Code:**
```python
show_df(df[['distance_m','distance_cat','past_perf','fault_history','fatigue_h',
            'fault_severity','dispatch_score']], n=20)
```

**Action:** Remove `'traffic'` from the display columns

---

### STEP 6: Update Example Candidates

**Location:** Lines 117-145 in `ml .py`

**Current Code:**
```python
candidates = [
    {
        'distance_m': 800,
        'distance_cat': 0,
        'past_perf': 7.5,
        'fault_history': 1,
        'fatigue_h': 5,
        'traffic': 0.4,  # <-- REMOVE THIS LINE
        'fault_severity': 3
    },
    {
        'distance_m': 2500,
        'distance_cat': 1,
        'past_perf': 9.0,
        'fault_history': 3,
        'fatigue_h': 3,
        'traffic': 0.1,  # <-- REMOVE THIS LINE
        'fault_severity': 3
    },
    {
        'distance_m': 6000,
        'distance_cat': 2,
        'past_perf': 6.5,
        'fault_history': 0,
        'fatigue_h': 2,
        'traffic': 0.2,  # <-- REMOVE THIS LINE
        'fault_severity': 2
    }
]
```

**Updated Code:**
```python
candidates = [
    {
        'distance_m': 800,
        'distance_cat': 0,
        'past_perf': 7.5,
        'fault_history': 1,
        'fatigue_h': 5,
        'fault_severity': 3
    },
    {
        'distance_m': 2500,
        'distance_cat': 1,
        'past_perf': 9.0,
        'fault_history': 3,
        'fatigue_h': 3,
        'fault_severity': 3
    },
    {
        'distance_m': 6000,
        'distance_cat': 2,
        'past_perf': 6.5,
        'fault_history': 0,
        'fatigue_h': 2,
        'fault_severity': 2
    }
]
```

**Action:** Remove `'traffic'` key from all three candidate dictionaries

---

### STEP 7: Add Feature Extraction Documentation

**Location:** After line 154 (end of file), add new section

**New Code to Add:**
```python
# ============================================================================
# INTEGRATION NOTES: Feature Extraction from Node.js System
# ============================================================================
"""
This section documents how to extract features from the Node.js dispatch system
for use with this ML model in a microservice.

FEATURE MAPPING:
----------------
1. distance_m (float):
   - Source: routingService.calculateRoute(vehicleGPS, faultGPS)
   - Extract: route.distance (already in meters)
   - Example: route = await calculateRoute({lat: 24.86, lng: 67.00}, {lat: 24.90, lng: 67.05})
              distance_m = route.distance

2. distance_cat (int: 0, 1, or 2):
   - Source: Derived from distance_m
   - Logic: 0 if distance_m < 1000, 1 if < 5000, else 2
   - Example: distance_cat = 0 if distance_m < 1000 else (1 if distance_m < 5000 else 2)

3. past_perf (float: 1-10):
   - Source: calculatePerformanceScoresBatch() returns 0-1 ratio
   - Convert: past_perf = performanceRatio * 10
   - Example: If performanceRatio = 0.75, then past_perf = 7.5

4. fault_history (int: count):
   - Source: checkFaultTypeExperienceBatch(vehicleIds, faultType)
   - Extract: Count of resolved faults with same fault_type
   - Example: experienceMap.get(vehicleId) returns count (not boolean)
   - Note: Current system returns boolean, but count is available in aggregation

5. fatigue_h (float: 0-24):
   - Source: calculateFatigueLevelsBatch() returns count of faults today
   - Convert: fatigue_h = min(faultsToday * 2, 24)  # 2 hours per fault
   - Example: If faultsToday = 3, then fatigue_h = 6

6. fault_severity (int: 1, 2, or 3):
   - Source: fault.category ("High", "Medium", "Low")
   - Map: "High" → 3, "Medium" → 2, "Low" → 1
   - Example: fault_severity = 3 if category === "High"

EXAMPLE JSON PAYLOAD FOR MICROSERVICE:
---------------------------------------
POST /api/ml/dispatch/predict
{
  "candidates": [
    {
      "distance_m": 1250.5,
      "distance_cat": 1,
      "past_perf": 8.2,
      "fault_history": 2,
      "fatigue_h": 4.0,
      "fault_severity": 3
    },
    {
      "distance_m": 3500.0,
      "distance_cat": 1,
      "past_perf": 6.5,
      "fault_history": 0,
      "fatigue_h": 8.0,
      "fault_severity": 3
    }
  ]
}

RESPONSE:
---------
{
  "best_index": 0,
  "scores": [85.3, 72.1],
  "predictions": [
    {"index": 0, "score": 85.3},
    {"index": 1, "score": 72.1}
  ]
}

LATENCY EXPECTATIONS:
----------------------
- Model loading: ~100-200ms (one-time, on service start)
- Single prediction: ~5-20ms
- Batch prediction (10 candidates): ~10-50ms
- Total API call (with feature extraction): <100ms target
"""

print("\n" + "="*70)
print("INTEGRATION READY")
print("="*70)
print("Model trained with 6 features (traffic removed)")
print("Features: distance_m, distance_cat, past_perf, fault_history, fatigue_h, fault_severity")
print("Model file: dispatch_ml_model.pkl")
print("Ready for microservice deployment")
print("="*70)
```

**Action:** Add this documentation section at the end of the file

---

### STEP 8: Add Helper Function for Feature Extraction (Optional but Recommended)

**Location:** After line 114 (after `ai_dispatch_decision` function)

**New Code to Add:**
```python
def extract_features_from_system_data(vehicle_data, fault_data, distance_m):
    """
    Helper function to extract ML features from system data structures.
    This function shows the expected format for microservice integration.
    
    Args:
        vehicle_data: Dict with keys:
            - performance_ratio: float (0-1)
            - fault_history_count: int (count of similar fault_type)
            - fatigue_count: int (faults today)
        fault_data: Dict with keys:
            - category: str ("High", "Medium", "Low")
        distance_m: float (distance in meters from routing service)
    
    Returns:
        Dict with ML model features
    """
    # Calculate distance category
    if distance_m < 1000:
        distance_cat = 0
    elif distance_m < 5000:
        distance_cat = 1
    else:
        distance_cat = 2
    
    # Convert performance ratio (0-1) to scale (1-10)
    past_perf = vehicle_data['performance_ratio'] * 10
    
    # Use fault history count directly
    fault_history = vehicle_data['fault_history_count']
    
    # Convert fatigue count to hours (2 hours per fault, max 24)
    fatigue_h = min(vehicle_data['fatigue_count'] * 2, 24)
    
    # Map category to severity
    category_map = {"High": 3, "Medium": 2, "Low": 1}
    fault_severity = category_map.get(fault_data['category'], 2)  # Default to Medium
    
    return {
        'distance_m': distance_m,
        'distance_cat': distance_cat,
        'past_perf': past_perf,
        'fault_history': fault_history,
        'fatigue_h': fatigue_h,
        'fault_severity': fault_severity
    }

# Example usage:
example_vehicle = {
    'performance_ratio': 0.75,
    'fault_history_count': 2,
    'fatigue_count': 3
}
example_fault = {
    'category': 'High'
}
example_distance = 1250.5

features = extract_features_from_system_data(example_vehicle, example_fault, example_distance)
print("\nExample feature extraction:")
print(json.dumps(features, indent=2))
```

**Action:** Add this helper function after the `ai_dispatch_decision` function

---

## Summary of Changes

### Files to Modify:
1. `ml .py` - Update ML model training script

### Changes Summary:
1. ✅ Remove `traffic` feature from synthetic data (line 35)
2. ✅ Update fatigue calculation to use fault count → hours conversion (line 34)
3. ✅ Remove traffic from rule-based scoring (lines 59, 71)
4. ✅ Update scoring weights (lines 68-75)
5. ✅ Remove traffic from feature list (line 84-85)
6. ✅ Remove traffic from display output (line 80-81)
7. ✅ Remove traffic from example candidates (lines 117-145)
8. ✅ Add integration documentation (end of file)
9. ✅ Add feature extraction helper function (optional)

### Expected Model Performance:
- Features: 6 (down from 7)
- Training samples: 3000
- Expected MAE: Similar to current (traffic was only 20% weight)
- Expected R2: >0.95 (model learns rule-based pattern well)

### Next Steps After File Update:
1. Run updated script to regenerate model
2. Verify model performance metrics
3. Test with example candidates
4. Create Python microservice (Flask/FastAPI) to serve model
5. Integrate microservice with Node.js dispatch controller

---

## Testing Checklist

After making changes, verify:
- [ ] Script runs without errors
- [ ] Model trains successfully
- [ ] MAE and R2 scores are reasonable
- [ ] Model file (`dispatch_ml_model.pkl`) is generated
- [ ] Example candidates work with updated model
- [ ] Feature list has 6 features (no traffic)
- [ ] Integration documentation is clear

---

## Notes

- Model will be retrained with synthetic data (no historical data available)
- Traffic feature removed as per requirements
- Distance will come from routing service in production
- Fatigue conversion: count * 2 hours (configurable)
- Model ready for microservice deployment after these changes

