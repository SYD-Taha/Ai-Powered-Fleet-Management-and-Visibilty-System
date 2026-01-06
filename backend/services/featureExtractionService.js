/**
 * Feature Extraction Service for ML Dispatch Engine
 * Extracts features from vehicles and faults for ML model prediction
 */

import { calculateRoute, isCircuitBreakerOpen, calculateDistance as haversineDistance } from "./routingService.js";
import { getLatestGPSBatch, DEFAULT_LOCATION } from "./gpsService.js";
import logger from "./logger.js";

/**
 * Calculate distance between two GPS points using routing service
 * Falls back to straight-line distance if routing service fails or circuit is open
 * @param {Object} vehicleGPS - { latitude, longitude }
 * @param {Object} faultGPS - { latitude, longitude }
 * @param {boolean} skipOSRM - If true, skip OSRM and use Haversine directly
 * @returns {Promise<number>} Distance in meters
 */
async function calculateDistance(vehicleGPS, faultGPS, skipOSRM = false) {
  // If circuit breaker is open or explicitly skipping OSRM, use Haversine directly
  if (skipOSRM || isCircuitBreakerOpen()) {
    return haversineDistance(
      vehicleGPS.latitude,
      vehicleGPS.longitude,
      faultGPS.latitude,
      faultGPS.longitude
    );
  }
  
  try {
    // Try routing service first
    const route = await calculateRoute(
      { lat: vehicleGPS.latitude, lng: vehicleGPS.longitude },
      { lat: faultGPS.latitude, lng: faultGPS.longitude }
    );
    return route.distance; // Already in meters
  } catch (error) {
    // Fallback: calculate straight-line distance using Haversine formula
    return haversineDistance(
      vehicleGPS.latitude,
      vehicleGPS.longitude,
      faultGPS.latitude,
      faultGPS.longitude
    );
  }
}


/**
 * Get latest GPS coordinates for multiple vehicles in a single batch query
 * Uses centralized GPS service for consistency
 * @param {Array} vehicleIds - Array of vehicle ObjectIds
 * @returns {Promise<Map>} Map of vehicleId (string) -> { latitude, longitude }
 */
export async function getVehicleGPSBatch(vehicleIds) {
  // Use centralized GPS service
  const gpsMap = await getLatestGPSBatch(vehicleIds, true);
  
  // Convert to format expected by feature extraction (remove timestamp)
  const resultMap = new Map();
  gpsMap.forEach((gps, vehicleId) => {
    resultMap.set(vehicleId, {
      latitude: gps.latitude,
      longitude: gps.longitude
    });
  });
  
  return resultMap;
}

/**
 * Extract ML features for multiple vehicles in batch
 * @param {Array} vehicles - Array of vehicle objects (same order as candidates sent to ML)
 * @param {Object} fault - Fault object with fault_type, category, latitude, longitude
 * @param {Object} systemData - Object containing:
 *   - performanceMap: Map<vehicleId, performance ratio (0-1)>
 *   - fatigueMap: Map<vehicleId, fatigue count>
 *   - faultHistoryMap: Map<vehicleId, fault history count>
 * @param {Map} vehicleGPSMap - Pre-fetched GPS map from getVehicleGPSBatch
 * @returns {Promise<Array>} Array of feature objects (one per vehicle, same order)
 */
export async function extractMLFeaturesBatch(vehicles, fault, systemData, vehicleGPSMap) {
  try {
    if (!vehicles || vehicles.length === 0) {
      return [];
    }

    const { performanceMap, fatigueMap, faultHistoryMap } = systemData;
    
    // Get fault GPS coordinates (with default fallback)
    const faultGPS = {
      latitude: fault.latitude ?? DEFAULT_LOCATION.latitude,
      longitude: fault.longitude ?? DEFAULT_LOCATION.longitude
    };

    if (!fault.latitude || !fault.longitude) {
      logger.warn("Fault missing GPS coordinates, using default location", {
        faultId: fault._id,
        defaultLocation: DEFAULT_LOCATION
      });
    }

    logger.debug("Extracting ML features for vehicles", {
      vehicleCount: vehicles.length,
      faultId: fault._id,
      faultType: fault.fault_type
    });

    // Check circuit breaker status - if open, skip OSRM entirely for all vehicles
    const circuitOpen = isCircuitBreakerOpen();
    if (circuitOpen) {
      logger.debug("Circuit breaker is open, using Haversine distance for all vehicles", {
        vehicleCount: vehicles.length
      });
    }

    // Calculate distances in parallel with concurrency limit
    const CONCURRENCY_LIMIT = 10;
    const distanceResults = [];
    
    // Process in batches to control concurrency
    for (let i = 0; i < vehicles.length; i += CONCURRENCY_LIMIT) {
      const batch = vehicles.slice(i, i + CONCURRENCY_LIMIT);
      const batchPromises = batch.map(async (vehicle, batchIndex) => {
        const index = i + batchIndex;
        const vehicleIdStr = vehicle._id.toString();
        const vehicleGPS = vehicleGPSMap.get(vehicleIdStr) || DEFAULT_LOCATION;
        
        // Skip OSRM if circuit breaker is open (much faster)
        const distance = await calculateDistance(vehicleGPS, faultGPS, circuitOpen);
        return { index, distance };
      });
      
      const batchResults = await Promise.all(batchPromises);
      distanceResults.push(...batchResults);
    }
    
    // Create distance map by index
    const distanceMap = new Map();
    distanceResults.forEach(result => {
      distanceMap.set(result.index, result.distance);
    });

    // Extract features for all vehicles
    const features = vehicles.map((vehicle, index) => {
      const vehicleIdStr = vehicle._id.toString();
      const distance_m = distanceMap.get(index) || 0;
      
      // Extract features
      return {
        distance_m: Math.round(distance_m), // Round to nearest meter
        distance_cat: distance_m < 1000 ? 0 : (distance_m < 5000 ? 1 : 2),
        past_perf: ((performanceMap.get(vehicleIdStr) || 0.5) * 10).toFixed(2),
        fault_history: faultHistoryMap.get(vehicleIdStr) || 0,
        fatigue_h: Math.min((fatigueMap.get(vehicleIdStr) || 0) * 2, 24),
        fault_severity: fault.category === "High" ? 3 : (fault.category === "Medium" ? 2 : 1)
      };
    });

    logger.debug("ML features extracted successfully", {
      featureCount: features.length,
      sampleFeature: features[0]
    });

    return features;
  } catch (error) {
    logger.error("Error extracting ML features batch", {
      vehicleCount: vehicles?.length || 0,
      faultId: fault?._id,
      error: error.message,
      stack: error.stack
    });
    throw error; // Re-throw to trigger fallback in dispatch function
  }
}

