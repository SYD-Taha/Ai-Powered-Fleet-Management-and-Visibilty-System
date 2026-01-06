import Alert from "../models/Alert.js";
import { sendAlertToESP } from "../mqttService.js";

// ===========================
// 🆕 Centralized Dispatch Alert Sender
// ===========================
export const sendDispatchAlert = async (fault, vehicle, device) => {
  try {
    const prototypeMode = process.env.PROTOTYPE_MODE === 'true';
    
    // 🔍 DEBUG: Log device object details
    console.log("\n🔍 ===== DISPATCH DEBUG INFO =====");
    console.log("Device object:", device ? JSON.stringify(device, null, 2) : "null/undefined");
    console.log("Device type:", typeof device);
    console.log("Device.device_id:", device?.device_id);
    console.log("Device._id:", device?._id);
    
    // Validate device object (only throw error if prototype mode is disabled)
    if (!device) {
      if (prototypeMode) {
        console.log("⚠️ PROTOTYPE MODE: Device is null/undefined - will mock MQTT alert");
      } else {
        throw new Error("Device object is null or undefined");
      }
    } else if (!device.device_id) {
      if (prototypeMode) {
        console.log("⚠️ PROTOTYPE MODE: Device missing device_id - will mock MQTT alert");
      } else {
        console.error("❌ CRITICAL: device.device_id is missing!");
        console.error("Device object keys:", Object.keys(device));
        throw new Error(`Device device_id is missing. Device object: ${JSON.stringify(device)}`);
      }
    }

    // Use mock topic if device is missing, otherwise use real device_id
    const deviceId = device?.device_id || "MOCK_DEVICE";
    const topic = `device/${deviceId}/dispatch`;
    console.log(`📡 Constructed Topic: ${topic}`);
    console.log(`📋 Vehicle: ${vehicle.vehicle_number}`);
    console.log(`🔧 Device ID: ${deviceId}${!device?.device_id ? " (MOCK)" : ""}`);
    console.log(`⚠️ Fault: ${fault.fault_type} at ${fault.fault_location}`);

    // Create Alert record with priority matching fault category (always create, even without device)
    const alert = await Alert.create({
      fault: fault._id,
      vehicle: vehicle._id,
      priority: fault.category, // High/Medium/Low matches fault category
      solved: false,
      timestamp: new Date()
    });

    // ✅ FIXED: Convert ObjectIds to strings and simplify message format
    const alertMessage = {
      fault_id: fault._id.toString(), // ✅ Convert to string
      fault_details: `${fault.fault_type} at ${fault.fault_location}` // ✅ Simplified format
    };
    
    console.log(`📦 Message Payload:`, JSON.stringify(alertMessage, null, 2));
    console.log("=============================\n");

    // Conditionally send MQTT: send if device exists, mock if missing
    if (device && device.device_id) {
      // Send alert message via MQTT
      sendAlertToESP(topic, alertMessage);
      console.log(`✅ ${fault.category} priority dispatch alert sent for fault ${fault._id}`);
    } else {
      // Mock MQTT alert in prototype mode
      console.log(`[MOCK MQTT] Would publish to ${topic}:`, JSON.stringify(alertMessage));
      console.log(`⚠️ PROTOTYPE MODE: MQTT alert mocked (no device assigned to vehicle ${vehicle.vehicle_number})`);
      console.log(`✅ ${fault.category} priority dispatch alert record created (MQTT mocked) for fault ${fault._id}`);
    }
    
    return alert;
  } catch (err) {
    console.error("❌ Failed to send dispatch alert:", err.message);
    console.error("Error stack:", err.stack);
    throw err; // Let DispatchController handle it
  }
};

// (keep your other alertController exports here)