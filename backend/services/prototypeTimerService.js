import Fault from "../models/Fault.js";
import Vehicle from "../models/Vehicle.js";
import Trip from "../models/Trip.js";
import Alert from "../models/Alert.js";
import logger from "./logger.js";
import { getIO } from "./socketService.js";
import cache from "./cacheService.js";

// Map to store active timers: vehicleId -> timeout reference
const activeTimers = new Map();

/**
 * Start auto-resolution timer for vehicles when they arrive at fault location
 * Timer will automatically resolve the fault after 30 seconds
 * Works for all vehicles (both with and without devices)
 * @param {String} vehicleId - Vehicle ObjectId as string
 * @param {String} faultId - Fault ObjectId as string
 * @param {Object} vehicle - Vehicle document
 * @param {Object} fault - Fault document
 */
export const startAutoResolutionTimer = async (vehicleId, faultId, vehicle, fault) => {
  try {
    // Cancel any existing timer for this vehicle
    cancelTimer(vehicleId);

    // Fixed delay: 30 seconds (30000ms)
    const delayMs = 30000; // 30 seconds
    const delaySeconds = (delayMs / 1000).toFixed(0);

    logger.info("Starting auto-resolution timer", {
      vehicleId,
      faultId,
      delayMs,
      delaySeconds: `${delaySeconds} seconds`
    });

    // Start timer
    const timeoutId = setTimeout(async () => {
      try {
        await autoResolveFault(vehicleId, faultId);
      } catch (error) {
        logger.error("Error in auto-resolution timer callback", {
          vehicleId,
          faultId,
          error: error.message,
          stack: error.stack
        });
      } finally {
        // Remove timer from active timers map
        activeTimers.delete(vehicleId);
      }
    }, delayMs);

    // Store timer reference
    activeTimers.set(vehicleId, timeoutId);

    logger.info("Auto-resolution timer scheduled", {
      vehicleId,
      faultId,
      willResolveIn: `${delaySeconds} seconds`
    });

  } catch (error) {
    logger.error("Failed to start auto-resolution timer", {
      vehicleId,
      faultId,
      error: error.message,
      stack: error.stack
    });
  }
};

/**
 * Automatically resolve a fault for a vehicle without device
 * Replicates the logic from mqttService.js resolution handler
 * @param {String} vehicleId - Vehicle ObjectId as string
 * @param {String} faultId - Fault ObjectId as string
 */
const autoResolveFault = async (vehicleId, faultId) => {
  try {
    logger.info("Auto-resolving fault", { vehicleId, faultId });

    // Find fault and populate assigned vehicle
    const fault = await Fault.findById(faultId).populate("assigned_vehicle");
    if (!fault) {
      logger.error("Fault not found for auto-resolution", { faultId });
      return;
    }

    // Check if fault is already resolved
    if (fault.status === "resolved") {
      logger.warn("Fault already resolved, skipping auto-resolution", { faultId });
      return;
    }

    // Update fault status to resolved
    fault.status = "resolved";
    await fault.save();
    logger.info("Fault marked as resolved (auto)", { faultId });

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
      logger.info("Trip auto-completed", { tripId: trip._id, vehicleId });
    } else {
      logger.warn("No ongoing trip found for auto-resolution", { vehicleId, faultId });
    }

    // Update vehicle status back to available
    const vehicle = await Vehicle.findById(fault.assigned_vehicle._id);
    if (vehicle) {
      vehicle.status = "available";
      await vehicle.save();
      logger.info("Vehicle status updated to available (auto)", { vehicleId });
      
      // Cancel any active routes for this vehicle
      const { cancelActiveRoutes } = await import("../controllers/gpsController.js");
      await cancelActiveRoutes(vehicle._id, 'available');
      
      // Emit WebSocket events for resolution (matching mqttService.js pattern)
      const io = getIO();
      if (io) {
        io.emit('vehicle:resolved', {
          vehicleId: vehicle._id.toString(),
          vehicleNumber: vehicle.vehicle_number,
          faultId: faultId,
          status: 'resolved'
        });
        
        io.emit('fault:updated', {
          fault: {
            _id: faultId.toString(),
            status: 'resolved'
          }
        });
        
        io.emit('vehicle:status-change', {
          vehicleId: vehicle._id.toString(),
          status: 'available',
          updatedFields: { status: 'available' }
        });
      }
    } else {
      logger.warn("Vehicle not found for auto-resolution", { vehicleId });
    }

    // Mark alert as solved
    await Alert.updateOne(
      { fault: fault._id, vehicle: fault.assigned_vehicle._id },
      { solved: true }
    );
    logger.info("Alert marked as solved (auto)", { faultId });

    // Invalidate cache to ensure UI updates
    cache.delPattern('faults:*');
    cache.delPattern('vehicles:*');
    cache.delPattern('trips:*');

    logger.info("Auto-resolution completed successfully", { vehicleId, faultId });

  } catch (error) {
    logger.error("Failed to auto-resolve fault", {
      vehicleId,
      faultId,
      error: error.message,
      stack: error.stack
    });
    // Don't throw - log error but don't crash the application
  }
};

/**
 * Cancel an active auto-resolution timer for a vehicle
 * @param {String} vehicleId - Vehicle ObjectId as string
 */
export const cancelTimer = (vehicleId) => {
  const timeoutId = activeTimers.get(vehicleId);
  if (timeoutId) {
    clearTimeout(timeoutId);
    activeTimers.delete(vehicleId);
    logger.info("Auto-resolution timer cancelled", { vehicleId });
  }
};

/**
 * Cancel auto-resolution timer if vehicle status changes away from working
 * Called when vehicle status is updated
 * @param {String} vehicleId - Vehicle ObjectId as string
 * @param {String} newStatus - New vehicle status
 */
export const cancelTimerIfNotWorking = async (vehicleId, newStatus) => {
  try {
    // Only cancel if status is changing away from "working"
    if (newStatus !== 'working') {
      const timeoutId = activeTimers.get(vehicleId);
      if (timeoutId) {
        clearTimeout(timeoutId);
        activeTimers.delete(vehicleId);
        logger.info("Auto-resolution timer cancelled - vehicle status changed away from working", {
          vehicleId,
          newStatus
        });
      }
    }
  } catch (error) {
    logger.error("Error cancelling timer on status change", {
      vehicleId,
      newStatus,
      error: error.message,
      stack: error.stack
    });
  }
};

/**
 * Check if a timer exists for a vehicle
 * @param {String} vehicleId - Vehicle ObjectId as string
 * @returns {Boolean} True if timer exists, false otherwise
 */
export const hasActiveTimer = (vehicleId) => {
  return activeTimers.has(vehicleId);
};

/**
 * Get count of active timers (for debugging/monitoring)
 * @returns {Number} Number of active timers
 */
export const getActiveTimerCount = () => {
  return activeTimers.size;
};


