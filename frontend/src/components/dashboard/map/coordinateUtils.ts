// Coordinate Utilities
// Helper functions for coordinate validation, distance calculations, and route interpolation

// Karachi bounds for coordinate validation
export const KARACHI_BOUNDS = {
  minLat: 24.8,
  maxLat: 24.95,
  minLng: 66.9,
  maxLng: 67.2,
  // Simulated coordinate bounds (0-100 for both x and y)
  minX: 0,
  maxX: 100,
  minY: 0,
  maxY: 100
};

// Karachi center (default location)
// Must match backend DEFAULT_LOCATION: { latitude: 24.8607, longitude: 67.0011 }
// Format: [lat, lng]
export const KARACHI_CENTER: [number, number] = [24.8607, 67.0011];

/**
 * Convert simulated x/y coordinates to lat/lng (real GPS coordinates)
 * @param x - Simulated X coordinate (0-100)
 * @param y - Simulated Y coordinate (0-100)
 * @returns [lat, lng] array
 */
export const xyToLatLng = (x: number, y: number): [number, number] => {
  // Normalize x/y to 0-1 range
  const normalizedX = Math.max(0, Math.min(1, (x - KARACHI_BOUNDS.minX) / (KARACHI_BOUNDS.maxX - KARACHI_BOUNDS.minX)));
  const normalizedY = Math.max(0, Math.min(1, (y - KARACHI_BOUNDS.minY) / (KARACHI_BOUNDS.maxY - KARACHI_BOUNDS.minY)));
  
  // Map to Karachi bounds
  const lat = KARACHI_BOUNDS.minLat + (KARACHI_BOUNDS.maxLat - KARACHI_BOUNDS.minLat) * (1 - normalizedY); // Invert Y (top = higher lat)
  const lng = KARACHI_BOUNDS.minLng + (KARACHI_BOUNDS.maxLng - KARACHI_BOUNDS.minLng) * normalizedX;
  
  return [lat, lng];
};

/**
 * Convert lat/lng (real GPS coordinates) to simulated x/y coordinates
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns {x: number, y: number} object
 */
export const latLngToXY = (lat: number, lng: number): { x: number; y: number } => {
  // Normalize lat/lng to 0-1 range within Karachi bounds
  const normalizedLat = (lat - KARACHI_BOUNDS.minLat) / (KARACHI_BOUNDS.maxLat - KARACHI_BOUNDS.minLat);
  const normalizedLng = (lng - KARACHI_BOUNDS.minLng) / (KARACHI_BOUNDS.maxLng - KARACHI_BOUNDS.minLng);
  
  // Map to simulated coordinate bounds (0-100)
  const x = KARACHI_BOUNDS.minX + (KARACHI_BOUNDS.maxX - KARACHI_BOUNDS.minX) * normalizedLng;
  const y = KARACHI_BOUNDS.minY + (KARACHI_BOUNDS.maxY - KARACHI_BOUNDS.minY) * (1 - normalizedLat); // Invert Y (top = higher lat)
  
  return { x, y };
};

/**
 * Validate if coordinates are within Karachi bounds
 */
export const isValidKarachiCoordinate = (lat: number, lng: number): boolean => {
  return (
    lat >= KARACHI_BOUNDS.minLat &&
    lat <= KARACHI_BOUNDS.maxLat &&
    lng >= KARACHI_BOUNDS.minLng &&
    lng <= KARACHI_BOUNDS.maxLng
  );
};

/**
 * Generate random coordinates within Karachi bounds
 */
export const generateRandomKarachiCoordinates = (): [number, number] => {
  const lat = KARACHI_BOUNDS.minLat + Math.random() * (KARACHI_BOUNDS.maxLat - KARACHI_BOUNDS.minLat);
  const lng = KARACHI_BOUNDS.minLng + Math.random() * (KARACHI_BOUNDS.maxLng - KARACHI_BOUNDS.minLng);
  return [lat, lng];
};

/**
 * Calculate Haversine distance between two coordinates (in meters)
 */
export const calculateHaversineDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
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
};

/**
 * Calculate total route distance using waypoints (in meters)
 */
export const calculateRouteDistance = (
  waypoints: [number, number][]
): number => {
  if (waypoints.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    totalDistance += calculateHaversineDistance(
      waypoints[i][0],
      waypoints[i][1],
      waypoints[i + 1][0],
      waypoints[i + 1][1]
    );
  }

  return totalDistance;
};

/**
 * Calculate position along route based on elapsed time and speed
 * @param routeWaypoints Array of [lat, lng] pairs
 * @param routeStartTime Timestamp when route started
 * @param routeTotalDistance Total route distance in meters
 * @param speed Speed in meters per second
 * @returns Current position [lat, lng] or null if route is complete
 */
export const calculatePositionAlongRoute = (
  routeWaypoints: [number, number][],
  routeStartTime: number,
  routeTotalDistance: number,
  speed: number = 16.67 // Default 60 km/h = 16.67 m/s for faster movement
): [number, number] | null => {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/f3c5f085-4d69-4ea3-8402-74e615f8ff4f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'coordinateUtils.ts:92',message:'calculatePositionAlongRoute entry',data:{waypointCount:routeWaypoints?.length,routeStartTime,routeTotalDistance,speed,currentTime:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  if (routeWaypoints.length < 2) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/f3c5f085-4d69-4ea3-8402-74e615f8ff4f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'coordinateUtils.ts:99',message:'insufficient waypoints',data:{waypointCount:routeWaypoints.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    return routeWaypoints[0] || null;
  }

  const elapsedTime = (Date.now() - routeStartTime) / 1000; // in seconds
  const distanceTraveled = elapsedTime * speed; // in meters

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/f3c5f085-4d69-4ea3-8402-74e615f8ff4f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'coordinateUtils.ts:105',message:'distance calculation',data:{elapsedTime:elapsedTime.toFixed(2),distanceTraveled:distanceTraveled.toFixed(2),routeTotalDistance,remainingDistance:(routeTotalDistance-distanceTraveled).toFixed(2),isComplete:distanceTraveled>=routeTotalDistance},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  // If we've traveled the full distance, return the destination
  if (distanceTraveled >= routeTotalDistance) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/f3c5f085-4d69-4ea3-8402-74e615f8ff4f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'coordinateUtils.ts:108',message:'route complete - returning destination',data:{distanceTraveled:distanceTraveled.toFixed(2),routeTotalDistance,destination:routeWaypoints[routeWaypoints.length-1]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    return routeWaypoints[routeWaypoints.length - 1];
  }

  // Calculate which segment we're on and interpolate position
  let accumulatedDistance = 0;
  let totalWaypointDistance = 0; // Track sum of Haversine distances
  
  for (let i = 0; i < routeWaypoints.length - 1; i++) {
    const segmentStart = routeWaypoints[i];
    const segmentEnd = routeWaypoints[i + 1];
    
    const segmentDistance = calculateHaversineDistance(
      segmentStart[0],
      segmentStart[1],
      segmentEnd[0],
      segmentEnd[1]
    );
    totalWaypointDistance += segmentDistance;

    if (accumulatedDistance + segmentDistance >= distanceTraveled) {
      // We're on this segment
      const distanceOnSegment = distanceTraveled - accumulatedDistance;
      const t = distanceOnSegment / segmentDistance; // 0 to 1
      
      // Interpolate between segment start and end
      const lat = segmentStart[0] + (segmentEnd[0] - segmentStart[0]) * t;
      const lng = segmentStart[1] + (segmentEnd[1] - segmentStart[1]) * t;
      
      // #region agent log
      if (i === 0 || i % 10 === 0) { // Log every 10th segment to avoid spam
        fetch('http://127.0.0.1:7242/ingest/f3c5f085-4d69-4ea3-8402-74e615f8ff4f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'coordinateUtils.ts:125',message:'position calculated on segment',data:{segmentIndex:i,totalSegments:routeWaypoints.length-1,accumulatedDistance:accumulatedDistance.toFixed(2),distanceOnSegment:distanceOnSegment.toFixed(2),segmentDistance:segmentDistance.toFixed(2),t:t.toFixed(3),calculatedPos:[lat,lng]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      }
      // #endregion
      
      return [lat, lng];
    }

    accumulatedDistance += segmentDistance;
  }

  // Fallback: return destination
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/f3c5f085-4d69-4ea3-8402-74e615f8ff4f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'coordinateUtils.ts:140',message:'fallback to destination',data:{accumulatedDistance:accumulatedDistance.toFixed(2),totalWaypointDistance:totalWaypointDistance.toFixed(2),distanceTraveled:distanceTraveled.toFixed(2),routeTotalDistance,distanceMismatch:(routeTotalDistance-totalWaypointDistance).toFixed(2),mismatchPercent:((routeTotalDistance-totalWaypointDistance)/routeTotalDistance*100).toFixed(2)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  return routeWaypoints[routeWaypoints.length - 1];
};

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

