"""
Training Service
Handles model training logic
"""

import sys
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

# Lazy import to avoid import-time errors
_train_model = None

def _get_train_model():
    """Lazy import of train_model function"""
    global _train_model
    if _train_model is None:
        # Add scripts directory to path
        scripts_path = Path(__file__).parent.parent.parent / 'scripts'
        if str(scripts_path) not in sys.path:
            sys.path.insert(0, str(scripts_path))
        from train_model import train_model as tm
        _train_model = tm
    return _train_model

class TrainingService:
    """Service for training dispatch models"""
    
    def __init__(self, model_path: str = None):
        self.model_path = model_path
        self._training_in_progress = False
    
    def train(self, n_samples: int = 3000, random_seed: int = 42) -> dict:
        """
        Train a new model
        
        Args:
            n_samples: Number of synthetic samples
            random_seed: Random seed for reproducibility
            
        Returns:
            Training results dictionary
        """
        if self._training_in_progress:
            raise RuntimeError("Training already in progress")
        
        try:
            self._training_in_progress = True
            logger.info(f"Starting model training with {n_samples} samples")
            
            # Lazy import train_model function
            train_model_func = _get_train_model()
            
            result = train_model_func(
                n_samples=n_samples,
                random_seed=random_seed,
                model_path=self.model_path
            )
            
            logger.info(f"Training completed. MAE: {result['mae']:.3f}, R2: {result['r2']:.3f}")
            
            return {
                'success': True,
                'mae': result['mae'],
                'r2': result['r2'],
                'model_path': result['model_path'],
                'features': result['features'],
                'n_samples': n_samples,
                'random_seed': random_seed
            }
            
        except Exception as e:
            logger.error(f"Training failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
        finally:
            self._training_in_progress = False
    
    def is_training(self) -> bool:
        """Check if training is in progress"""
        return self._training_in_progress

# Global training service instance
_training_service: TrainingService = None

def get_training_service(model_path: str = None) -> TrainingService:
    """Get or create training service instance"""
    global _training_service
    if _training_service is None:
        _training_service = TrainingService(model_path)
    return _training_service

