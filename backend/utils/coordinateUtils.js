/**
 * Coordinate Format Conversion Utilities
 * Provides consistent coordinate format conversion across the system
 */

/**
 * Convert coordinates to OSRM API format [lng, lat]
 * @param {Object|Array} coords - { lat, lng } object or [lat, lng] array
 * @returns {Array} [lng, lat] array for OSRM API
 */
export const toOSRMFormat = (coords) => {
  if (Array.isArray(coords)) {
    // Assume [lat, lng] format
    return [coords[1], coords[0]];
  }
  // Assume { lat, lng } object
  return [coords.lng, coords.lat];
};

/**
 * Convert coordinates from OSRM API format [lng, lat] to standard format
 * @param {Array} coords - [lng, lat] array from OSRM
 * @param {string} format - 'object' or 'array' (default: 'array')
 * @returns {Object|Array} { lat, lng } object or [lat, lng] array
 */
export const fromOSRMFormat = (coords, format = 'array') => {
  const [lng, lat] = coords;
  if (format === 'object') {
    return { lat, lng };
  }
  return [lat, lng];
};

/**
 * Convert waypoints from OSRM format to frontend format
 * OSRM returns: [[lng, lat], [lng, lat], ...]
 * Frontend expects: [[lat, lng], [lat, lng], ...]
 * @param {Array} osrmWaypoints - Array of [lng, lat] coordinates
 * @returns {Array} Array of [lat, lng] coordinates
 */
export const convertWaypointsToFrontendFormat = (osrmWaypoints) => {
  if (!Array.isArray(osrmWaypoints)) {
    return [];
  }
  return osrmWaypoints.map(coord => [coord[1], coord[0]]); // Swap lng/lat to lat/lng
};

/**
 * Validate coordinate values
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {boolean} True if coordinates are valid
 */
export const isValidCoordinate = (lat, lng) => {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !isNaN(lat) &&
    !isNaN(lng)
  );
};

/**
 * Validate coordinates within Karachi bounds
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {boolean} True if coordinates are within Karachi bounds
 */
export const isValidKarachiCoordinate = (lat, lng) => {
  if (!isValidCoordinate(lat, lng)) {
    return false;
  }
  // Karachi bounds
  return (
    lat >= 24.8 &&
    lat <= 24.95 &&
    lng >= 66.9 &&
    lng <= 67.2
  );
};


