import axios from 'axios';

const OSRM_BASE_URL = 'http://router.project-osrm.org';
const routeCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes (matching backend)

// Generate cache key (matching backend format - no toFixed)
const getCacheKey = (start, end) => {
  return `${start.lat},${start.lng}_${end.lat},${end.lng}`;
};

export const calculateRoute = async (start, end) => {
  try {
    const cacheKey = getCacheKey(start, end);
    const cached = routeCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    const url = `${OSRM_BASE_URL}/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}`;
    
    const response = await axios.get(url, {
      params: {
        overview: 'full',
        geometries: 'geojson'
      },
      timeout: 10000
    });

    if (response.data.code !== 'Ok') {
      throw new Error(`OSRM error: ${response.data.code}`);
    }

    const route = response.data.routes[0];
    
    // Convert waypoints from OSRM format [lng, lat] to [lat, lng] arrays (matching backend)
    const waypoints = route.geometry.coordinates.map(coord => [coord[1], coord[0]]); // [lat, lng]
    
    const routeData = {
      distance: route.distance, // meters (OSRM returns meters)
      duration: route.duration, // seconds
      waypoints: waypoints, // Array of [lat, lng] pairs (matching backend format)
      summary: `${(route.distance / 1000).toFixed(1)} km, ${Math.ceil(route.duration / 60)} min`,
      isFallback: false,
      calculatedAt: Date.now(),
      source: 'osrm'
    };

    routeCache.set(cacheKey, {
      data: routeData,
      timestamp: Date.now()
    });

    return routeData;

  } catch (error) {
    console.error('❌ Routing error:', error.message);
    return createStraightLineRoute(start, end);
  }
};

const createStraightLineRoute = (start, end) => {
  // Calculate distance in meters (matching backend - R = 6371000)
  const distance = calculateDistance(start.lat, start.lng, end.lat, end.lng);
  
  // Estimate duration (assuming average 40 km/h = 11.11 m/s in city, matching backend)
  const duration = distance / 11.11; // seconds
  
  return {
    distance: distance, // meters (already in meters, don't multiply)
    duration: duration, // seconds
    waypoints: [
      [start.lat, start.lng], // [lat, lng] format (matching backend)
      [end.lat, end.lng]
    ],
    summary: `${(distance / 1000).toFixed(1)} km (straight line), ~${Math.ceil(duration / 60)} min`,
    isFallback: true,
    calculatedAt: Date.now(),
    source: 'haversine'
  };
};

/**
 * Calculate straight-line distance using Haversine formula
 * @returns {number} Distance in meters (matching backend)
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Earth's radius in meters (matching backend)
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Returns meters (matching backend)
};

const toRad = (degrees) => degrees * (Math.PI / 180);

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
  return ((bearing * 180) / Math.PI + 360) % 360;
};

export { calculateDistance };