"""
Pydantic schemas for API requests and responses
"""

from typing import List, Optional
from pydantic import BaseModel, Field

class CandidateRequest(BaseModel):
    """Single candidate vehicle for dispatch"""
    distance_m: float = Field(..., description="Distance to fault in meters", ge=0)
    distance_cat: int = Field(..., description="Distance category (0, 1, or 2)", ge=0, le=2)
    past_perf: float = Field(..., description="Past performance score (1-10)", ge=1, le=10)
    fault_history: int = Field(..., description="Count of similar faults handled", ge=0)
    fatigue_h: float = Field(..., description="Fatigue in hours (0-24)", ge=0, le=24)
    fault_severity: int = Field(..., description="Fault severity (1=Low, 2=Medium, 3=High)", ge=1, le=3)

class PredictRequest(BaseModel):
    """Request for prediction endpoint"""
    candidates: List[CandidateRequest] = Field(..., description="List of candidate vehicles", min_items=1)

class PredictionResult(BaseModel):
    """Single prediction result"""
    index: int
    score: float
    features: dict

class PredictResponse(BaseModel):
    """Response from prediction endpoint"""
    best_index: int
    scores: List[float]
    predictions: List[PredictionResult]

class TrainRequest(BaseModel):
    """Request for training endpoint"""
    n_samples: Optional[int] = Field(3000, description="Number of synthetic samples", ge=100, le=100000)
    random_seed: Optional[int] = Field(42, description="Random seed for reproducibility")

class TrainResponse(BaseModel):
    """Response from training endpoint"""
    success: bool
    mae: Optional[float] = None
    r2: Optional[float] = None
    model_path: Optional[str] = None
    features: Optional[List[str]] = None
    n_samples: Optional[int] = None
    random_seed: Optional[int] = None
    error: Optional[str] = None

class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    model_loaded: bool
    model_features: Optional[int] = None
    error: Optional[str] = None

class ModelInfoResponse(BaseModel):
    """Model information response"""
    loaded: bool
    features: Optional[List[str]] = None
    n_features: Optional[int] = None
    model_type: Optional[str] = None
    model_info: Optional[dict] = None
    model_path: Optional[str] = None
    error: Optional[str] = None

