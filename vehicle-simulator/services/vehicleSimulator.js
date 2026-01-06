import config from '../config/config.js';
import apiClient from './apiClient.js';
import mqttPublisher from './mqttPublisher.js';
import { calculateRoute, calculateBearing, calculateDistance } from './routingService.js';

class VehicleSimulator {
  constructor() {
    this.vehicles = new Map();
    this.running = false;
    this.processedFaults = new Set(); // Track faults we've already started processing
  }

  async initialize() {
    console.log('🚀 Initializing Vehicle Simulator...\n');

    // Attempt automatic login if credentials are provided
    const loginSuccess = await apiClient.autoLogin();
    if (!loginSuccess && !config.AUTH_TOKEN) {
      console.warn('⚠️  No authentication token configured. Vehicle status updates may fail if backend requires authentication.');
      console.warn('   To enable auto-login, set AUTH_EMAIL and AUTH_PASSWORD in environment variables or .env file.');
    }

    // Connect to MQTT
    await mqttPublisher.connect();

    // Fetch vehicles from backend
    const vehicleData = await apiClient.getVehicles();
    
    if (!vehicleData || vehicleData.length === 0) {
      throw new Error('No vehicles found in database!');
    }

    console.log(`✅ Found ${vehicleData.length} vehicles in database\n`);

    // Initialize each vehicle with GPS position from backend or depot fallback
    vehicleData.forEach((vehicle, index) => {
      const depot = config.DEPOTS[index % config.DEPOTS.length];
      
      // Use GPS position from backend if available, otherwise use depot
      const initialLat = vehicle.latitude || depot.lat;
      const initialLng = vehicle.longitude || depot.lng;
      const locationSource = vehicle.latitude && vehicle.longitude ? 'GPS' : depot.name;
      
      // Normalize vehicle ID to string for consistent Map key
      const vehicleId = vehicle._id ? vehicle._id.toString() : vehicle.id?.toString();
      if (!vehicleId) {
        console.warn(`⚠️  Vehicle ${vehicle.vehicle_number} has no ID, skipping`);
        return;
      }

      this.vehicles.set(vehicleId, {
        id: vehicleId,
        vehicle_number: vehicle.vehicle_number,
        status: vehicle.status || 'available',
        currentLat: initialLat,
        currentLng: initialLng,
        depotLat: depot.lat,
        depotLng: depot.lng,
        depotName: depot.name,
        assignedFault: null,
        currentRoute: null,
        waypointIndex: 0,
        speed: vehicle.speed || 0
      });

      console.log(`🚗 ${vehicle.vehicle_number}: Positioned at ${locationSource} [${initialLat.toFixed(4)}, ${initialLng.toFixed(4)}]`);
    });

    // Initialize processed faults set
    this.processedFaults = new Set();

    console.log('\n✅ All vehicles initialized\n');
    this.running = true;
  }

  async start() {
    console.log('▶️  Starting simulation loops...\n');

    // Main GPS update loop (every 3 seconds)
    setInterval(() => this.updateAllVehicles(), config.GPS_UPDATE_INTERVAL);

    // Dispatch polling loop (every 5 seconds) - polls backend for AI dispatch assignments
    setInterval(() => this.checkForDispatches(), config.DISPATCH_CHECK_INTERVAL);

    console.log('✅ Simulator is now running!\n');
  }

  async updateAllVehicles() {
    for (const [vehicleId, vehicle] of this.vehicles) {
      if (vehicle.status === 'onRoute' && vehicle.currentRoute) {
        await this.moveVehicleAlongRoute(vehicle);
      }
    }
  }

  async moveVehicleAlongRoute(vehicle) {
    const route = vehicle.currentRoute;
    
    if (vehicle.waypointIndex >= route.waypoints.length) {
      // Reached destination
      await this.handleArrival(vehicle);
      return;
    }

    // Get current and next waypoint
    const currentWaypoint = route.waypoints[vehicle.waypointIndex];
    
    // Update vehicle position
    vehicle.currentLat = currentWaypoint.lat;
    vehicle.currentLng = currentWaypoint.lng;

    // Calculate speed and heading
    if (vehicle.waypointIndex < route.waypoints.length - 1) {
      const nextWaypoint = route.waypoints[vehicle.waypointIndex + 1];
      vehicle.speed = config.AVERAGE_SPEED;
      vehicle.heading = calculateBearing(
        { lat: currentWaypoint.lat, lng: currentWaypoint.lng },
        { lat: nextWaypoint.lat, lng: nextWaypoint.lng }
      );
    }

    // Publish GPS via MQTT
    mqttPublisher.publishGPS(vehicle.vehicle_number, {
      latitude: vehicle.currentLat,
      longitude: vehicle.currentLng,
      speed: vehicle.speed,
      heading: vehicle.heading
    });

    // Send to backend API
    await apiClient.sendGPS(vehicle.id, {
      latitude: vehicle.currentLat,
      longitude: vehicle.currentLng,
      speed: vehicle.speed,
      heading: vehicle.heading
    });

    // Move to next waypoint
    vehicle.waypointIndex++;

    // Log progress every 10 waypoints
    if (vehicle.waypointIndex % 10 === 0) {
      const progress = ((vehicle.waypointIndex / route.waypoints.length) * 100).toFixed(0);
      console.log(`🚗 ${vehicle.vehicle_number}: ${progress}% to destination`);
    }
  }

  async handleArrival(vehicle) {
    console.log(`🎯 ${vehicle.vehicle_number}: Arrived at fault location!`);

    // Update status to working
    vehicle.status = 'working';
    vehicle.speed = 0;
    
    // Update backend status with retry logic
    let statusUpdateSuccess = false;
    let retries = 0;
    const maxRetries = 3;
    
    while (!statusUpdateSuccess && retries < maxRetries) {
      try {
        statusUpdateSuccess = await apiClient.updateVehicleStatus(vehicle.id, 'working');
        if (statusUpdateSuccess) {
          console.log(`✅ ${vehicle.vehicle_number}: Status updated to working in backend`);
        } else {
          retries++;
          if (retries < maxRetries) {
            console.warn(`⚠️ ${vehicle.vehicle_number}: Status update failed, retrying (${retries}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * retries)); // Exponential backoff
          }
        }
      } catch (error) {
        retries++;
        console.error(`❌ ${vehicle.vehicle_number}: Error updating status:`, error.message);
        if (retries < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * retries));
        }
      }
    }
    
    if (!statusUpdateSuccess) {
      console.error(`❌ ${vehicle.vehicle_number}: Failed to update status after ${maxRetries} attempts`);
    }
    
    // Publish status via MQTT (for hardware devices)
    mqttPublisher.publishStatus(vehicle.vehicle_number, 'working');

    // Simulate work time
    const workTimeMs = (config.WORK_TIME_MIN + Math.random() * (config.WORK_TIME_MAX - config.WORK_TIME_MIN)) * 60000;
    console.log(`🔧 ${vehicle.vehicle_number}: Working on fault (${(workTimeMs / 60000).toFixed(1)} min)...`);

    setTimeout(async () => {
      await this.completeWork(vehicle);
    }, workTimeMs);
  }

  async completeWork(vehicle) {
    console.log(`✅ ${vehicle.vehicle_number}: Work completed!`);

    // Publish resolution via MQTT (your backend listens to this)
    const topic = `vehicle/${vehicle.vehicle_number}/resolved`;
    mqttPublisher.client.publish(topic, JSON.stringify({
      resolved: true,
      fault_id: vehicle.assignedFault,
      timestamp: new Date().toISOString()
    }), { qos: 1 });

    // Reset vehicle state
    vehicle.assignedFault = null;
    vehicle.currentRoute = null;
    vehicle.waypointIndex = 0;
    vehicle.status = 'available';

    await apiClient.updateVehicleStatus(vehicle.id, 'available');
    mqttPublisher.publishStatus(vehicle.vehicle_number, 'available');

    console.log(`🏠 ${vehicle.vehicle_number}: Back to available status`);
  }

  async checkForDispatches() {
    // Get list of vehicle IDs being simulated
    const vehicleIds = Array.from(this.vehicles.keys());
    
    if (vehicleIds.length === 0) return;

    // Poll backend for faults assigned to our vehicles
    const dispatchedFaults = await apiClient.getDispatchedFaults(vehicleIds);

    if (dispatchedFaults.length === 0) return;

    console.log(`\n📋 Found ${dispatchedFaults.length} dispatched fault(s) from backend AI dispatch\n`);

    for (const fault of dispatchedFaults) {
      // Skip if we've already started processing this fault
      const faultId = fault._id.toString();
      if (this.processedFaults.has(faultId)) {
        continue;
      }

      // Get assigned vehicle ID (handle both populated and unpopulated cases)
      const assignedVehicleId = fault.assigned_vehicle?._id || fault.assigned_vehicle;
      if (!assignedVehicleId) {
        console.warn(`⚠️  Fault ${faultId} has no assigned vehicle, skipping`);
        continue;
      }

      // Find corresponding vehicle in simulator (normalize to string for lookup)
      const vehicleIdStr = assignedVehicleId.toString();
      const vehicle = this.vehicles.get(vehicleIdStr);

      if (!vehicle) {
        console.warn(`⚠️  Vehicle ${vehicleIdStr} not found in simulator for fault ${faultId}`);
        continue;
      }

      // Check if vehicle is already processing this specific fault (has route and assignedFault matches)
      // This prevents duplicate route calculations if simulator restarted or fault was already processed
      if (vehicle.status === 'onRoute' && vehicle.assignedFault === faultId && vehicle.currentRoute) {
        // Vehicle is already moving to this fault, skip to avoid duplicate processing
        console.log(`ℹ️  Vehicle ${vehicle.vehicle_number} is already en route to fault ${faultId}`);
        continue;
      }

      // Handle different vehicle statuses:
      // - 'available': Vehicle is free, process dispatch normally
      // - 'onRoute' without route: Backend set status but simulator hasn't calculated route yet - process it
      // - 'onRoute' with route but different fault: Shouldn't happen, but skip to be safe
      // - 'working' or other statuses: Vehicle is busy, skip
      if (vehicle.status !== 'available' && vehicle.status !== 'onRoute') {
        console.log(`⚠️  Vehicle ${vehicle.vehicle_number} is ${vehicle.status}, skipping fault ${faultId}`);
        continue;
      }

      // If vehicle is onRoute but has no route, it means backend dispatched but simulator needs to calculate route
      // This happens when: backend dispatches -> sets status to 'onRoute' -> simulator initializes/fetches -> finds vehicle with 'onRoute' but no route
      if (vehicle.status === 'onRoute' && !vehicle.currentRoute) {
        console.log(`🔄 Vehicle ${vehicle.vehicle_number} is onRoute but has no route yet - calculating route for fault ${faultId}`);
      }

      // Ensure fault has coordinates
      if (!fault.latitude || !fault.longitude) {
        console.warn(`⚠️  Fault ${faultId} missing coordinates, skipping`);
        continue;
      }

      console.log(`🚨 Starting dispatch for ${vehicle.vehicle_number} to ${fault.fault_location}`);
      console.log(`   Fault ID: ${faultId}`);

      try {
        // Calculate route from vehicle's current position to fault location
        const route = await calculateRoute(
          { lat: vehicle.currentLat, lng: vehicle.currentLng },
          { lat: fault.latitude, lng: fault.longitude }
        );

        console.log(`   Route: ${route.summary}`);

        // Update vehicle state
        vehicle.status = 'onRoute';
        vehicle.assignedFault = faultId;
        vehicle.currentRoute = route;
        vehicle.waypointIndex = 0;

        // Update status via API and MQTT
        await apiClient.updateVehicleStatus(vehicle.id, 'onRoute');
        mqttPublisher.publishStatus(vehicle.vehicle_number, 'onRoute');

        // Mark fault as processed
        this.processedFaults.add(faultId);

        console.log(`✅ ${vehicle.vehicle_number} started moving to fault location!\n`);
      } catch (error) {
        console.error(`❌ Error starting dispatch for ${vehicle.vehicle_number}:`, error.message);
      }
    }
  }

  stop() {
    this.running = false;
    mqttPublisher.disconnect();
    console.log('🛑 Simulator stopped');
  }
}

export default new VehicleSimulator();