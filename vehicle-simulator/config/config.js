export default {
    // Backend API
    BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:5000',
    AUTH_TOKEN: process.env.AUTH_TOKEN || '',
    
    // Authentication credentials for auto-login (optional - only needed if AUTH_TOKEN not provided)
    AUTH_EMAIL: process.env.AUTH_EMAIL || '',
    AUTH_PASSWORD: process.env.AUTH_PASSWORD || '',
  
    // MQTT Settings
    MQTT_BROKER: process.env.MQTT_BROKER || '84837c1224714acc85e9e0935388600d.s1.eu.hivemq.cloud',
    MQTT_PORT: parseInt(process.env.MQTT_PORT) || 8883,
    MQTT_USERNAME: process.env.MQTT_USERNAME || 'taha_user',
    MQTT_PASSWORD: process.env.MQTT_PASSWORD || 'Strongpassword123',
  
    // Simulation Settings
    GPS_UPDATE_INTERVAL: 3000, // 3 seconds
    DISPATCH_CHECK_INTERVAL: 5000, // 5 seconds - poll backend for AI dispatch assignments
    AVERAGE_SPEED: 40, // km/h
    WORK_TIME_MIN: 1, // minutes - minimum time at fault location
    WORK_TIME_MAX: 2, // minutes - maximum time at fault location
  
    // Depot Locations (where vehicles start/return)
    DEPOTS: [
      { name: 'North Depot', lat: 24.9361, lng: 67.0369 }, // North Nazimabad
      { name: 'Central Depot', lat: 24.8607, lng: 67.0011 }, // Saddar
      { name: 'East Depot', lat: 24.9194, lng: 67.0931 }, // Gulshan
      { name: 'Industrial Depot', lat: 24.8789, lng: 67.0644 } // SITE Area
    ],
  
    // Vehicle IDs (your 13 vehicles)
    VEHICLE_COUNT: 13
  };