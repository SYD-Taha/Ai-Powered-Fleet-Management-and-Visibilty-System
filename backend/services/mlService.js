/**
 * ML Service Client
 * Handles communication with the ML Dispatch microservice
 */

import axios from 'axios';
import logger from './logger.js';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';
const ML_SERVICE_TIMEOUT = parseInt(process.env.ML_SERVICE_TIMEOUT || '5000', 10);
const ML_SERVICE_ENABLED = process.env.ML_SERVICE_ENABLED !== 'false'; // Default to true

// Create axios instance with timeout
const mlClient = axios.create({
  baseURL: ML_SERVICE_URL,
  timeout: ML_SERVICE_TIMEOUT,
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * Check if ML service is available
 */
export const isMLServiceAvailable = async () => {
  if (!ML_SERVICE_ENABLED) {
    return false;
  }

  try {
    const response = await mlClient.get('/api/health');
    return response.data.status === 'healthy' && response.data.model_loaded === true;
  } catch (error) {
    logger.warn('ML service health check failed', { error: error.message });
    return false;
  }
};

/**
 * Predict best vehicle from candidates using ML model
 * @param {Array} candidates - Array of candidate objects with ML features
 * @returns {Promise<Object|null>} Prediction result or null if service unavailable
 */
export const predictBestVehicle = async (candidates) => {
  if (!ML_SERVICE_ENABLED) {
    logger.debug('ML service disabled, skipping prediction');
    return null;
  }

  if (!candidates || candidates.length === 0) {
    logger.warn('No candidates provided for ML prediction');
    return null;
  }

  try {
    // Validate and format candidates
    const formattedCandidates = candidates.map((candidate, index) => {
      // Ensure all required features are present
      const requiredFeatures = ['distance_m', 'distance_cat', 'past_perf', 'fault_history', 'fatigue_h', 'fault_severity'];
      const missing = requiredFeatures.filter(f => candidate[f] === undefined || candidate[f] === null);
      
      if (missing.length > 0) {
        throw new Error(`Missing required features: ${missing.join(', ')}`);
      }

      const formatted = {
        distance_m: parseFloat(candidate.distance_m),
        distance_cat: parseInt(candidate.distance_cat, 10),
        past_perf: parseFloat(candidate.past_perf),
        fault_history: parseInt(candidate.fault_history, 10),
        fatigue_h: parseFloat(candidate.fatigue_h),
        fault_severity: parseInt(candidate.fault_severity, 10)
      };

      // Validate for NaN values and log which field is problematic
      const validationErrors = [];
      if (isNaN(formatted.distance_m) || formatted.distance_m < 0) {
        validationErrors.push(`distance_m: ${candidate.distance_m} -> ${formatted.distance_m}`);
      }
      if (isNaN(formatted.distance_cat) || formatted.distance_cat < 0 || formatted.distance_cat > 2) {
        validationErrors.push(`distance_cat: ${candidate.distance_cat} -> ${formatted.distance_cat}`);
      }
      if (isNaN(formatted.past_perf) || formatted.past_perf < 1 || formatted.past_perf > 10) {
        validationErrors.push(`past_perf: ${candidate.past_perf} -> ${formatted.past_perf}`);
      }
      if (isNaN(formatted.fault_history) || formatted.fault_history < 0) {
        validationErrors.push(`fault_history: ${candidate.fault_history} -> ${formatted.fault_history}`);
      }
      if (isNaN(formatted.fatigue_h) || formatted.fatigue_h < 0 || formatted.fatigue_h > 24) {
        validationErrors.push(`fatigue_h: ${candidate.fatigue_h} -> ${formatted.fatigue_h}`);
      }
      if (isNaN(formatted.fault_severity) || formatted.fault_severity < 1 || formatted.fault_severity > 3) {
        validationErrors.push(`fault_severity: ${candidate.fault_severity} -> ${formatted.fault_severity}`);
      }

      if (validationErrors.length > 0) {
        logger.error('Invalid candidate values detected', {
          candidateIndex: index,
          originalCandidate: candidate,
          formattedCandidate: formatted,
          validationErrors
        });
        throw new Error(`Invalid candidate values at index ${index}: ${validationErrors.join(', ')}`);
      }

      return formatted;
    });

    logger.debug('Calling ML service for prediction', { 
      candidateCount: formattedCandidates.length,
      sampleCandidate: formattedCandidates[0]
    });

    const response = await mlClient.post('/api/predict', {
      candidates: formattedCandidates
    });

    const result = response.data;

    logger.info('ML prediction successful', {
      bestIndex: result.best_index,
      scores: result.scores,
      candidateCount: formattedCandidates.length
    });

    return {
      bestIndex: result.best_index,
      bestScore: result.scores[result.best_index],
      scores: result.scores,
      predictions: result.predictions
    };

  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      logger.warn('ML service unavailable, will use rule-based dispatch', { error: error.message });
    } else if (error.response) {
      logger.error('ML service error response', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        // Log the candidates that were sent if it's a 422 error
        ...(error.response.status === 422 && {
          candidatesSent: candidates,
          formattedCandidates: candidates.map(c => ({
            distance_m: parseFloat(c.distance_m),
            distance_cat: parseInt(c.distance_cat, 10),
            past_perf: parseFloat(c.past_perf),
            fault_history: parseInt(c.fault_history, 10),
            fatigue_h: parseFloat(c.fatigue_h),
            fault_severity: parseInt(c.fault_severity, 10)
          }))
        })
      });
    } else {
      logger.error('ML service request failed', { 
        error: error.message,
        stack: error.stack
      });
    }
    return null;
  }
};

/**
 * Get ML model information
 */
export const getMLModelInfo = async () => {
  if (!ML_SERVICE_ENABLED) {
    return null;
  }

  try {
    const response = await mlClient.get('/api/model/info');
    return response.data;
  } catch (error) {
    logger.warn('Failed to get ML model info', { error: error.message });
    return null;
  }
};

/**
 * Train/retrain ML model
 * @param {Object} options - Training options
 * @param {number} options.n_samples - Number of synthetic samples (default: 3000)
 * @param {number} options.random_seed - Random seed (default: 42)
 */
export const trainMLModel = async (options = {}) => {
  if (!ML_SERVICE_ENABLED) {
    logger.warn('ML service disabled, cannot train model');
    return null;
  }

  try {
    const response = await mlClient.post('/api/train', {
      n_samples: options.n_samples || 3000,
      random_seed: options.random_seed || 42
    });

    logger.info('ML model training completed', {
      success: response.data.success,
      mae: response.data.mae,
      r2: response.data.r2
    });

    return response.data;
  } catch (error) {
    logger.error('ML model training failed', { error: error.message });
    return null;
  }
};

export default {
  isMLServiceAvailable,
  predictBestVehicle,
  getMLModelInfo,
  trainMLModel
};

