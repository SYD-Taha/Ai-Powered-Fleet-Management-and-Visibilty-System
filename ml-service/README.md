# ML Dispatch Service

Machine Learning microservice for intelligent vehicle dispatch decisions. This service provides a REST API for predicting the best vehicle to dispatch based on multiple factors.

## Features

- **Model Training**: Train RandomForest models with synthetic data
- **Prediction API**: Predict best vehicle from candidate list
- **Health Checks**: Monitor service and model status
- **Model Management**: Get model information and retrain on demand

## Project Structure

```
ml-service/
├── app/
│   ├── main.py                 # FastAPI application
│   ├── models/
│   │   └── dispatch_model.py  # Model loading and prediction
│   ├── services/
│   │   └── training_service.py # Training logic
│   └── schemas/
│       └── dispatch_schemas.py # API request/response models
├── scripts/
│   └── train_model.py          # Standalone training script
├── models/
│   └── dispatch_ml_model.pkl  # Trained model (generated)
├── requirements.txt
├── Dockerfile
└── README.md
```

## Installation

### Local Development

1. **Create virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Train initial model:**
   ```bash
   python scripts/train_model.py
   ```

5. **Run the service:**
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

### Docker

```bash
docker build -t ml-dispatch-service .
docker run -p 8000:8000 ml-dispatch-service
```

## API Endpoints

### Health Check

```http
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "model_loaded": true,
  "model_features": 6
}
```

### Model Information

```http
GET /api/model/info
```

**Response:**
```json
{
  "loaded": true,
  "features": ["distance_m", "distance_cat", "past_perf", "fault_history", "fatigue_h", "fault_severity"],
  "n_features": 6,
  "model_type": "RandomForestRegressor",
  "model_info": {
    "n_estimators": 200,
    "mae": 2.345,
    "r2": 0.987
  }
}
```

### Predict Best Vehicle

```http
POST /api/predict
Content-Type: application/json

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

**Response:**
```json
{
  "best_index": 0,
  "scores": [85.3, 72.1],
  "predictions": [
    {
      "index": 0,
      "score": 85.3,
      "features": {...}
    },
    {
      "index": 1,
      "score": 72.1,
      "features": {...}
    }
  ]
}
```

### Train Model

```http
POST /api/train
Content-Type: application/json

{
  "n_samples": 3000,
  "random_seed": 42
}
```

**Response:**
```json
{
  "success": true,
  "mae": 2.345,
  "r2": 0.987,
  "model_path": "models/dispatch_ml_model.pkl",
  "features": ["distance_m", "distance_cat", ...],
  "n_samples": 3000,
  "random_seed": 42
}
```

## Model Features

The model uses 6 features:

1. **distance_m** (float): Distance to fault in meters
2. **distance_cat** (int): Distance category (0: <1000m, 1: <5000m, 2: >=5000m)
3. **past_perf** (float): Past performance score (1-10 scale)
4. **fault_history** (int): Count of similar fault types handled
5. **fatigue_h** (float): Crew fatigue in hours (0-24)
6. **fault_severity** (int): Fault severity (1=Low, 2=Medium, 3=High)

## Training Script

Train a model using the standalone script:

```bash
python scripts/train_model.py --n-samples 3000 --random-seed 42
```

Options:
- `--n-samples`: Number of synthetic samples (default: 3000)
- `--random-seed`: Random seed for reproducibility (default: 42)
- `--model-path`: Path to save model (default: models/dispatch_ml_model.pkl)

## Integration with Node.js

The service is designed to be called from the Node.js backend. Example integration:

```javascript
const axios = require('axios');

async function predictBestVehicle(candidates) {
  try {
    const response = await axios.post('http://ml-service:8000/api/predict', {
      candidates: candidates
    });
    return response.data;
  } catch (error) {
    console.error('ML service error:', error);
    // Fallback to rule-based dispatch
    return null;
  }
}
```

## Environment Variables

- `PORT`: Server port (default: 8000)
- `MODEL_PATH`: Path to model file (optional)
- `LOG_LEVEL`: Logging level (default: INFO)

## Development

### Running Tests

```bash
# Install test dependencies
pip install pytest pytest-asyncio httpx

# Run tests
pytest
```

### Code Style

```bash
pip install black flake8
black app/
flake8 app/
```

## Performance

- **Model Loading**: ~100-200ms (one-time, on service start)
- **Single Prediction**: ~5-20ms
- **Batch Prediction (10 candidates)**: ~10-50ms
- **Total API Call**: <100ms target

## Troubleshooting

### Model Not Found

If you see "Model not available", train a model first:

```bash
python scripts/train_model.py
```

Or use the training API endpoint.

### Port Already in Use

Change the port in `.env` or use:

```bash
uvicorn app.main:app --port 8001
```

## License

ISC

