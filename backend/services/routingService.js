import axios from "axios";
import { convertWaypointsToFrontendFormat } from "../utils/coordinateUtils.js";
import cache from "./cacheService.js";
import logger from "./logger.js";

// OSRM public API base URL
const OSRM_BASE_URL = "http://router.project-osrm.org";

// Cache TTL: 5 minutes for routes (routes don't change frequently)
const ROUTE_CACHE_TTL = 5 * 60; // 5 minutes in seconds

// Circuit breaker configuration
const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 3,        // Open circuit after 3 consecutive failures
  recoveryTimeout: 60000,     // Try again after 60 seconds
  halfOpenMaxAttempts: 1       // Allow 1 attempt in half-open state
};

// Circuit breaker state
let circuitState = {
  status: 'closed',            // 'closed' | 'open' | 'half-open'
  failureCount: 0,
  lastFailureTime: null,
  lastSuccessTime: null,
  halfOpenAttempts: 0
};

// Route calculation metrics
const metrics = {
  totalCalculations: 0,
  cacheHits: 0,
  cacheMisses: 0,
  osrmSuccess: 0,
  fallbackUsed: 0,
  circuitBreakerSkips: 0,     // Count of requests skipped due to open circuit
  totalCalculationTime: 0,
  averageCalculationTime: 0
};

// Generate cache key
const getCacheKey = (start, end) => {
  return `${start.lat},${start.lng}_${end.lat},${end.lng}`;
};

/**
 * Circuit breaker: Check if OSRM should be attempted
 * @returns {boolean} True if OSRM should be tried, false if circuit is open
 */
const shouldAttemptOSRM = () => {
  const now = Date.now();
  
  // Circuit is closed - allow requests
  if (circuitState.status === 'closed') {
    return true;
  }
  
  // Circuit is open - check if recovery timeout has passed
  if (circuitState.status === 'open') {
    const timeSinceLastFailure = now - circuitState.lastFailureTime;
    if (timeSinceLastFailure >= CIRCUIT_BREAKER_CONFIG.recoveryTimeout) {
      // Move to half-open state
      circuitState.status = 'half-open';
      circuitState.halfOpenAttempts = 0;
      logger.info("Circuit breaker: Moving to half-open state", {
        timeSinceLastFailure: `${Math.round(timeSinceLastFailure / 1000)}s`
      });
      return true;
    }
    return false; // Still in open state, skip OSRM
  }
  
  // Circuit is half-open - allow limited attempts
  if (circuitState.status === 'half-open') {
    if (circuitState.halfOpenAttempts < CIRCUIT_BREAKER_CONFIG.halfOpenMaxAttempts) {
      return true;
    }
    // Too many attempts in half-open, go back to open
    circuitState.status = 'open';
    circuitState.lastFailureTime = now;
    logger.warn("Circuit breaker: Half-open attempts exceeded, moving back to open");
    return false;
  }
  
  return true; // Default: allow attempt
};

/**
 * Circuit breaker: Record OSRM success
 */
const recordOSRMSuccess = () => {
  if (circuitState.status === 'half-open') {
    // Success in half-open state - close the circuit
    circuitState.status = 'closed';
    circuitState.failureCount = 0;
    circuitState.halfOpenAttempts = 0;
    circuitState.lastSuccessTime = Date.now();
    logger.info("Circuit breaker: OSRM recovered, circuit closed");
  } else if (circuitState.status === 'closed') {
    // Reset failure count on success
    circuitState.failureCount = 0;
    circuitState.lastSuccessTime = Date.now();
  }
};

/**
 * Circuit breaker: Record OSRM failure
 */
const recordOSRMFailure = () => {
  circuitState.failureCount++;
  circuitState.lastFailureTime = Date.now();
  
  if (circuitState.status === 'half-open') {
    // Failure in half-open - go back to open
    circuitState.status = 'open';
    circuitState.halfOpenAttempts = 0;
    logger.warn("Circuit breaker: Failure in half-open state, circuit opened");
  } else if (circuitState.failureCount >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
    // Too many failures - open the circuit
    circuitState.status = 'open';
    logger.warn("Circuit breaker: Circuit opened due to consecutive failures", {
      failureCount: circuitState.failureCount,
      threshold: CIRCUIT_BREAKER_CONFIG.failureThreshold
    });
  }
};

/**
 * Get route calculation metrics
 * @returns {Object} Current metrics
 */
export const getRouteMetrics = () => {
  return {
    ...metrics,
    cacheHitRatio: metrics.totalCalculations > 0 
      ? (metrics.cacheHits / metrics.totalCalculations * 100).toFixed(2) + '%'
      : '0%',
    fallbackRatio: metrics.totalCalculations > 0
      ? (metrics.fallbackUsed / metrics.totalCalculations * 100).toFixed(2) + '%'
      : '0%',
    averageCalculationTime: metrics.totalCalculations > 0
      ? (metrics.totalCalculationTime / metrics.totalCalculations).toFixed(2) + 'ms'
      : '0ms',
    circuitBreaker: {
      status: circuitState.status,
      failureCount: circuitState.failureCount,
      lastFailureTime: circuitState.lastFailureTime,
      lastSuccessTime: circuitState.lastSuccessTime
    }
  };
};

/**
 * Reset route calculation metrics
 */
export const resetRouteMetrics = () => {
  metrics.totalCalculations = 0;
  metrics.cacheHits = 0;
  metrics.cacheMisses = 0;
  metrics.osrmSuccess = 0;
  metrics.fallbackUsed = 0;
  metrics.circuitBreakerSkips = 0;
  metrics.totalCalculationTime = 0;
  metrics.averageCalculationTime = 0;
  logger.info("Route metrics reset");
};

/**
 * Reset circuit breaker (for testing/recovery)
 */
export const resetCircuitBreaker = () => {
  circuitState = {
    status: 'closed',
    failureCount: 0,
    lastFailureTime: null,
    lastSuccessTime: null,
    halfOpenAttempts: 0
  };
  logger.info("Circuit breaker reset to closed state");
};

/**
 * Calculate route between two points using OSRM
 * @param {Object} start - {lat, lng}
 * @param {Object} end - {lat, lng}
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Route data with waypoints, distance, duration
 */
export const calculateRoute = async (start, end, options = {}) => {
  const startTime = Date.now();
  metrics.totalCalculations++;
  
  try {
    // Check cache first using centralized cache service
    const cacheKey = `route:${getCacheKey(start, end)}`;
    const cached = cache.get(cacheKey);
    
    if (cached) {
      metrics.cacheHits++;
      const calculationTime = Date.now() - startTime;
      metrics.totalCalculationTime += calculationTime;
      logger.debug("Route cache hit", { 
        cacheKey, 
        distance: cached.distance,
        calculationTime: calculationTime + 'ms'
      });
      return cached;
    }
    
    metrics.cacheMisses++;

    // Check circuit breaker - skip OSRM if circuit is open
    if (!shouldAttemptOSRM()) {
      metrics.circuitBreakerSkips++;
      logger.debug("Circuit breaker: Skipping OSRM, using fallback", {
        status: circuitState.status,
        failureCount: circuitState.failureCount
      });
      // Skip directly to fallback
      throw new Error("Circuit breaker: OSRM unavailable");
    }

    // Build OSRM request URL
    const url = `${OSRM_BASE_URL}/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}`;
    
    const params = {
      overview: 'full', // Get full route geometry
      geometries: 'geojson', // Return as GeoJSON
      steps: options.steps || false, // Include turn-by-turn steps
      annotations: options.annotations || false // Include additional data
    };

    console.log(`🗺️  Calculating route: [${start.lat}, ${start.lng}] → [${end.lat}, ${end.lng}]`);

    // Reduced timeout: 3 seconds (was 10s) for faster fallback
    const response = await axios.get(url, { params, timeout: 3000 });

    if (response.data.code !== 'Ok') {
      throw new Error(`OSRM error: ${response.data.code}`);
    }

    const route = response.data.routes[0];
    
    // Convert waypoints from OSRM format [lng, lat] to frontend format [lat, lng]
    const waypoints = convertWaypointsToFrontendFormat(route.geometry.coordinates);
    
    const routeData = {
      distance: route.distance, // meters
      duration: route.duration, // seconds
      geometry: route.geometry, // GeoJSON LineString (keep original for reference)
      waypoints: waypoints, // Array of [lat, lng] pairs for frontend
      legs: route.legs,
      summary: `${(route.distance / 1000).toFixed(1)} km, ${Math.ceil(route.duration / 60)} min`,
      isFallback: false,
      calculatedAt: Date.now(),
      source: 'osrm'
    };

    // Cache the result using centralized cache service
    cache.set(cacheKey, routeData, ROUTE_CACHE_TTL);
    
    const calculationTime = Date.now() - startTime;
    metrics.totalCalculationTime += calculationTime;
    metrics.osrmSuccess++;
    
    // Record success in circuit breaker
    recordOSRMSuccess();
    
    // Increment half-open attempts if in half-open state
    if (circuitState.status === 'half-open') {
      circuitState.halfOpenAttempts++;
    }
    
    logger.info("Route calculated and cached", { 
      cacheKey, 
      distance: routeData.distance, 
      duration: routeData.duration,
      waypointCount: routeData.waypoints.length,
      source: routeData.source,
      calculationTime: calculationTime + 'ms'
    });
    
    return routeData;

  } catch (error) {
    // Record failure in circuit breaker (only if we actually attempted OSRM)
    if (error.message !== "Circuit breaker: OSRM unavailable") {
      recordOSRMFailure();
    }
    
    logger.error("Routing error, falling back to straight-line", { 
      error: error.message,
      start: `${start.lat},${start.lng}`,
      end: `${end.lat},${end.lng}`,
      circuitStatus: circuitState.status,
      failureCount: circuitState.failureCount
    });
    
    // Return straight-line fallback if OSRM fails
    const fallbackRoute = createStraightLineRoute(start, end);
    metrics.fallbackUsed++;
    
    const calculationTime = Date.now() - startTime;
    metrics.totalCalculationTime += calculationTime;
    
    // Cache fallback route too (shorter TTL: 1 minute)
    const cacheKey = `route:${getCacheKey(start, end)}`;
    cache.set(cacheKey, fallbackRoute, 60); // 1 minute for fallback routes
    
    logger.info("Fallback route created", {
      cacheKey,
      distance: fallbackRoute.distance,
      calculationTime: calculationTime + 'ms',
      source: 'haversine'
    });
    
    return fallbackRoute;
  }
};

/**
 * Fallback: Create a simple straight-line route
 */
const createStraightLineRoute = (start, end) => {
  // Calculate approximate straight-line distance (already in meters)
  const distance = calculateDistance(start.lat, start.lng, end.lat, end.lng);
  
  // Estimate duration (assuming average 40 km/h = 11.11 m/s in city)
  const duration = distance / 11.11; // seconds
  
  return {
    distance: distance, // already in meters
    duration: duration,
    geometry: {
      type: 'LineString',
      coordinates: [[start.lng, start.lat], [end.lng, end.lat]]
    },
    waypoints: [
      [start.lat, start.lng], // [lat, lng] format for frontend
      [end.lat, end.lng]
    ],
    legs: [],
    summary: `${(distance / 1000).toFixed(1)} km (straight line), ~${Math.ceil(duration / 60)} min`,
    isFallback: true,
    calculatedAt: Date.now(),
    source: 'haversine'
  };
};

/**
 * Calculate straight-line distance using Haversine formula
 * @returns {number} Distance in meters
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Returns meters
};

const toRad = (degrees) => degrees * (Math.PI / 180);

/**
 * Calculate bearing between two points (for vehicle orientation)
 */
export const calculateBearing = (start, end) => {
  const startLat = toRad(start.lat);
  const startLng = toRad(start.lng);
  const endLat = toRad(end.lat);
  const endLng = toRad(end.lng);

  const dLng = endLng - startLng;

  const y = Math.sin(dLng) * Math.cos(endLat);
  const x =
    Math.cos(startLat) * Math.sin(endLat) -
    Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);

  const bearing = Math.atan2(y, x);
  return ((bearing * 180) / Math.PI + 360) % 360; // Convert to degrees (0-360)
};

/**
 * Interpolate waypoints for smooth animation
 * @param {Array} waypoints - Array of [lat, lng] coordinate pairs
 * @param {Number} pointsPerSegment - Number of interpolation points between waypoints
 * @returns {Array} Array of [lat, lng] coordinate pairs
 */
export const interpolateWaypoints = (waypoints, pointsPerSegment = 10) => {
  if (waypoints.length < 2) return waypoints;

  const interpolated = [];

  for (let i = 0; i < waypoints.length - 1; i++) {
    const start = waypoints[i]; // [lat, lng]
    const end = waypoints[i + 1]; // [lat, lng]

    for (let j = 0; j < pointsPerSegment; j++) {
      const ratio = j / pointsPerSegment;
      interpolated.push([
        start[0] + (end[0] - start[0]) * ratio, // lat
        start[1] + (end[1] - start[1]) * ratio  // lng
      ]);
    }
  }

  // Add final point
  interpolated.push(waypoints[waypoints.length - 1]);

  return interpolated;
};

/**
 * Clear route cache (using centralized cache service)
 */
export const clearRouteCache = () => {
  // Clear all route cache entries
  const deleted = cache.delPattern('route:*');
  logger.info("Route cache cleared", { deletedCount: deleted });
  return deleted;
};

/**
 * Check if circuit breaker is open (OSRM unavailable)
 * @returns {boolean} True if circuit is open, false otherwise
 */
export const isCircuitBreakerOpen = () => {
  return circuitState.status === 'open';
};

/**
 * Get circuit breaker status
 * @returns {Object} Circuit breaker state
 */
export const getCircuitBreakerStatus = () => {
  return {
    status: circuitState.status,
    failureCount: circuitState.failureCount,
    lastFailureTime: circuitState.lastFailureTime,
    lastSuccessTime: circuitState.lastSuccessTime
  };
};

// Export for testing
export { calculateDistance };