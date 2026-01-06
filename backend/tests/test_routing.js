import { calculateRoute, calculateBearing, interpolateWaypoints } from '../services/routingService.js';

// Test with real Karachi coordinates
const testRouting = async () => {
  console.log('🧪 Testing OSRM Routing Service\n');

  // Test 1: Route from Gulshan to Clifton
  console.log('Test 1: Gulshan-e-Iqbal to Clifton');
  const route1 = await calculateRoute(
    { lat: 24.9194, lng: 67.0931 }, // Gulshan
    { lat: 24.8138, lng: 67.0281 }  // Clifton
  );
  console.log('Result:', route1.summary);
  console.log('Waypoints:', route1.waypoints.length);
  console.log('');

  // Test 2: Route from DHA to Saddar
  console.log('Test 2: DHA to Saddar');
  const route2 = await calculateRoute(
    { lat: 24.8293, lng: 67.0635 }, // DHA
    { lat: 24.8607, lng: 67.0011 }  // Saddar
  );
  console.log('Result:', route2.summary);
  console.log('');

  // Test 3: Bearing calculation
  console.log('Test 3: Bearing from North Nazimabad to Airport');
  const bearing = calculateBearing(
    { lat: 24.9361, lng: 67.0369 }, // North Nazimabad
    { lat: 24.9056, lng: 67.1608 }  // Airport
  );
  console.log('Bearing:', bearing.toFixed(2), 'degrees');
  console.log('');

  // Test 4: Waypoint interpolation
  console.log('Test 4: Waypoint interpolation');
  // FIX: interpolateWaypoints now expects arrays, not objects
  const simpleWaypoints = [
    [24.9194, 67.0931], // [lat, lng]
    [24.8607, 67.0011]  // [lat, lng]
  ];
  const interpolated = interpolateWaypoints(simpleWaypoints, 5);
  console.log('Original waypoints:', simpleWaypoints.length);
  console.log('Interpolated waypoints:', interpolated.length);
  console.log('');

  console.log('✅ All tests completed!');
};

testRouting();