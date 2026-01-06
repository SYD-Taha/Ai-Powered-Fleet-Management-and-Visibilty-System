 # AI/ML Dispatch Engine Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Model Details](#model-details)
4. [API Endpoints](#api-endpoints)
5. [Integration with Backend](#integration-with-backend)
6. [Workflows](#workflows)
7. [Feature Extraction](#feature-extraction)
8. [Training](#training)
9. [Deployment](#deployment)
10. [Testing](#testing)
11. [Troubleshooting](#troubleshooting)

---

## Overview

The AI/ML Dispatch Engine is a machine learning microservice that provides intelligent vehicle selection for fault dispatch. It uses a RandomForest regression model trained on synthetic data to predict the best vehicle for each fault based on multiple factors.

### Key Features
- **Machine Learning-Based Prediction**: Uses RandomForest model to score vehicle candidates
- **Automatic Fallback**: Falls back to rule-based dispatch if ML service is unavailable
- **RESTful API**: FastAPI-based microservice with health checks and model management
- **Batch Processing**: Efficient batch feature extraction and prediction
- **Model Training**: On-demand model training via API or standalone script
- **Feature Engineering**: 6 features extracted from vehicles and faults

### Technology Stack
- **Framework**: FastAPI (Python)
- **ML Library**: scikit-learn (RandomForestRegressor)
- **Data Processing**: pandas, numpy
- **Model Persistence**: joblib
- **API Validation**: Pydantic

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Backend Dispatch Controller                 │
│  ┌──────────────────────────────────────────────────┐  │
│  │  dispatchFaultToVehicle()                         │  │
│  │  1. Get available vehicles                        │  │
│  │  2. Extract ML features (featureExtractionService)│  │
│  │  3. Call ML Service (mlService.js)                 │  │
│  │  4. Fallback to rule-based if ML unavailable      │  │
│  └──────────────────────────────────────────────────┘  │
└───────────────────────┬──────────────────────────────────┘
                        │ HTTP POST /api/predict
                        ▼
┌─────────────────────────────────────────────────────────┐
│              ML Dispatch Service (FastAPI)               │
│  ┌──────────────────────────────────────────────────┐  │
│  │  /api/predict                                     │  │
│  │  - Receives candidate features                    │  │
│  │  - Loads ML model                                 │  │
│  │  - Predicts scores for all candidates             │  │
│  │  - Returns best_index and scores                  │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  DispatchModel (dispatch_model.py)               │  │
│  │  - Model loading and caching                      │  │
│  │  - Prediction logic                               │  │
│  │  - Feature validation                             │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  RandomForest Model (dispatch_ml_model.pkl)      │  │
│  │  - 200 estimators                                 │  │
│  │  - 6 input features                               │  │
│  │  - Output: dispatch score (0-100)                 │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Component Architecture

```
ml-service/
├── app/
│   ├── main.py                    # FastAPI application & endpoints
│   ├── models/
│   │   └── dispatch_model.py     # Model loading & prediction
│   ├── services/
│   │   └── training_service.py   # Training orchestration
│   └── schemas/
│       └── dispatch_schemas.py   # API request/response models
├── scripts/
│   └── train_model.py            # Model training script
├── models/
│   └── dispatch_ml_model.pkl     # Trained model (generated)
└── requirements.txt              # Python dependencies
```

### Service Communication Flow

```
Backend Dispatch Controller
    │
    ├─► Check ML service availability (GET /api/health)
    │
    ├─► Extract features for all vehicle candidates
    │   ├─► Distance calculation (OSRM/Haversine)
    │   ├─► Performance scores (batch query)
    │   ├─► Fatigue levels (batch query)
    │   ├─► Fault history (batch query)
    │   └─► Fault severity mapping
    │
    ├─► POST /api/predict with candidates array
    │
    ├─► ML Service processes candidates
    │   ├─► Validates features
    │   ├─► Loads model (if not loaded)
    │   ├─► Predicts scores for all candidates
    │   └─► Returns best_index and scores
    │
    └─► Backend selects vehicle at best_index
        └─► Falls back to rule-based if ML fails
```

---

## Model Details

### Model Type
- **Algorithm**: RandomForestRegressor
- **Estimators**: 200 trees
- **Output**: Dispatch score (0-100 scale)
- **Training Data**: Synthetic data generated from rule-based scoring

### Model Features (6 Features)

1. **distance_m** (float)
   - **Description**: Distance from vehicle to fault location in meters
   - **Range**: 0 to ~50,000+ meters
   - **Calculation**: OSRM route distance (with Haversine fallback)
   - **Impact**: Lower distance = higher score

2. **distance_cat** (int)
   - **Description**: Distance category for categorical encoding
   - **Values**: 
     - `0`: < 1,000 meters
     - `1`: 1,000 - 5,000 meters
     - `2`: >= 5,000 meters
   - **Calculation**: Categorized from `distance_m`

3. **past_perf** (float)
   - **Description**: Historical performance score
   - **Range**: 1.0 to 10.0
   - **Calculation**: `(performance_ratio * 9) + 1`
     - Performance ratio: 0.0 (worst) to 1.0 (best)
     - Maps to 1.0 (worst) to 10.0 (best)
   - **Source**: Historical fault resolution success rate

4. **fault_history** (int)
   - **Description**: Count of similar fault types handled by vehicle
   - **Range**: 0 to unlimited
   - **Calculation**: Count of resolved faults for vehicle
   - **Impact**: Higher count = more experience = higher score

5. **fatigue_h** (float)
   - **Description**: Crew fatigue in hours
   - **Range**: 0.0 to 24.0 hours
   - **Calculation**: `min(fatigue_count * 2, 24)`
     - Fatigue count: Number of faults handled today
     - Capped at 24 hours
   - **Impact**: Lower fatigue = higher score

6. **fault_severity** (int)
   - **Description**: Fault severity level
   - **Values**:
     - `1`: Low priority
     - `2`: Medium priority
     - `3`: High priority
   - **Mapping**: 
     - `"Low"` → 1
     - `"Medium"` → 2
     - `"High"` → 3
   - **Source**: Fault category field

### Model Training

**Training Data Generation**:
- Synthetic data generated using statistical distributions
- Rule-based scores used as target labels
- Training set: 80% of samples
- Test set: 20% of samples

**Rule-Based Score Calculation** (used as training target):
```python
rule_score = (
    0.45 * distance_score +      # Distance (inverse normalized)
    0.25 * fault_history_score + # Fault history (normalized)
    0.15 * fatigue_score +       # Fatigue (inverse normalized)
    0.05 * severity_score +      # Severity (normalized)
    0.10 * performance_score      # Performance (normalized)
)
# Normalized to 0-100 scale
```

**Model Performance**:
- **MAE** (Mean Absolute Error): ~2-3 points (on 0-100 scale)
- **R² Score**: ~0.98-0.99 (high accuracy)
- **Training Time**: ~5-30 seconds (depending on n_samples)

---

## API Endpoints

### 1. Health Check

**Endpoint**: `GET /api/health`

**Purpose**: Check service health and model availability

**Response**:
```json
{
  "status": "healthy",
  "model_loaded": true,
  "model_features": 6,
  "error": null
}
```

**Status Codes**:
- `200`: Service is healthy
- `503`: Service unhealthy or model not loaded

---

### 2. Model Information

**Endpoint**: `GET /api/model/info`

**Purpose**: Get detailed model information

**Response**:
```json
{
  "loaded": true,
  "features": [
    "distance_m",
    "distance_cat",
    "past_perf",
    "fault_history",
    "fatigue_h",
    "fault_severity"
  ],
  "n_features": 6,
  "model_type": "RandomForestRegressor",
  "model_info": {
    "n_estimators": 200,
    "random_seed": 42,
    "training_samples": 2400,
    "test_samples": 600,
    "mae": 2.345,
    "r2": 0.987
  },
  "model_path": "models/dispatch_ml_model.pkl",
  "error": null
}
```

**Status Codes**:
- `200`: Model info retrieved successfully
- `500`: Error retrieving model info

---

### 3. Predict Best Vehicle

**Endpoint**: `POST /api/predict`

**Purpose**: Predict the best vehicle from candidate list

**Request Body**:
```json
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
```

**Response**:
```json
{
  "best_index": 0,
  "scores": [85.3, 72.1],
  "predictions": [
    {
      "index": 0,
      "score": 85.3,
      "features": {
        "distance_m": 1250.5,
        "distance_cat": 1,
        "past_perf": 8.2,
        "fault_history": 2,
        "fatigue_h": 4.0,
        "fault_severity": 3
      }
    },
    {
      "index": 1,
      "score": 72.1,
      "features": {
        "distance_m": 3500.0,
        "distance_cat": 1,
        "past_perf": 6.5,
        "fault_history": 0,
        "fatigue_h": 8.0,
        "fault_severity": 3
      }
    }
  ]
}
```

**Status Codes**:
- `200`: Prediction successful
- `400`: Invalid request (missing features, invalid values)
- `503`: Model not available
- `500`: Prediction error

**Validation Rules**:
- `distance_m`: >= 0
- `distance_cat`: 0, 1, or 2
- `past_perf`: 1.0 to 10.0
- `fault_history`: >= 0
- `fatigue_h`: 0.0 to 24.0
- `fault_severity`: 1, 2, or 3

---

### 4. Train Model

**Endpoint**: `POST /api/train`

**Purpose**: Train or retrain the ML model

**Request Body**:
```json
{
  "n_samples": 3000,
  "random_seed": 42
}
```

**Parameters**:
- `n_samples` (optional): Number of synthetic samples (default: 3000, min: 100, max: 100000)
- `random_seed` (optional): Random seed for reproducibility (default: 42)

**Response**:
```json
{
  "success": true,
  "mae": 2.345,
  "r2": 0.987,
  "model_path": "models/dispatch_ml_model.pkl",
  "features": [
    "distance_m",
    "distance_cat",
    "past_perf",
    "fault_history",
    "fatigue_h",
    "fault_severity"
  ],
  "n_samples": 3000,
  "random_seed": 42,
  "error": null
}
```

**Status Codes**:
- `200`: Training completed successfully
- `409`: Training already in progress
- `500`: Training failed

**Note**: After training, the model is automatically reloaded.

---

## Integration with Backend

### Backend Service Client

**File**: `backend/services/mlService.js`

**Functions**:
- `isMLServiceAvailable()`: Check if ML service is healthy and model is loaded
- `predictBestVehicle(candidates)`: Get prediction for vehicle candidates
- `getMLModelInfo()`: Get model information
- `trainMLModel(options)`: Train/retrain model

### Configuration

**Environment Variables** (in `backend/.env`):
```env
ML_SERVICE_URL=http://localhost:8000          # ML service URL
ML_SERVICE_TIMEOUT=5000                       # Request timeout (ms)
ML_SERVICE_ENABLED=true                       # Enable/disable ML service
```

**Docker Configuration**:
```env
ML_SERVICE_URL=http://ml-service:8000         # Docker service name
```

### Integration Flow in Dispatch Controller

```javascript
// 1. Check ML service availability
const mlAvailable = await isMLServiceAvailable();

if (mlAvailable) {
  // 2. Extract ML features for all vehicles
  const mlCandidates = await extractMLFeaturesBatch(
    vehicles,
    fault,
    systemData,
    vehicleGPSMap
  );
  
  // 3. Call ML service
  const mlResult = await predictBestVehicle(mlCandidates);
  
  if (mlResult && mlResult.bestIndex !== undefined) {
    // 4. Select vehicle from ML prediction
    selectedVehicle = vehicles[mlResult.bestIndex];
    selectionMethod = "ML";
  }
}

// 5. Fallback to rule-based if ML unavailable or failed
if (!selectedVehicle) {
  // Use rule-based scoring...
}
```

---

## Workflows

### 1. Fault Dispatch with ML Engine

```
┌─────────────────────────────────────────────────────────┐
│  Fault Reported (POST /api/faults)                      │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  dispatchFaultToVehicle(fault)                         │
│  1. Find available vehicles                             │
│  2. Filter out timed-out vehicles                       │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Check ML Service Availability                          │
│  GET /api/health                                        │
└───────────────────────┬─────────────────────────────────┘
                        │
            ┌───────────┴───────────┐
            │                       │
        Available              Unavailable
            │                       │
            ▼                       ▼
┌───────────────────┐    ┌──────────────────────┐
│ ML Dispatch Path  │    │ Rule-Based Path      │
└─────────┬─────────┘    └──────────┬───────────┘
          │                          │
          ▼                          ▼
┌─────────────────────────────────────────────────────────┐
│ Extract ML Features (featureExtractionService)          │
│                                                         │
│ For each vehicle:                                       │
│  ├─► Get latest GPS coordinates                         │
│  ├─► Calculate distance (OSRM/Haversine)                │
│  ├─► Get performance score (batch query)                │
│  ├─► Get fatigue level (batch query)                    │
│  ├─► Get fault history count                            │
│  └─► Map fault category to severity                     │
│                                                         │
│ Result: Array of candidate feature objects             │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│ POST /api/predict                                       │
│ {                                                       │
│   "candidates": [                                       │
│     { distance_m, distance_cat, past_perf, ... },      │
│     { distance_m, distance_cat, past_perf, ... },      │
│     ...                                                 │
│   ]                                                     │
│ }                                                       │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│ ML Service Processing                                   │
│                                                         │
│ 1. Validate all candidate features                      │
│ 2. Load model (if not loaded)                           │
│ 3. Convert to DataFrame                                 │
│ 4. Predict scores for all candidates                    │
│ 5. Find best_index (highest score)                      │
│                                                         │
│ Returns:                                                │
│ {                                                       │
│   best_index: 2,                                        │
│   scores: [72.1, 68.5, 85.3, ...],                     │
│   predictions: [...]                                    │
│ }                                                       │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│ Backend Selects Vehicle                                 │
│                                                         │
│ selectedVehicle = vehicles[mlResult.bestIndex]         │
│ selectionMethod = "ML"                                  │
│ selectionScore = mlResult.bestScore                     │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│ Update Fault & Vehicle                                  │
│                                                         │
│ - Fault status: "pending_confirmation"                 │
│ - Vehicle status: "onRoute"                             │
│ - Create Alert record                                   │
│ - Send MQTT dispatch alert                              │
└─────────────────────────────────────────────────────────┘
```

### 2. ML Service Fallback Flow

```
ML Service Call
    │
    ├─► Success → Use ML prediction
    │
    └─► Failure (timeout, error, unavailable)
        │
        ▼
    Log warning: "ML dispatch failed, falling back to rule-based"
        │
        ▼
    Rule-Based Dispatch
        │
        ├─► Calculate performance scores (batch)
        ├─► Calculate fatigue levels (batch)
        ├─► Check location experience (batch)
        ├─► Check fault type experience (batch)
        ├─► Score all vehicles (weighted formula)
        └─► Select highest scoring vehicle
```

### 3. Model Training Workflow

```
Training Request (POST /api/train or script)
    │
    ▼
Generate Synthetic Data
    │
    ├─► distance_m: Exponential distribution (scale=2000)
    ├─► past_perf: Normal distribution (mean=7, std=1.5)
    ├─► fault_history: Poisson distribution (lambda=1.0)
    ├─► fatigue_h: Based on faults today (capped at 24)
    └─► fault_severity: Random choice [1, 2, 3]
    │
    ▼
Calculate Rule-Based Scores (Target Labels)
    │
    ├─► Distance score (45% weight)
    ├─► Fault history score (25% weight)
    ├─► Fatigue score (15% weight)
    ├─► Severity score (5% weight)
    └─► Performance score (10% weight)
    │
    ▼
Split Data (80% train, 20% test)
    │
    ▼
Train RandomForest Model
    │
    ├─► n_estimators: 200
    ├─► random_state: seed
    └─► n_jobs: -1 (parallel)
    │
    ▼
Evaluate Model
    │
    ├─► Calculate MAE
    └─► Calculate R² score
    │
    ▼
Save Model
    │
    ├─► Model object
    ├─► Feature names
    ├─► Training metadata
    └─► Performance metrics
    │
    ▼
Reload Model in Service
    │
    └─► Model ready for predictions
```

---

## Feature Extraction

### Feature Extraction Service

**File**: `backend/services/featureExtractionService.js`

**Function**: `extractMLFeaturesBatch(vehicles, fault, systemData, vehicleGPSMap)`

### Feature Extraction Process

1. **Distance Calculation**:
   ```javascript
   // Try OSRM route calculation first
   const route = await calculateRoute(vehicleGPS, faultGPS);
   const distance_m = route.distance; // meters
   
   // Fallback to Haversine if OSRM fails
   const distance_m = haversineDistance(vehicleGPS, faultGPS);
   
   // Calculate distance category
   const distance_cat = distance_m < 1000 ? 0 : 
                        distance_m < 5000 ? 1 : 2;
   ```

2. **Performance Score**:
   ```javascript
   // From batch query (performanceMap)
   const performance = performanceMap.get(vehicleId) || 0.5; // 0-1 ratio
   
   // Map to ML scale (1-10)
   const past_perf = (performance * 9) + 1; // 0.0→1.0, 1.0→10.0
   ```

3. **Fault History**:
   ```javascript
   // Count of resolved faults for this vehicle
   const fault_history = await Fault.countDocuments({
     assigned_vehicle: vehicle._id,
     status: "resolved"
   });
   ```

4. **Fatigue Level**:
   ```javascript
   // From batch query (fatigueMap)
   const fatigueCount = fatigueMap.get(vehicleId) || 0;
   
   // Convert to hours (capped at 24)
   const fatigue_h = Math.min(fatigueCount * 2, 24);
   ```

5. **Fault Severity**:
   ```javascript
   // Map fault category to severity
   const severityMap = { "Low": 1, "Medium": 2, "High": 3 };
   const fault_severity = severityMap[fault.category] || 2;
   ```

### Batch Processing

**Optimizations**:
- GPS coordinates fetched in batch (`getVehicleGPSBatch`)
- Performance scores calculated in batch (`calculatePerformanceScoresBatch`)
- Fatigue levels calculated in batch (`calculateFatigueLevelsBatch`)
- Distance calculations with concurrency limit (10 parallel)

**Example Feature Object**:
```javascript
{
  distance_m: 1250,           // meters
  distance_cat: 1,            // 0, 1, or 2
  past_perf: 8.2,             // 1.0 to 10.0
  fault_history: 5,            // count
  fatigue_h: 4.0,             // 0.0 to 24.0
  fault_severity: 3            // 1, 2, or 3
}
```

---

## Training

### Training Methods

#### 1. Standalone Script

```bash
cd ml-service
python scripts/train_model.py --n-samples 3000 --random-seed 42
```

**Options**:
- `--n-samples`: Number of synthetic samples (default: 3000)
- `--random-seed`: Random seed for reproducibility (default: 42)
- `--model-path`: Custom model path (default: `models/dispatch_ml_model.pkl`)

#### 2. API Endpoint

```bash
curl -X POST http://localhost:8000/api/train \
  -H "Content-Type: application/json" \
  -d '{
    "n_samples": 3000,
    "random_seed": 42
  }'
```

**From Backend**:
```javascript
import { trainMLModel } from './services/mlService.js';

const result = await trainMLModel({
  n_samples: 3000,
  random_seed: 42
});
```

### Training Data Generation

**Synthetic Data Distributions**:
- `distance_m`: Exponential distribution (scale=2000m)
- `past_perf`: Normal distribution (mean=7, std=1.5), clipped to [1, 10]
- `fault_history`: Poisson distribution (lambda=1.0)
- `fatigue_h`: Based on faults today (faults * 2), capped at 24
- `fault_severity`: Random choice from [1, 2, 3]

**Target Labels**:
- Rule-based scores calculated from synthetic features
- Normalized to 0-100 scale
- Used as training targets for ML model

### Model Evaluation

**Metrics**:
- **MAE** (Mean Absolute Error): Average absolute difference between predicted and actual scores
- **R² Score**: Coefficient of determination (1.0 = perfect, 0.0 = no better than mean)

**Expected Performance**:
- MAE: ~2-3 points (on 0-100 scale)
- R²: ~0.98-0.99

---

## Deployment

### Local Development

1. **Create virtual environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Train initial model**:
   ```bash
   python scripts/train_model.py
   ```

4. **Run service**:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

### Docker Deployment

**Build**:
```bash
docker build -t ml-dispatch-service ./ml-service
```

**Run**:
```bash
docker run -p 8000:8000 \
  -v $(pwd)/ml-service/models:/app/models \
  ml-dispatch-service
```

**Docker Compose** (already configured):
```yaml
ml-service:
  build: ./ml-service
  ports:
    - "8000:8000"
  volumes:
    - ml_models:/app/models
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8000/api/health"]
    interval: 30s
    timeout: 10s
    retries: 3
```

### Environment Variables

```env
# ML Service
PORT=8000
MODEL_PATH=models/dispatch_ml_model.pkl
LOG_LEVEL=INFO
```

### Health Checks

**Docker Healthcheck**:
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:8000/api/health || exit 1
```

**Kubernetes Readiness Probe**:
```yaml
readinessProbe:
  httpGet:
    path: /api/health
    port: 8000
  initialDelaySeconds: 10
  periodSeconds: 30
```

---

## Testing

### Manual API Testing

**Health Check**:
```bash
curl http://localhost:8000/api/health
```

**Model Info**:
```bash
curl http://localhost:8000/api/model/info
```

**Prediction**:
```bash
curl -X POST http://localhost:8000/api/predict \
  -H "Content-Type: application/json" \
  -d '{
    "candidates": [
      {
        "distance_m": 1250.5,
        "distance_cat": 1,
        "past_perf": 8.2,
        "fault_history": 2,
        "fatigue_h": 4.0,
        "fault_severity": 3
      }
    ]
  }'
```

**Training**:
```bash
curl -X POST http://localhost:8000/api/train \
  -H "Content-Type: application/json" \
  -d '{"n_samples": 1000, "random_seed": 42}'
```

### Test Scripts

**API Test** (`test_api.py`):
```bash
python test_api.py
```

**Model Test** (`test_model.py`):
```bash
python test_model.py
```

### Integration Testing

**From Backend**:
```javascript
// Test ML service availability
const available = await isMLServiceAvailable();
console.log('ML Service Available:', available);

// Test prediction
const candidates = [
  {
    distance_m: 1250,
    distance_cat: 1,
    past_perf: 8.2,
    fault_history: 2,
    fatigue_h: 4.0,
    fault_severity: 3
  }
];

const result = await predictBestVehicle(candidates);
console.log('Best Vehicle Index:', result.bestIndex);
console.log('Score:', result.bestScore);
```

---

## Troubleshooting

### Common Issues

#### 1. Model Not Found

**Error**: `Model not available` or `Model file not found`

**Solution**:
```bash
# Train a model first
python scripts/train_model.py

# Or via API
curl -X POST http://localhost:8000/api/train
```

#### 2. ML Service Unavailable

**Error**: Connection refused or timeout

**Check**:
- Service is running: `curl http://localhost:8000/api/health`
- Port is correct: Check `ML_SERVICE_URL` in backend `.env`
- Docker networking: Use service name in Docker (`ml-service:8000`)

**Solution**:
- Start ML service: `uvicorn app.main:app --port 8000`
- Check backend logs for connection errors
- Verify `ML_SERVICE_ENABLED=true` in backend `.env`

#### 3. Invalid Feature Values

**Error**: `Missing required features` or `Invalid candidate values`

**Check**:
- All 6 features present in candidate objects
- Feature values within valid ranges:
  - `distance_m`: >= 0
  - `distance_cat`: 0, 1, or 2
  - `past_perf`: 1.0 to 10.0
  - `fault_history`: >= 0
  - `fatigue_h`: 0.0 to 24.0
  - `fault_severity`: 1, 2, or 3

**Solution**:
- Check feature extraction logic in `featureExtractionService.js`
- Validate GPS coordinates (not NaN)
- Check performance/fatigue calculations

#### 4. Prediction Returns Invalid Index

**Error**: `bestIndex` out of bounds

**Check**:
- Number of candidates matches number of vehicles
- ML service returns valid `best_index` (0 to candidates.length - 1)

**Solution**:
- Verify candidate array order matches vehicle array order
- Check ML service response structure

#### 5. Slow Predictions

**Symptoms**: High latency on prediction requests

**Optimizations**:
- Use batch feature extraction (already implemented)
- Limit distance calculation concurrency (10 parallel)
- Cache GPS coordinates
- Use Haversine when circuit breaker is open

**Check**:
- OSRM service availability (circuit breaker status)
- Network latency to ML service
- Model loading time (should be < 200ms on startup)

### Debugging

**Enable Debug Logging**:
```env
LOG_LEVEL=DEBUG
```

**Check ML Service Logs**:
```bash
# Docker
docker logs ml-service

# Local
# Logs appear in console when running uvicorn
```

**Backend Logging**:
- ML service calls logged in `backend/services/mlService.js`
- Feature extraction logged in `backend/services/featureExtractionService.js`
- Dispatch decisions logged in `backend/controllers/dispatchController.js`

---

## Performance Metrics

### Model Performance
- **Loading Time**: ~100-200ms (one-time, on service start)
- **Single Prediction**: ~5-20ms
- **Batch Prediction (10 candidates)**: ~10-50ms
- **Total API Call**: <100ms target

### Training Performance
- **1000 samples**: ~2-5 seconds
- **3000 samples**: ~5-15 seconds
- **10000 samples**: ~20-60 seconds

### System Performance
- **Feature Extraction (10 vehicles)**: ~500ms-2s (depends on OSRM)
- **ML Prediction (10 candidates)**: ~10-50ms
- **Total Dispatch Time (with ML)**: ~1-3 seconds

---

## Future Enhancements

### Model Improvements
1. **Real Training Data**: Replace synthetic data with historical dispatch data
2. **Feature Engineering**: Add more features (weather, traffic, time of day)
3. **Model Selection**: Test other algorithms (XGBoost, Neural Networks)
4. **Hyperparameter Tuning**: Optimize RandomForest parameters
5. **Online Learning**: Incremental model updates from new data

### Service Improvements
1. **Model Versioning**: Support multiple model versions
2. **A/B Testing**: Compare ML vs rule-based performance
3. **Prediction Caching**: Cache predictions for similar scenarios
4. **Batch Predictions**: Support multiple faults at once
5. **Model Monitoring**: Track prediction accuracy over time

### Integration Improvements
1. **Feature Store**: Centralized feature management
2. **Model Registry**: Track model versions and performance
3. **Automated Retraining**: Schedule periodic model retraining
4. **Performance Metrics**: Dashboard for ML dispatch statistics

---

**Documentation Version**: 1.0  
**Last Updated**: 2025-01-XX  
**Status**: ✅ Complete

