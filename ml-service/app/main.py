"""
FastAPI Application for ML Dispatch Service
"""

import os
import logging
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.models.dispatch_model import get_model
from app.services.training_service import get_training_service
from app.schemas.dispatch_schemas import (
    PredictRequest, PredictResponse, PredictionResult,
    TrainRequest, TrainResponse,
    HealthResponse, ModelInfoResponse
)

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="ML Dispatch Service",
    description="Machine Learning service for intelligent vehicle dispatch decisions",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Get model path from environment
MODEL_PATH = os.getenv('MODEL_PATH', None)
if MODEL_PATH:
    MODEL_PATH = Path(MODEL_PATH)

# Initialize model and training service
model = get_model(str(MODEL_PATH) if MODEL_PATH else None)
training_service = get_training_service(str(MODEL_PATH) if MODEL_PATH else None)

# Try to load model immediately (synchronously) on startup
logger.info("Initializing ML Dispatch Service...")
if model.load():
    logger.info("Model loaded successfully on initialization")
else:
    logger.warning("Model not available on initialization. Use /api/train to generate model.")

@app.on_event("startup")
async def startup_event():
    """Startup event - model should already be loaded"""
    logger.info("ML Dispatch Service started")
    if not model.is_loaded():
        logger.warning("Model not loaded on startup. Attempting to load...")
        if model.load():
            logger.info("Model loaded successfully on startup")
        else:
            logger.error("Failed to load model on startup. Check model file path and permissions.")

@app.get("/", tags=["Root"])
async def root():
    """Root endpoint"""
    return {
        "service": "ML Dispatch Service",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/api/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Health check endpoint"""
    try:
        model_info = model.get_info()
        return HealthResponse(
            status="healthy",
            model_loaded=model_info.get('loaded', False),
            model_features=model_info.get('n_features', None),
            error=model_info.get('error', None)
        )
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return HealthResponse(
            status="unhealthy",
            model_loaded=False,
            error=str(e)
        )

@app.get("/api/model/info", response_model=ModelInfoResponse, tags=["Model"])
async def get_model_info():
    """Get model information"""
    try:
        info = model.get_info()
        return ModelInfoResponse(**info)
    except Exception as e:
        logger.error(f"Error getting model info: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.post("/api/predict", response_model=PredictResponse, tags=["Prediction"])
async def predict(request: PredictRequest):
    """
    Predict best vehicle from candidates
    
    Returns the index of the best candidate and scores for all candidates.
    """
    try:
        # Convert Pydantic models to dicts
        candidates = [candidate.dict() for candidate in request.candidates]
        
        # Get predictions
        best_idx, scores, predictions = model.predict(candidates)
        
        # Convert predictions to response format
        prediction_results = [
            PredictionResult(**pred) for pred in predictions
        ]
        
        return PredictResponse(
            best_index=best_idx,
            scores=[round(score, 2) for score in scores],
            predictions=prediction_results
        )
        
    except ValueError as e:
        logger.error(f"Validation error in prediction: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except RuntimeError as e:
        logger.error(f"Model error in prediction: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Model not available: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Unexpected error in prediction: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Prediction failed: {str(e)}"
        )

@app.post("/api/train", response_model=TrainResponse, tags=["Training"])
async def train(request: TrainRequest):
    """
    Train a new model
    
    This will regenerate the model with the specified parameters.
    Note: Training may take some time depending on n_samples.
    """
    if training_service.is_training():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Training already in progress"
        )
    
    try:
        logger.info(f"Training request received: n_samples={request.n_samples}, seed={request.random_seed}")
        
        result = training_service.train(
            n_samples=request.n_samples,
            random_seed=request.random_seed
        )
        
        if result['success']:
            # Reset and reload model after training
            global model
            model = get_model(str(MODEL_PATH) if MODEL_PATH else None, reset=True)
            model.load(force_reload=True)
            
            return TrainResponse(**result)
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result.get('error', 'Training failed')
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Training error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Training failed: {str(e)}"
        )

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv('PORT', 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)

