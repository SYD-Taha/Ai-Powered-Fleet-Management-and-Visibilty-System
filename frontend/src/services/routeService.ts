// Route Service
// Calculates routes between coordinates using backend API (which proxies OSRM)
// This avoids CORS issues by routing requests through our backend

import API from './api';

interface RouteResult {
  waypoints: [number, number][]; // [lat, lng] pairs
  distance: number; // in meters
  duration: number; // in seconds
  isFallback?: boolean;
  calculatedAt?: number; // timestamp
  source?: 'osrm' | 'haversine';
}

// Cache for routes to avoid excessive API calls
// TTL: 5 minutes (routes don't change frequently)
interface CacheEntry {
  data: RouteResult;
  timestamp: number;
}
const routeCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Calculate route between two coordinates using OSRM
 * @param fromLat Starting latitude
 * @param fromLng Starting longitude
 * @param toLat Destination latitude
 * @param toLng Destination longitude
 * @returns Route with waypoints, distance, and duration
 */
export const calculateRoute = async (
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<RouteResult> => {
  // Create cache key
  const cacheKey = `${fromLat},${fromLng}-${toLat},${toLng}`;
  
  // Check cache first (with TTL check)
  const cached = routeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    // Use backend API to avoid CORS issues
    // Backend will proxy the request to OSRM
    const response = await API.get('/api/routes/calculate', {
      params: {
        fromLat: fromLat.toString(),
        fromLng: fromLng.toString(),
        toLat: toLat.toString(),
        toLng: toLng.toString()
      }
    });

    const result: RouteResult = {
      waypoints: response.data.waypoints,
      distance: response.data.distance,
      duration: response.data.duration,
      isFallback: response.data.isFallback || false,
      calculatedAt: response.data.calculatedAt || Date.now(),
      source: response.data.source || 'osrm'
    };

    // Cache the result with timestamp
    routeCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    return result;
  } catch (error) {
    console.error('Error calculating route:', error);
    
    // Fallback: return straight-line route if OSRM fails
    const fallbackDistance = calculateHaversineDistance(fromLat, fromLng, toLat, toLng);
    const fallbackDuration = (fallbackDistance / 11.11); // 40 km/h = 11.11 m/s
    
    return {
      waypoints: [[fromLat, fromLng], [toLat, toLng]],
      distance: fallbackDistance,
      duration: fallbackDuration,
      isFallback: true,
      calculatedAt: Date.now(),
      source: 'haversine'
    };
  }
};

/**
 * Calculate Haversine distance between two coordinates (in meters)
 */
function calculateHaversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Clear the route cache
 */
export const clearRouteCache = () => {
  routeCache.clear();
};

/**
 * Clear expired entries from route cache
 */
export const clearExpiredRouteCache = () => {
  const now = Date.now();
  for (const [key, value] of routeCache.entries()) {
    if (now - value.timestamp >= CACHE_TTL) {
      routeCache.delete(key);
    }
  }
};

