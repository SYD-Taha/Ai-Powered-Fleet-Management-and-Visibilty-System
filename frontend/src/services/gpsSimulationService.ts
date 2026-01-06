// GPS Simulation Service
// Simulates vehicle movement along routes and sends GPS updates to backend

const BACKEND_API_URL = 'http://localhost:5000/api/gps';

// Realistic speed range for city driving (50-70 km/h = 13.89-19.44 m/s)
const MIN_SPEED_MS = 13.89; // 50 km/h
const MAX_SPEED_MS = 19.44; // 70 km/h
const DEFAULT_SPEED_MS = 16.67; // 60 km/h for faster, more visible movement

/**
 * Calculate current position along route based on elapsed time and speed
 * @param routeWaypoints Array of [lat, lng] pairs representing the route
 * @param routeStartTime Timestamp when route started
 * @param routeTotalDistance Total route distance in meters
 * @returns Current position [lat, lng] or null if route is complete
 */
export const calculateCurrentPosition = (
  routeWaypoints: [number, number][],
  routeStartTime: number,
  routeTotalDistance: number
): [number, number] | null => {
  if (routeWaypoints.length < 2) {
    return routeWaypoints[0] || null;
  }

  const elapsedTime = (Date.now() - routeStartTime) / 1000; // in seconds
  const speed = DEFAULT_SPEED_MS; // meters per second
  const distanceTraveled = elapsedTime * speed; // in meters

  // If we've traveled the full distance, return the destination
  if (distanceTraveled >= routeTotalDistance) {
    return routeWaypoints[routeWaypoints.length - 1];
  }

  // Calculate which segment we're on and interpolate position
  let accumulatedDistance = 0;
  
  for (let i = 0; i < routeWaypoints.length - 1; i++) {
    const segmentStart = routeWaypoints[i];
    const segmentEnd = routeWaypoints[i + 1];
    
    const segmentDistance = calculateHaversineDistance(
      segmentStart[0],
      segmentStart[1],
      segmentEnd[0],
      segmentEnd[1]
    );

    if (accumulatedDistance + segmentDistance >= distanceTraveled) {
      // We're on this segment
      const distanceOnSegment = distanceTraveled - accumulatedDistance;
      const t = distanceOnSegment / segmentDistance; // 0 to 1
      
      // Interpolate between segment start and end
      const lat = segmentStart[0] + (segmentEnd[0] - segmentStart[0]) * t;
      const lng = segmentStart[1] + (segmentEnd[1] - segmentStart[1]) * t;
      
      return [lat, lng];
    }

    accumulatedDistance += segmentDistance;
  }

  // Fallback: return destination
  return routeWaypoints[routeWaypoints.length - 1];
};

/**
 * Send GPS update to backend API
 * @param vehicleId Vehicle ID
 * @param latitude Current latitude
 * @param longitude Current longitude
 * @param speed Current speed in km/h
 */
export const sendGPSUpdate = async (
  vehicleId: string,
  latitude: number,
  longitude: number,
  speed: number = 40 // Default 40 km/h
): Promise<void> => {
  // Validate vehicle ID before sending
  if (!vehicleId || vehicleId.trim() === '') {
    console.warn('Skipping GPS update: Invalid or empty vehicle ID');
    return;
  }

  // Validate coordinates
  if (typeof latitude !== 'number' || typeof longitude !== 'number' || 
      isNaN(latitude) || isNaN(longitude)) {
    console.warn('Skipping GPS update: Invalid coordinates', { latitude, longitude, vehicleId });
    return;
  }

  try {
    const response = await fetch(BACKEND_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vehicle: vehicleId,
        latitude,
        longitude,
        speed,
      }),
    });

    if (!response.ok) {
      // Get the actual error message from the response
      let errorMessage = response.statusText;
      let errorDetails = null;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
        errorDetails = errorData.details || null;
      } catch (e) {
        // If response is not JSON, use statusText
      }
      
      console.warn(
        `Failed to send GPS update for vehicle ${vehicleId}: ${errorMessage}`,
        errorDetails ? { details: errorDetails } : ''
      );
    }
  } catch (error) {
    console.error(`Error sending GPS update for vehicle ${vehicleId}:`, error);
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

