import mqtt from "mqtt";
import Fault from "./models/Fault.js";
import Vehicle from "./models/Vehicle.js";
import Trip from "./models/Trip.js";
import Alert from "./models/Alert.js";
import logger from "./services/logger.js";
import { getIO } from "./services/socketService.js";
import { clearDispatchTimeout } from "./controllers/dispatchController.js";

const MQTT_BROKER = process.env.MQTT_BROKER || "84837c1224714acc85e9e0935388600d.s1.eu.hivemq.cloud";
const MQTT_PORT = process.env.MQTT_PORT || 8883;

// Message queue for when client is disconnected
const messageQueue = [];

// Create MQTT client with improved reconnection settings
const client = mqtt.connect({
  host: MQTT_BROKER,
  port: MQTT_PORT,
  protocol: "mqtts",          // secure connection
  username: process.env.MQTT_USERNAME || "taha_user",
  password: process.env.MQTT_PASSWORD || "Strongpassword123",
  reconnectPeriod: 5000,       // Auto-reconnect every 5 seconds
  connectTimeout: 30000,       // 30 second connection timeout
  keepalive: 60,              // Send keepalive every 60 seconds
  clean: true                 // Clean session
});

let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

client.on("connect", () => {
  logger.info("Connected to MQTT broker", { broker: MQTT_BROKER, port: MQTT_PORT });
  reconnectAttempts = 0;

  // Subscribe to both confirmation and resolved topics
  client.subscribe(["vehicle/+/confirmation", "vehicle/+/resolved"], (err) => {
    if (err) {
      logger.error("MQTT subscription error", { error: err.message, stack: err.stack });
    } else {
      logger.info("MQTT subscriptions active", { topics: ["vehicle/+/confirmation", "vehicle/+/resolved"] });
      
      // Process queued messages when reconnected
      if (messageQueue.length > 0) {
        logger.info("Processing queued MQTT messages", { count: messageQueue.length });
        const queueCopy = [...messageQueue];
        messageQueue.length = 0; // Clear queue
        
        queueCopy.forEach(({ topic, message, options }) => {
          try {
            client.publish(topic, message, options, (err) => {
              if (err) {
                logger.error("Failed to send queued MQTT message", { topic, error: err.message });
                // Re-queue if still failing
                messageQueue.push({ topic, message, options });
              } else {
                logger.info("Sent queued MQTT message", { topic });
              }
            });
          } catch (error) {
            logger.error("Error processing queued MQTT message", { topic, error: error.message, stack: error.stack });
            messageQueue.push({ topic, message, options });
          }
        });
      }
    }
  });
});

client.on("error", (err) => {
  logger.error("MQTT connection error", { error: err.message, stack: err.stack, reconnectAttempts });
  reconnectAttempts++;
  
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    logger.error("Maximum MQTT reconnection attempts reached", { maxAttempts: MAX_RECONNECT_ATTEMPTS });
  }
});

client.on("close", () => {
  logger.warn("MQTT connection closed");
});

client.on("offline", () => {
  logger.warn("MQTT client offline");
});

client.on("reconnect", () => {
  reconnectAttempts++;
  logger.info("MQTT reconnecting", { attempt: reconnectAttempts });
});

client.on("message", async (topic, payload) => {
  try {
    const parsed = JSON.parse(payload.toString());
    const [_, vehicleNum, subTopic] = topic.split("/");

    // Handle "confirmation" messages
    if (subTopic === "confirmation" && parsed.confirmed) {
      logger.info("Received vehicle confirmation", { vehicle: vehicleNum, faultId: parsed.fault_id });

      const vehicle = await Vehicle.findOne({ vehicle_number: vehicleNum })
        .populate("assigned_driver")
        .populate("assigned_device");
      if (!vehicle) {
        logger.error("Unknown vehicle in confirmation", { vehicle: vehicleNum });
        return;
      }

      // Clear dispatch timeout since vehicle acknowledged
      clearDispatchTimeout(parsed.fault_id, vehicle._id.toString());

      // Update fault status to assigned
      const fault = await Fault.findByIdAndUpdate(parsed.fault_id, {
        status: "assigned",
        assigned_vehicle: vehicle._id,
      }, { new: true });

      logger.info("Fault assigned to vehicle", { faultId: parsed.fault_id, vehicle: vehicleNum });

      // Emit WebSocket events for vehicle confirmation
      const io = getIO();
      if (io) {
        io.emit('vehicle:confirmation', {
          vehicleId: vehicle._id.toString(),
          vehicleNumber: vehicleNum,
          faultId: parsed.fault_id,
          status: 'assigned'
        });
        
        io.emit('fault:updated', {
          fault: {
            _id: parsed.fault_id.toString(),
            status: 'assigned',
            assigned_vehicle: vehicle._id.toString()
          }
        });
        
        io.emit('vehicle:status-change', {
          vehicleId: vehicle._id.toString(),
          status: 'working',
          updatedFields: { status: 'working' }
        });
      }

      // 🆕 Auto-create trip when driver confirms
      try {
        // Check if vehicle already has an ongoing trip - only one ongoing trip per vehicle allowed
        let trip = await Trip.findOne({
          vehicle: vehicle._id,
          status: "ongoing"
        });
        
        if (!trip) {
          // No ongoing trip exists, create a new one
          // Multiple completed trips are allowed, but only one ongoing trip per vehicle
          trip = await Trip.create({
            vehicle: vehicle._id,
            driver: vehicle.assigned_driver?._id || null,
            start_time: new Date(),
            start_location: "Depot", // Default start location
            status: "ongoing",
            managed_by: null // Can be set if you have a dispatcher user
          });
          logger.info("Trip auto-created", { tripId: trip._id, vehicle: vehicleNum });
        } else {
          // Ongoing trip already exists, reuse it
          logger.info("Ongoing trip already exists, reusing existing trip", { 
            tripId: trip._id, 
            vehicle: vehicleNum 
          });
        }

        // Update vehicle status to working
        vehicle.status = "working";
        await vehicle.save();
        logger.info("Vehicle status updated to working", { vehicle: vehicleNum });

        // Timer will start when vehicle actually arrives at fault location
        // For MQTT confirmation, vehicle may not have arrived yet, so don't start timer here
        // Timer will be started by GPS arrival detection or status change handler

      } catch (tripError) {
        logger.error("Failed to create trip", { vehicle: vehicleNum, error: tripError.message, stack: tripError.stack });
      }
    }

    // Handle "resolved" messages
    else if (subTopic === "resolved" && parsed.resolved) {
      logger.info("Received fault resolution", { vehicle: vehicleNum, faultId: parsed.fault_id });

      const fault = await Fault.findById(parsed.fault_id).populate("assigned_vehicle");
      if (!fault) {
        logger.error("Unknown fault ID in resolution", { faultId: parsed.fault_id });
        return;
      }

      fault.status = "resolved";
      await fault.save();

      logger.info("Fault marked as resolved", { faultId: parsed.fault_id });

      // Emit WebSocket events for fault resolution
      const io = getIO();
      if (io) {
        io.emit('vehicle:resolved', {
          vehicleId: fault.assigned_vehicle._id.toString(),
          vehicleNumber: vehicleNum,
          faultId: parsed.fault_id,
          status: 'resolved'
        });
        
        io.emit('fault:updated', {
          fault: {
            _id: parsed.fault_id.toString(),
            status: 'resolved'
          }
        });
      }

      // 🆕 Auto-end trip and update vehicle/alert status
      try {
        // Find and end the ongoing trip for this vehicle
        const trip = await Trip.findOne({
          vehicle: fault.assigned_vehicle._id,
          status: "ongoing"
        });

        if (trip) {
          trip.status = "completed";
          trip.end_time = new Date();
          trip.end_location = fault.fault_location; // Use fault location as end location
          await trip.save();
          logger.info("Trip auto-completed", { tripId: trip._id, vehicle: vehicleNum });
        }

        // Update vehicle status back to available
        const vehicle = await Vehicle.findById(fault.assigned_vehicle._id);
        if (vehicle) {
          vehicle.status = "available";
          await vehicle.save();
          logger.info("Vehicle status updated to available", { vehicle: vehicleNum });
          
          // Emit WebSocket event for vehicle status change
          const io = getIO();
          if (io) {
            io.emit('vehicle:status-change', {
              vehicleId: vehicle._id.toString(),
              status: 'available',
              updatedFields: { status: 'available' }
            });
          }
        }

        // Mark alert as solved
        await Alert.updateOne(
          { fault: fault._id, vehicle: fault.assigned_vehicle._id },
          { solved: true }
        );
        logger.info("Alert marked as solved", { faultId: parsed.fault_id });

      } catch (endTripError) {
        logger.error("Failed to end trip", { vehicle: vehicleNum, error: endTripError.message, stack: endTripError.stack });
      }
    }

  } catch (err) {
    logger.error("Invalid MQTT message", { error: err.message, stack: err.stack });
  }
});

// ----------------- Export helpers -----------------
export const sendAlertToESP = (topic, message) => {
  // 🔍 DEBUG: Check connection status
  console.log("\n🔍 ===== MQTT PUBLISH DEBUG =====");
  console.log(`📡 Topic: ${topic}`);
  console.log(`🔌 Client Connected: ${client.connected}`);
  console.log(`🔌 Client Ready State: ${client.connected ? 'CONNECTED' : 'DISCONNECTED'}`);
  
  try {
    const messageStr = JSON.stringify(message);
    const options = {
      qos: 1, // Quality of Service level 1 (at least once delivery)
      retain: false // Don't retain messages
    };
    
  if (!client.connected) {
    logger.warn("MQTT client not connected - queuing message", { topic, queueSize: messageQueue.length });
    
    // Queue message for later delivery
    messageQueue.push({ topic, message: messageStr, options });
    
    // Limit queue size to prevent memory issues
    if (messageQueue.length > 100) {
      logger.warn("MQTT message queue full, removing oldest", { queueSize: messageQueue.length });
      messageQueue.shift();
    }
    
    logger.debug("Message queued for later delivery", { topic, queueSize: messageQueue.length });
    return false; // Return false but message is queued
  }
    
    console.log(`📤 Publishing to topic: ${topic}`);
    console.log(`📦 Message (stringified): ${messageStr}`);
    console.log(`⚙️  QoS: ${options.qos}`);
    
    const result = client.publish(topic, messageStr, options, (err) => {
      if (err) {
        logger.error("MQTT publish error", { topic, error: err.message, stack: err.stack });
        
        // Queue message if publish fails
        messageQueue.push({ topic, message: messageStr, options });
        logger.debug("Message queued due to publish error", { topic, queueSize: messageQueue.length });
      } else {
        logger.debug("MQTT publish success", { topic });
      }
    });
    
    logger.debug("MQTT publish initiated", { topic, result });
    
    return true;
  } catch (error) {
    logger.error("Exception during MQTT publish", { topic, error: error.message, stack: error.stack });
    
    // Try to queue message even on exception
    try {
      const messageStr = JSON.stringify(message);
      const options = {
        qos: 1,
        retain: false
      };
      messageQueue.push({ topic, message: messageStr, options });
      logger.debug("Message queued after exception", { topic, queueSize: messageQueue.length });
    } catch (queueError) {
      logger.error("Failed to queue message after exception", { topic, error: queueError.message });
    }
    
    return false;
  }
};

// Note: All topic subscriptions are handled by the main client.on("message") handler above
// to avoid multiple event listeners being registered
