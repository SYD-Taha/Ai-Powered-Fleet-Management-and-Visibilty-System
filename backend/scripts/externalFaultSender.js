import axios from "axios";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Backend endpoint
const BACKEND_FAULT_API = process.env.BACKEND_FAULT_API || "http://localhost:5000/api/faults";
const token = process.env.TEST_AUTH_TOKEN || "";

if (token) {
  axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  console.log("🔐 Using authentication token");
} else {
  console.warn("⚠️  No TEST_AUTH_TOKEN set - requests may fail if API requires auth");
}

// Load location database
let locationDatabase = [];
const locationsPath = path.join(__dirname, './data/karachi-locations.json');
try {
  const locationsData = fs.readFileSync(locationsPath, 'utf8');
  locationDatabase = JSON.parse(locationsData);
  console.log(`✅ Loaded ${locationDatabase.length} locations from database`);
} catch (error) {
  console.error("❌ Failed to load location database:", error.message);
  console.error("   Path attempted:", locationsPath);
  process.exit(1);
}

// Predefined fault types
const faultTypes = [
  "Power Failure",
  "Communication Error",
  "Overheating",
  "Hydraulic Leak",
  "Sensor Malfunction",
  "Cooling System Fault",
  "Pressure Drop",
  "Low Voltage",
  "Mechanical Jam",
  "Unexpected Shutdown"
];

const categories = ["High", "Medium", "Low"];

// Even distribution logic
let locationIndex = 0;

const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

let shuffledLocations = shuffleArray(locationDatabase);

const getNextLocation = () => {
  const location = shuffledLocations[locationIndex];
  locationIndex = (locationIndex + 1) % shuffledLocations.length;
  
  if (locationIndex === 0) {
    console.log("🔄 Cycled through all locations, reshuffling...");
    shuffledLocations = shuffleArray(locationDatabase);
  }
  
  return location;
};

// Function to send a single fault
const sendFault = async () => {
  try {
    const location = getNextLocation();
    const faultType = faultTypes[Math.floor(Math.random() * faultTypes.length)];
    const category = categories[Math.floor(Math.random() * categories.length)];

    const faultData = {
      fault_type: faultType,
      fault_location: location.name,
      category: category,
      latitude: location.latitude,
      longitude: location.longitude,
      detail: `Auto-generated fault detected: ${faultType} at ${location.name} (${category} severity).`,
      area: location.area,
      location_type: location.type
    };

    const response = await axios.post(BACKEND_FAULT_API, faultData);

    console.log(`✅ Fault sent: ${faultType} at ${location.name} [${category}]`);
    console.log(`   📍 Coordinates: [${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}]`);
    console.log(`   🏙️  Area: ${location.area} (${location.type})`);
    console.log(`   Response:`, response.data.message || response.data);
  } catch (err) {
    console.error("❌ Failed to send fault:", err.response?.data || err.message);
  }
};

// Start sending faults
sendFault();
setInterval(sendFault, 60000); // 1 minute = 60000 milliseconds

console.log("🚀 External Fault Sender started... Sending faults every 1 minute.");
console.log(`📊 Statistics:`);
console.log(`   Total locations in database: ${locationDatabase.length}`);
console.log(`   Fault types available: ${faultTypes.length}`);
console.log(`   Will cycle through all locations evenly\n`);


