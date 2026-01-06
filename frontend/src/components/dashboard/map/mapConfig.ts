
// Karachi area names for reference
export const karachiAreas = [
  "Gulshan-e-Iqbal", "DHA Phase II", "Clifton", "Korangi", "Saddar",
  "PECHS", "North Nazimabad", "Federal B Area", "Malir", "Landhi"
];

// Fault types for reference
export const faultTypes = [
  { description: "Power outage", severity: "critical" },
  { description: "Transformer failure", severity: "high" },
  { description: "Cable fault", severity: "medium" },
  { description: "Street light repair", severity: "low" },
  { description: "Meter malfunction", severity: "medium" },
  { description: "Underground cable issue", severity: "high" }
];

// Karachi bounds for map initialization
export const KARACHI_BOUNDS = {
  minLat: 24.8,
  maxLat: 24.95,
  minLng: 66.9,
  maxLng: 67.2,
};

// Karachi center coordinates [lat, lng]
// Use coordinateUtils for consistency
export { KARACHI_CENTER } from "./coordinateUtils";

// OSRM API endpoint configuration
export const OSRM_API_URL = 'https://router.project-osrm.org/route/v1/driving';
