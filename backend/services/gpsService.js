/**
 * Centralized GPS Data Retrieval Service
 * Provides consistent GPS data access with unified fallback strategy
 */

import mongoose from "mongoose";
import GPS from "../models/GPS.js";
import cache from "./cacheService.js";
import logger from "./logger.js";
import { isValidCoordinate, isValidKarachiCoordinate } from "../utils/coordinateUtils.js";

// Default location: Karachi center (used as fallback for missing GPS data)
// This must match the frontend default location
export const DEFAULT_LOCATION = { latitude: 24.8607, longitude: 67.0011 };

// Cache TTL for GPS data (5 seconds - GPS updates frequently)
const GPS_CACHE_TTL = 5;

/**
 * Get latest GPS coordinates for a single vehicle
 * @param {string|ObjectId} vehicleId - Vehicle ID
 * @param {boolean} useDefault - If true, return default location if GPS not found (default: true)
 * @returns {Promise<Object>} { latitude, longitude, timestamp } or default location
 */
export const getLatestGPS = async (vehicleId, useDefault = true) => {
  try {
    const vehicleIdObj = typeof vehicleId === 'string' 
      ? vehicleId 
      : vehicleId.toString();
    
    const cacheKey = `vehicle:${vehicleIdObj}:gps:latest`;
    
    // Try to get from cache
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Query database - FIX: Use vehicleIdObj or convert to ObjectId
    const queryVehicleId = typeof vehicleId === 'string' 
      ? new mongoose.Types.ObjectId(vehicleId) 
      : vehicleId;
    const point = await GPS.findOne({ vehicle: queryVehicleId })
      .sort({ timestamp: -1 })
      .select('latitude longitude timestamp')
      .lean();
    
    let result;
    
    if (point && point.latitude != null && point.longitude != null) {
      // Validate coordinates
      if (!isValidCoordinate(point.latitude, point.longitude)) {
        logger.warn("Invalid GPS coordinates in database, using default", {
          vehicleId: vehicleIdObj,
          latitude: point.latitude,
          longitude: point.longitude
        });
        if (useDefault) {
          result = {
            latitude: DEFAULT_LOCATION.latitude,
            longitude: DEFAULT_LOCATION.longitude,
            timestamp: null
          };
        } else {
          return null;
        }
      } else {
        // Check GPS freshness (warn if > 5 minutes old)
        const gpsAge = point.timestamp ? (Date.now() - new Date(point.timestamp).getTime()) / (1000 * 60) : Infinity;
        if (gpsAge > 5) {
          logger.warn("GPS data is stale", {
            vehicleId: vehicleIdObj,
            ageMinutes: gpsAge.toFixed(1)
          });
        }
        
        result = {
          latitude: point.latitude,
          longitude: point.longitude,
          timestamp: point.timestamp
        };
      }
    } else if (useDefault) {
      logger.debug("GPS data not found, using default location", {
        vehicleId: vehicleIdObj
      });
      result = {
        latitude: DEFAULT_LOCATION.latitude,
        longitude: DEFAULT_LOCATION.longitude,
        timestamp: null
      };
    } else {
      return null;
    }
    
    // Cache the result
    if (result) {
      cache.set(cacheKey, result, GPS_CACHE_TTL);
    }
    
    return result;
  } catch (error) {
    logger.error("Error fetching GPS data", {
      vehicleId: vehicleId?.toString(),
      error: error.message,
      stack: error.stack
    });
    
    if (useDefault) {
      return {
        latitude: DEFAULT_LOCATION.latitude,
        longitude: DEFAULT_LOCATION.longitude,
        timestamp: null
      };
    }
    return null;
  }
};

/**
 * Get latest GPS coordinates for multiple vehicles in a single batch query
 * @param {Array} vehicleIds - Array of vehicle ObjectIds
 * @param {boolean} useDefault - If true, use default location for missing GPS (default: true)
 * @returns {Promise<Map>} Map of vehicleId (string) -> { latitude, longitude, timestamp }
 */
export const getLatestGPSBatch = async (vehicleIds, useDefault = true) => {
  try {
    if (!vehicleIds || vehicleIds.length === 0) {
      return new Map();
    }

    logger.debug("Fetching GPS data for vehicles (batch)", { 
      vehicleCount: vehicleIds.length 
    });

    // Get latest GPS for each vehicle using aggregation
    const latestGPS = await GPS.aggregate([
      { $match: { vehicle: { $in: vehicleIds } } },
      { $sort: { vehicle: 1, timestamp: -1 } },
      {
        $group: {
          _id: "$vehicle",
          latitude: { $first: "$latitude" },
          longitude: { $first: "$longitude" },
          timestamp: { $first: "$timestamp" }
        }
      }
    ]);

    // Create Map<vehicleId (string), { latitude, longitude, timestamp }>
    const gpsMap = new Map();
    
    // Initialize map with all vehicleIds
    vehicleIds.forEach(id => {
      const idStr = id.toString();
      if (useDefault) {
        gpsMap.set(idStr, {
          latitude: DEFAULT_LOCATION.latitude,
          longitude: DEFAULT_LOCATION.longitude,
          timestamp: null
        });
      }
    });
    
    // Populate with actual GPS data where available
    latestGPS.forEach(gps => {
      const vehicleIdStr = gps._id.toString();
      if (gps.latitude != null && gps.longitude != null) {
        // Validate coordinates
        if (isValidCoordinate(gps.latitude, gps.longitude)) {
          gpsMap.set(vehicleIdStr, {
            latitude: gps.latitude,
            longitude: gps.longitude,
            timestamp: gps.timestamp
          });
        } else {
          logger.warn("Invalid GPS coordinates in batch, using default", {
            vehicleId: vehicleIdStr,
            latitude: gps.latitude,
            longitude: gps.longitude
          });
          // Keep default location that was set in initialization
        }
      } else if (useDefault) {
        // Already set to default in initialization
        logger.warn("GPS data found but coordinates are null", {
          vehicleId: vehicleIdStr,
          timestamp: gps.timestamp
        });
      }
    });

    const vehiclesWithGPS = latestGPS.filter(g => 
      g.latitude != null && g.longitude != null
    ).length;
    const vehiclesWithoutGPS = vehicleIds.length - vehiclesWithGPS;
    
    if (vehiclesWithoutGPS > 0 && useDefault) {
      logger.debug("Some vehicles missing GPS data, using default location", {
        vehiclesWithoutGPS,
        defaultLocation: DEFAULT_LOCATION
      });
    }

    return gpsMap;
  } catch (error) {
    logger.error("Error fetching GPS data batch", {
      vehicleCount: vehicleIds.length,
      error: error.message,
      stack: error.stack
    });
    
    // Return map with default locations for all vehicles on error
    if (useDefault) {
      const fallbackMap = new Map();
      vehicleIds.forEach(id => {
        fallbackMap.set(id.toString(), {
          latitude: DEFAULT_LOCATION.latitude,
          longitude: DEFAULT_LOCATION.longitude,
          timestamp: null
        });
      });
      return fallbackMap;
    }
    return new Map();
  }
};

/**
 * Check if GPS data is fresh (within specified minutes)
 * @param {Object} gpsData - GPS data object with timestamp
 * @param {number} maxAgeMinutes - Maximum age in minutes (default: 5)
 * @returns {boolean} True if GPS data is fresh
 */
export const isGPSFresh = (gpsData, maxAgeMinutes = 5) => {
  if (!gpsData || !gpsData.timestamp) {
    return false;
  }
  
  const ageMs = Date.now() - new Date(gpsData.timestamp).getTime();
  const ageMinutes = ageMs / (1000 * 60);
  
  return ageMinutes <= maxAgeMinutes;
};

