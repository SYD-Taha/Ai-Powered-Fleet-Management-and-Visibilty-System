import axios from "axios";
import fs from "fs";

// Nominatim requires proper User-Agent
axios.defaults.headers.common['User-Agent'] = 'FleetManagementSystem/1.0';

// Major Karachi areas with approximate central coordinates
const karachiAreas = [
  // Your existing locations + more detailed ones
  { name: "Gulshan-e-Iqbal Block 1", area: "Gulshan-e-Iqbal", type: "residential" },
  { name: "Gulshan-e-Iqbal Block 2", area: "Gulshan-e-Iqbal", type: "residential" },
  { name: "Gulshan-e-Iqbal Block 3", area: "Gulshan-e-Iqbal", type: "commercial" },
  { name: "Gulshan-e-Iqbal Block 13", area: "Gulshan-e-Iqbal", type: "commercial" },
  { name: "Gulistan-e-Johar Block 11", area: "Gulistan-e-Johar", type: "residential" },
  { name: "Gulistan-e-Johar Block 14", area: "Gulistan-e-Johar", type: "commercial" },
  { name: "Gulzar-e-Hijri Sector 4", area: "Gulzar-e-Hijri", type: "industrial" },
  { name: "Scheme 33 Main Road", area: "Scheme 33", type: "commercial" },
  { name: "Clifton Block 2", area: "Clifton", type: "commercial" },
  { name: "Clifton Block 8", area: "Clifton", type: "residential" },
  { name: "DHA Phase 1", area: "Defence", type: "residential" },
  { name: "DHA Phase 2", area: "Defence", type: "commercial" },
  { name: "DHA Phase 5", area: "Defence", type: "commercial" },
  { name: "DHA Phase 6", area: "Defence", type: "residential" },
  { name: "Korangi Industrial Area", area: "Korangi", type: "industrial" },
  { name: "Korangi Crossing", area: "Korangi", type: "commercial" },
  { name: "North Nazimabad Block A", area: "North Nazimabad", type: "residential" },
  { name: "North Nazimabad Block B", area: "North Nazimabad", type: "commercial" },
  { name: "Malir Cantt", area: "Malir", type: "mixed" },
  { name: "Malir Halt", area: "Malir", type: "industrial" },
  { name: "Saddar Empress Market", area: "Saddar", type: "commercial" },
  { name: "Saddar Merewether Tower", area: "Saddar", type: "commercial" },
  { name: "Lyari Chakiwara", area: "Lyari", type: "residential" },
  { name: "Orangi Town Sector 11", area: "Orangi Town", type: "residential" },
  { name: "Landhi Industrial Area", area: "Landhi", type: "industrial" },
  { name: "Shah Faisal Colony", area: "Shah Faisal", type: "residential" },
  { name: "Jamshed Road", area: "Jamshed Town", type: "commercial" },
  { name: "New Karachi Sector 5", area: "New Karachi", type: "residential" },
  { name: "Surjani Town Sector 5", area: "Surjani Town", type: "residential" },
  { name: "Gadap Town", area: "Gadap", type: "mixed" },
  { name: "Bin Qasim Town", area: "Bin Qasim", type: "industrial" },
  { name: "Baldia Town", area: "Baldia", type: "industrial" },
  { name: "SITE Area", area: "SITE", type: "industrial" },
  { name: "Keamari", area: "Keamari", type: "port" },
  { name: "Jinnah International Airport", area: "Airport", type: "transport" },
  { name: "Bahadurabad Chowrangi", area: "Bahadurabad", type: "commercial" },
  { name: "PECHS Block 2", area: "PECHS", type: "residential" },
  { name: "Federal B Area", area: "Gulberg", type: "commercial" },
  { name: "Nazimabad No 3", area: "Nazimabad", type: "residential" },
  { name: "Tariq Road", area: "PECHS", type: "commercial" },
  { name: "Shahrah-e-Faisal", area: "Central", type: "commercial" },
  { name: "University Road", area: "Gulshan", type: "mixed" },
  { name: "Shaheed-e-Millat Road", area: "Malir", type: "commercial" },
  { name: "Hawksbay Road", area: "Keamari", type: "coastal" },
  { name: "Mauripur Road", area: "Keamari", type: "industrial" },
  { name: "Liaquatabad", area: "Liaquatabad", type: "commercial" },
  { name: "Soldier Bazaar", area: "Jamshed", type: "commercial" },
  { name: "Kharadar", area: "South", type: "commercial" },
  { name: "Garden East", area: "Garden", type: "residential" },
  { name: "Civic Centre", area: "Gulshan", type: "government" }
];

// Function to geocode with delay (respect 1 req/sec limit)
const geocodeLocation = async (locationName) => {
  try {
    await new Promise(resolve => setTimeout(resolve, 1100)); // 1.1 sec delay
    
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: `${locationName}, Karachi, Pakistan`,
        format: 'json',
        limit: 1,
        addressdetails: 1
      }
    });

    if (response.data && response.data.length > 0) {
      const result = response.data[0];
      return {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        display_name: result.display_name,
        osm_type: result.osm_type
      };
    }
    return null;
  } catch (error) {
    console.error(`Error geocoding ${locationName}:`, error.message);
    return null;
  }
};

// Main generation function
const generateLocationDatabase = async () => {
  console.log(`🚀 Starting geocoding for ${karachiAreas.length} locations...`);
  console.log(`⏱️  This will take approximately ${Math.ceil(karachiAreas.length * 1.1 / 60)} minutes\n`);

  const locationDatabase = [];

  for (let i = 0; i < karachiAreas.length; i++) {
    const area = karachiAreas[i];
    console.log(`[${i + 1}/${karachiAreas.length}] Geocoding: ${area.name}...`);

    const geoData = await geocodeLocation(area.name);

    if (geoData) {
      locationDatabase.push({
        id: `LOC_${String(i + 1).padStart(3, '0')}`,
        name: area.name,
        area: area.area,
        type: area.type,
        latitude: geoData.latitude,
        longitude: geoData.longitude,
        display_name: geoData.display_name,
        accessible: true // We'll assume Nominatim results are road-accessible
      });
      console.log(`   ✅ Success: [${geoData.latitude}, ${geoData.longitude}]`);
    } else {
      console.log(`   ❌ Failed to geocode`);
    }
  }

  // Save to file
  const outputPath = './data/karachi-locations.json';
  fs.mkdirSync('./data', { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(locationDatabase, null, 2));

  console.log(`\n✅ Successfully geocoded ${locationDatabase.length} locations`);
  console.log(`📁 Saved to: ${outputPath}`);
  
  // Print statistics
  const byType = locationDatabase.reduce((acc, loc) => {
    acc[loc.type] = (acc[loc.type] || 0) + 1;
    return acc;
  }, {});
  
  console.log('\n📊 Location breakdown by type:');
  Object.entries(byType).forEach(([type, count]) => {
    console.log(`   ${type}: ${count}`);
  });
};

// Run the generator
generateLocationDatabase();