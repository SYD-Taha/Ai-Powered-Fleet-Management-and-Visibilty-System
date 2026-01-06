import Fault from "../models/Fault.js";
import Vehicle from "../models/Vehicle.js";
import HardwareDevice from "../models/HardwareDevice.js";
import Trip from "../models/Trip.js";
import GPS from "../models/GPS.js";
import { sendDispatchAlert } from "./alertController.js";
import cache from "../services/cacheService.js";
import logger from "../services/logger.js";
import { getIO } from "../services/socketService.js";
import { isMLServiceAvailable, predictBestVehicle } from "../services/mlService.js";

// ===========================
// AI DISPATCH ENGINE - Intelligent Vehicle Selection
// ===========================

// ===========================
// Dispatch Timeout Tracking
// ===========================
// Track active dispatches waiting for acknowledgment
const activeDispatches = new Map(); // faultId -> { vehicleId, dispatchTime, timeoutId }
// Track vehicles that timed out for specific faults (to exclude from redispatch)
const timedOutVehicles = new Map(); // faultId -> Set of vehicleIds that timed out

/**
 * Calculate Haversine distance between two GPS coordinates
 * @param {Number} lat1 - Latitude of first point
 * @param {Number} lon1 - Longitude of first point
 * @param {Number} lat2 - Latitude of second point
 * @param {Number} lon2 - Longitude of second point
 * @returns {Number} Distance in meters
 */
const calculateHaversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in meters
};

/**
 * Calculate vehicle performance score based on past fault resolution history
 * @deprecated Use calculatePerformanceScoresBatch for better performance
 */
const calculatePerformanceScore = async (vehicleId) => {
  try {
    const completedTrips = await Trip.find({
      vehicle: vehicleId,
      status: "completed"
    }).populate('vehicle');

    const resolvedFaults = await Fault.find({
      assigned_vehicle: vehicleId,
      status: "resolved"
    });

    const assignedFaults = await Fault.find({
      assigned_vehicle: vehicleId,
      status: { $in: ["assigned", "resolved"] }
    });

    if (assignedFaults.length === 0) return 0.5; // Neutral score for new vehicles

    const successRatio = resolvedFaults.length / assignedFaults.length;
    return successRatio; // Returns 0-1
  } catch (err) {
    logger.error("Error calculating performance", { vehicleId, error: err.message, stack: err.stack });
    return 0.5;
  }
};

/**
 * Calculate performance scores for multiple vehicles in a single batch query
 * @param {Array} vehicleIds - Array of vehicle ObjectIds
 * @returns {Map} Map of vehicleId (string) -> performance ratio (0-1)
 */
const calculatePerformanceScoresBatch = async (vehicleIds) => {
  try {
    if (!vehicleIds || vehicleIds.length === 0) {
      return new Map();
    }

    // Batch query for resolved faults
    const resolvedCounts = await Fault.aggregate([
      {
        $match: {
          assigned_vehicle: { $in: vehicleIds },
          status: "resolved"
        }
      },
      {
        $group: {
          _id: "$assigned_vehicle",
          count: { $sum: 1 }
        }
      }
    ]);

    // Batch query for assigned faults (assigned or resolved)
    const assignedCounts = await Fault.aggregate([
      {
        $match: {
          assigned_vehicle: { $in: vehicleIds },
          status: { $in: ["assigned", "resolved"] }
        }
      },
      {
        $group: {
          _id: "$assigned_vehicle",
          count: { $sum: 1 }
        }
      }
    ]);

    // Create lookup maps
    const resolvedMap = new Map(
      resolvedCounts.map(r => [r._id.toString(), r.count])
    );
    const assignedMap = new Map(
      assignedCounts.map(a => [a._id.toString(), a.count])
    );

    // Calculate performance ratios for all vehicles
    const performanceMap = new Map();
    vehicleIds.forEach(id => {
      const idStr = id.toString();
      const assigned = assignedMap.get(idStr) || 0;
      const resolved = resolvedMap.get(idStr) || 0;
      // Neutral score (0.5) for new vehicles with no history
      performanceMap.set(idStr, assigned === 0 ? 0.5 : resolved / assigned);
    });

    return performanceMap;
  } catch (err) {
    logger.error("Error calculating performance scores batch", { vehicleCount: vehicleIds.length, error: err.message, stack: err.stack });
    // Return neutral scores for all vehicles on error
    const fallbackMap = new Map();
    vehicleIds.forEach(id => fallbackMap.set(id.toString(), 0.5));
    return fallbackMap;
  }
};

/**
 * Calculate fatigue level based on today's workload
 * @deprecated Use calculateFatigueLevelsBatch for better performance
 */
const calculateFatigueLevel = async (vehicleId) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const faultsToday = await Fault.countDocuments({
      assigned_vehicle: vehicleId,
      reported_date: { $gte: today }
    });

    return faultsToday; // Returns count
  } catch (err) {
    logger.error("Error calculating fatigue", { vehicleId, error: err.message, stack: err.stack });
    return 0;
  }
};

/**
 * Calculate fatigue levels for multiple vehicles in a single batch query
 * @param {Array} vehicleIds - Array of vehicle ObjectIds
 * @returns {Map} Map of vehicleId (string) -> fatigue count (number)
 */
const calculateFatigueLevelsBatch = async (vehicleIds) => {
  try {
    if (!vehicleIds || vehicleIds.length === 0) {
      return new Map();
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const fatigueCounts = await Fault.aggregate([
      {
        $match: {
          assigned_vehicle: { $in: vehicleIds },
          reported_date: { $gte: today }
        }
      },
      {
        $group: {
          _id: "$assigned_vehicle",
          count: { $sum: 1 }
        }
      }
    ]);

    // Create lookup map
    const fatigueMap = new Map();
    vehicleIds.forEach(id => {
      const idStr = id.toString();
      const count = fatigueCounts.find(f => f._id.toString() === idStr);
      fatigueMap.set(idStr, count ? count.count : 0);
    });

    return fatigueMap;
  } catch (err) {
    logger.error("Error calculating fatigue levels batch", { vehicleCount: vehicleIds.length, error: err.message, stack: err.stack });
    // Return zero fatigue for all vehicles on error
    const fallbackMap = new Map();
    vehicleIds.forEach(id => fallbackMap.set(id.toString(), 0));
    return fallbackMap;
  }
};

/**
 * Check if vehicle has experience with this location
 * @deprecated Use checkLocationExperienceBatch for better performance
 */
const hasLocationExperience = async (vehicleId, faultLocation) => {
  try {
    const experienceCount = await Fault.countDocuments({
      assigned_vehicle: vehicleId,
      fault_location: faultLocation,
      status: "resolved"
    });

    return experienceCount > 0;
  } catch (err) {
    logger.error("Error checking location experience", { vehicleId, faultLocation, error: err.message, stack: err.stack });
    return false;
  }
};

/**
 * Check location experience for multiple vehicles in a single batch query
 * @param {Array} vehicleIds - Array of vehicle ObjectIds
 * @param {String} faultLocation - The location to check experience for
 * @returns {Map} Map of vehicleId (string) -> hasExperience (boolean)
 */
const checkLocationExperienceBatch = async (vehicleIds, faultLocation) => {
  try {
    if (!vehicleIds || vehicleIds.length === 0 || !faultLocation) {
      return new Map();
    }

    const experienceCounts = await Fault.aggregate([
      {
        $match: {
          assigned_vehicle: { $in: vehicleIds },
          fault_location: faultLocation,
          status: "resolved"
        }
      },
      {
        $group: {
          _id: "$assigned_vehicle",
          count: { $sum: 1 }
        }
      }
    ]);

    // Create lookup map
    const experienceMap = new Map();
    vehicleIds.forEach(id => {
      const idStr = id.toString();
      const count = experienceCounts.find(e => e._id.toString() === idStr);
      experienceMap.set(idStr, (count && count.count > 0) || false);
    });

    return experienceMap;
  } catch (err) {
    logger.error("Error checking location experience batch", { vehicleCount: vehicleIds.length, faultLocation, error: err.message, stack: err.stack });
    // Return false for all vehicles on error
    const fallbackMap = new Map();
    vehicleIds.forEach(id => fallbackMap.set(id.toString(), false));
    return fallbackMap;
  }
};

/**
 * Check if vehicle has experience with this fault type
 * @deprecated Use checkFaultTypeExperienceBatch for better performance
 */
const hasFaultTypeExperience = async (vehicleId, faultType) => {
  try {
    const experienceCount = await Fault.countDocuments({
      assigned_vehicle: vehicleId,
      fault_type: faultType,
      status: "resolved"
    });

    return experienceCount > 0;
  } catch (err) {
    logger.error("Error checking fault type experience", { vehicleId, faultType, error: err.message, stack: err.stack });
    return false;
  }
};

/**
 * Check fault type experience for multiple vehicles in a single batch query
 * @param {Array} vehicleIds - Array of vehicle ObjectIds
 * @param {String} faultType - The fault type to check experience for
 * @returns {Map} Map of vehicleId (string) -> hasExperience (boolean)
 */
const checkFaultTypeExperienceBatch = async (vehicleIds, faultType) => {
  try {
    if (!vehicleIds || vehicleIds.length === 0 || !faultType) {
      return new Map();
    }

    const experienceCounts = await Fault.aggregate([
      {
        $match: {
          assigned_vehicle: { $in: vehicleIds },
          fault_type: faultType,
          status: "resolved"
        }
      },
      {
        $group: {
          _id: "$assigned_vehicle",
          count: { $sum: 1 }
        }
      }
    ]);

    // Create lookup map
    const experienceMap = new Map();
    vehicleIds.forEach(id => {
      const idStr = id.toString();
      const count = experienceCounts.find(e => e._id.toString() === idStr);
      experienceMap.set(idStr, (count && count.count > 0) || false);
    });

    return experienceMap;
  } catch (err) {
    logger.error("Error checking fault type experience batch", { vehicleCount: vehicleIds.length, faultType, error: err.message, stack: err.stack });
    // Return false for all vehicles on error
    const fallbackMap = new Map();
    vehicleIds.forEach(id => fallbackMap.set(id.toString(), false));
    return fallbackMap;
  }
};

/**
 * AI Scoring Algorithm for Vehicle Selection
 * @deprecated Use scoreVehiclesBatch for better performance with multiple vehicles
 */
const scoreVehicle = async (vehicle, fault) => {
  let score = 100; // Base score

  // 1. Performance Score (25% weight)
  const performanceRatio = await calculatePerformanceScore(vehicle._id);
  const performanceBonus = performanceRatio * 25;
  score += performanceBonus;

  // 2. Fatigue Penalty (20% weight)
  const fatigueLevel = await calculateFatigueLevel(vehicle._id);
  const fatiguePenalty = Math.min(fatigueLevel * 5, 30); // Max -30 points
  score -= fatiguePenalty;

  // 3. Location Experience Bonus (15% weight)
  const locationExp = await hasLocationExperience(vehicle._id, fault.fault_location);
  if (locationExp) score += 15;

  // 4. Fault Type Experience Bonus (15% weight)
  const faultTypeExp = await hasFaultTypeExperience(vehicle._id, fault.fault_type);
  if (faultTypeExp) score += 15;

  // 5. Criticality Match Bonus (25% weight)
  // High priority faults should go to high performers
  if (fault.category === "High" && performanceRatio >= 0.7) {
    score += 25;
  } else if (fault.category === "Medium" && performanceRatio >= 0.5) {
    score += 15;
  } else if (fault.category === "Low") {
    score += 10; // Low priority faults can go to any vehicle
  }

  return {
    vehicle,
    score,
    breakdown: {
      base: 100,
      performance: performanceBonus.toFixed(2),
      fatigue: -fatiguePenalty,
      locationExp: locationExp ? 15 : 0,
      faultTypeExp: faultTypeExp ? 15 : 0,
      criticalityMatch: fault.category === "High" && performanceRatio >= 0.7 ? 25 : 
                        fault.category === "Medium" && performanceRatio >= 0.5 ? 15 : 
                        fault.category === "Low" ? 10 : 0
    }
  };
};

/**
 * Score multiple vehicles using pre-computed batch data
 * @param {Array} vehicles - Array of vehicle objects
 * @param {Object} fault - The fault object to score against
 * @param {Map} performanceMap - Pre-computed performance ratios
 * @param {Map} fatigueMap - Pre-computed fatigue levels
 * @param {Map} locationExpMap - Pre-computed location experience
 * @param {Map} faultTypeExpMap - Pre-computed fault type experience
 * @returns {Array} Array of scored vehicle objects
 */
const scoreVehiclesBatch = (vehicles, fault, performanceMap, fatigueMap, locationExpMap, faultTypeExpMap) => {
  return vehicles.map(vehicle => {
    const vehicleId = vehicle._id.toString();
    const performanceRatio = performanceMap.get(vehicleId) || 0.5;
    const fatigueLevel = fatigueMap.get(vehicleId) || 0;
    const hasLocationExp = locationExpMap.get(vehicleId) || false;
    const hasFaultTypeExp = faultTypeExpMap.get(vehicleId) || false;

    let score = 100; // Base score

    // 1. Performance Score (25% weight)
    const performanceBonus = performanceRatio * 25;
    score += performanceBonus;

    // 2. Fatigue Penalty (20% weight)
    const fatiguePenalty = Math.min(fatigueLevel * 5, 30); // Max -30 points
    score -= fatiguePenalty;

    // 3. Location Experience Bonus (15% weight)
    if (hasLocationExp) score += 15;

    // 4. Fault Type Experience Bonus (15% weight)
    if (hasFaultTypeExp) score += 15;

    // 5. Criticality Match Bonus (25% weight)
    let criticalityMatch = 0;
    if (fault.category === "High" && performanceRatio >= 0.7) {
      criticalityMatch = 25;
      score += 25;
    } else if (fault.category === "Medium" && performanceRatio >= 0.5) {
      criticalityMatch = 15;
      score += 15;
    } else if (fault.category === "Low") {
      criticalityMatch = 10;
      score += 10; // Low priority faults can go to any vehicle
    }

    return {
      vehicle,
      score,
      breakdown: {
        base: 100,
        performance: performanceBonus.toFixed(2),
        fatigue: -fatiguePenalty,
        locationExp: hasLocationExp ? 15 : 0,
        faultTypeExp: hasFaultTypeExp ? 15 : 0,
        criticalityMatch: criticalityMatch
      }
    };
  });
};

/**
 * Handle dispatch timeout - vehicle did not acknowledge within 1 minute
 * Resets fault, unassigns vehicle, and automatically redispatches
 * @param {String} faultId - Fault ID as string
 * @param {String} vehicleId - Vehicle ID as string
 */
const handleDispatchTimeout = async (faultId, vehicleId) => {
  try {
    logger.warn("Dispatch timeout - vehicle did not acknowledge", {
      faultId,
      vehicleId,
      timeoutAfter: "1 minute"
    });

    // Clear from active dispatches
    const dispatchInfo = activeDispatches.get(faultId);
    if (dispatchInfo) {
      clearTimeout(dispatchInfo.timeoutId);
      activeDispatches.delete(faultId);
    }

    // Add to timed-out set for this fault
    if (!timedOutVehicles.has(faultId)) {
      timedOutVehicles.set(faultId, new Set());
    }
    timedOutVehicles.get(faultId).add(vehicleId);

    // 🔧 FIX: ALWAYS reset vehicle FIRST - regardless of fault status
    // This prevents vehicles from getting stuck even if fault status changed
    const vehicle = await Vehicle.findById(vehicleId);
    if (vehicle) {
      // Timeout means vehicle didn't acknowledge, so always reset if in dispatched state
      // The vehicle should be in "onRoute" status at this point (before acknowledgment)
      if (vehicle.status === "onRoute" || vehicle.status === "idle") {
        vehicle.status = "available";
        await vehicle.save();
        logger.info("Vehicle reset to available after timeout", {
          vehicleId,
          vehicleNumber: vehicle.vehicle_number,
          previousStatus: vehicle.status
        });
      } else if (vehicle.status === "working") {
        // Edge case: vehicle somehow moved to working status but timeout fired
        // Check if fault is still active - if not, reset vehicle
        const activeFault = await Fault.findOne({
          assigned_vehicle: vehicle._id,
          status: { $in: ["pending_confirmation", "assigned"] }
        });
        
        if (!activeFault) {
          vehicle.status = "available";
          await vehicle.save();
          logger.warn("Vehicle in working status but no active fault found during timeout, resetting to available", {
            vehicleId,
            vehicleNumber: vehicle.vehicle_number
          });
        } else {
          // Vehicle is working and has active fault - this shouldn't happen during timeout
          // but don't reset it as it might be legitimately working
          logger.warn("Timeout fired but vehicle is in working status with active fault - skipping reset", {
            vehicleId,
            vehicleNumber: vehicle.vehicle_number,
            faultId: activeFault._id.toString()
          });
        }
      } else if (vehicle.status !== "available") {
        // Safety: reset any unexpected status that might indicate stuck state
        logger.warn("Vehicle in unexpected status during timeout, resetting to available", {
          vehicleId,
          vehicleNumber: vehicle.vehicle_number,
          status: vehicle.status
        });
        vehicle.status = "available";
        await vehicle.save();
      }
    }

    // Now handle fault status (vehicle is already reset above)
    const fault = await Fault.findById(faultId);
    if (!fault) {
      logger.error("Fault not found for timeout handling", { faultId });
      // Vehicle already reset above, so we can return
      return;
    }

    // Only reset fault if it's still in pending_confirmation status
    if (fault.status === "pending_confirmation") {
      fault.status = "waiting";
      fault.assigned_vehicle = null;
      await fault.save();

      // Invalidate cache
      cache.delPattern("faults:*");
      cache.delPattern("vehicles:*");

      // Emit WebSocket events
      const io = getIO();
      if (io) {
        io.emit("fault:updated", {
          fault: {
            _id: faultId,
            status: "waiting",
            assigned_vehicle: null
          }
        });

        if (vehicle) {
          io.emit("vehicle:status-change", {
            vehicleId: vehicleId,
            status: "available",
            updatedFields: { 
              status: "available",
              clearRoute: true
            }
          });
        }
      }

      // Automatically redispatch
      logger.info("Auto-redispatching fault after timeout", {
        faultId,
        excludedVehicle: vehicleId,
        vehicleNumber: vehicle?.vehicle_number || "unknown"
      });

      // Recursively call dispatchFaultToVehicle to select a different vehicle
      await dispatchFaultToVehicle(fault);
    } else {
      // Fault status changed, but vehicle is already reset above
      logger.info("Fault status changed before timeout, vehicle reset anyway", {
        faultId,
        currentStatus: fault.status,
        vehicleId,
        vehicleNumber: vehicle?.vehicle_number || "unknown"
      });

      // Still emit vehicle status change event and invalidate cache
      const io = getIO();
      if (io && vehicle) {
        io.emit("vehicle:status-change", {
          vehicleId: vehicleId,
          status: "available",
          updatedFields: { 
            status: "available",
            clearRoute: true
          }
        });
      }

      // Invalidate cache to ensure UI updates
      cache.delPattern("faults:*");
      cache.delPattern("vehicles:*");
    }
  } catch (error) {
    logger.error("Error handling dispatch timeout", {
      faultId,
      vehicleId,
      error: error.message,
      stack: error.stack
    });
  }
};

/**
 * Clear dispatch timeout when vehicle acknowledges
 * Called from mqttService.js when confirmation is received
 * @param {String} faultId - Fault ID as string
 * @param {String} vehicleId - Vehicle ID as string
 */
export const clearDispatchTimeout = (faultId, vehicleId) => {
  try {
    const dispatchInfo = activeDispatches.get(faultId);
    if (dispatchInfo) {
      clearTimeout(dispatchInfo.timeoutId);
      activeDispatches.delete(faultId);
      
      // Also clear from timed-out set if it was there
      if (timedOutVehicles.has(faultId)) {
        timedOutVehicles.get(faultId).delete(vehicleId);
        // Clean up empty sets
        if (timedOutVehicles.get(faultId).size === 0) {
          timedOutVehicles.delete(faultId);
        }
      }
      
      logger.info("Cleared dispatch timeout - vehicle acknowledged", {
        faultId,
        vehicleId
      });
    }
  } catch (error) {
    logger.error("Error clearing dispatch timeout", {
      faultId,
      vehicleId,
      error: error.message
    });
  }
};

/**
 * Cleanup function to check for stuck vehicles (vehicles in onRoute/working status with no active faults)
 * This should be called periodically to catch any edge cases where vehicles get stuck
 * @returns {Promise<Object>} Object with count and list of stuck vehicles that were reset
 */
export const checkStuckVehicles = async () => {
  try {
    // Find vehicles in dispatched states (onRoute or working)
    const dispatchedVehicles = await Vehicle.find({
      status: { $in: ["onRoute", "working"] }
    });

    if (dispatchedVehicles.length === 0) {
      logger.debug("Checking for stuck vehicles", { count: 0 });
      return { count: 0, vehicles: [] };
    }

    const stuckVehicles = [];
    
    for (const vehicle of dispatchedVehicles) {
      // Check if vehicle has an active fault assigned
      const activeFault = await Fault.findOne({
        assigned_vehicle: vehicle._id,
        status: { $in: ["pending_confirmation", "assigned"] }
      });

      // If no active fault found, vehicle might be stuck
      if (!activeFault) {
        // Check if there's a pending dispatch timeout for this vehicle
        let hasActiveDispatch = false;
        for (const [faultId, dispatchInfo] of activeDispatches.entries()) {
          if (dispatchInfo.vehicleId === vehicle._id.toString()) {
            hasActiveDispatch = true;
            break;
          }
        }

        // Only reset if there's no active dispatch timeout
        // If timeout is active, it will handle the reset when it fires
        if (!hasActiveDispatch) {
          const previousStatus = vehicle.status;
          vehicle.status = "available";
          
          // Clear any route-related data when resetting to available
          // This prevents vehicles from appearing to go to old destinations
          // Note: These fields might not exist in the Vehicle model, but we signal
          // to the frontend to clear route data via WebSocket event
          await vehicle.save();

          stuckVehicles.push({
            vehicleId: vehicle._id.toString(),
            vehicle: vehicle.vehicle_number,
            previousStatus
          });

          logger.info("Reset stuck vehicle to available", {
            vehicleId: vehicle._id.toString(),
            vehicleNumber: vehicle.vehicle_number,
            previousStatus
          });

          // Emit WebSocket event with route clearing information
          const io = getIO();
          if (io) {
            io.emit("vehicle:status-change", {
              vehicleId: vehicle._id.toString(),
              status: "available",
              updatedFields: { 
                status: "available",
                // Signal frontend to clear route data
                clearRoute: true
              }
            });
          }
        }
      }
    }

    // Invalidate cache if any vehicles were reset
    if (stuckVehicles.length > 0) {
      cache.delPattern("vehicles:*");
      logger.info("Reset stuck vehicles to available", {
        count: stuckVehicles.length,
        vehicles: stuckVehicles
      });
    } else {
      logger.debug("Checking for stuck vehicles", { count: dispatchedVehicles.length });
    }

    return { count: stuckVehicles.length, vehicles: stuckVehicles };
  } catch (error) {
    logger.error("Error checking stuck vehicles", {
      error: error.message,
      stack: error.stack
    });
    return { count: 0, vehicles: [] };
  }
};

/**
 * Core Dispatch Logic - Dispatches a single fault to the best available vehicle
 * This function can be called programmatically without HTTP context
 * @param {Object} fault - The fault object to dispatch
 * @returns {Promise<Object>} Result object with success status and details
 */
export const dispatchFaultToVehicle = async (fault) => {
  try {
    // Ensure fault is in waiting status (safety check)
    if (fault.status !== "waiting") {
      return {
        success: false,
        error: `Fault ${fault._id} is not in 'waiting' status (current: ${fault.status})`,
        fault_id: fault._id
      };
    }

    logger.info("Processing fault for dispatch", { faultId: fault._id, faultType: fault.fault_type, location: fault.fault_location, category: fault.category });

    // 1️⃣ Fetch all available vehicles with devices
    // Note: The status: "available" filter ensures vehicles with status "onRoute" or "working" 
    // are not selected, preventing multiple task assignments to the same vehicle
    const availableVehicles = await Vehicle.find({ status: "available" })
      .populate("assigned_device")
      .populate("assigned_driver");

    if (availableVehicles.length === 0) {
      logger.warn("No available vehicles found for fault", { faultId: fault._id });
      return {
        success: false,
        error: "No available vehicles with assigned devices.",
        fault_id: fault._id
      };
    }

    // Check if prototype mode is enabled
    const prototypeMode = process.env.PROTOTYPE_MODE === 'true';
    
    // Filter vehicles based on prototype mode setting
    const eligibleVehicles = prototypeMode
      ? availableVehicles  // All available vehicles eligible in prototype mode
      : availableVehicles.filter(v => v.assigned_device);  // Require device in production mode

    if (eligibleVehicles.length === 0) {
      const errorMsg = prototypeMode
        ? "No available vehicles found."
        : "No available vehicles with assigned devices.";
      logger.warn("No eligible vehicles found for fault", { faultId: fault._id, prototypeMode });
      return {
        success: false,
        error: errorMsg,
        fault_id: fault._id
      };
    }
    
    if (prototypeMode) {
      logger.info("PROTOTYPE MODE: Allowing dispatch without device requirement", { faultId: fault._id });
    }

    // Exclude vehicles that have timed out for this specific fault
    const faultIdStr = fault._id.toString();
    const timedOutForThisFault = timedOutVehicles.get(faultIdStr) || new Set();
    const vehiclesAfterTimeoutFilter = eligibleVehicles.filter(v => {
      const vehicleIdStr = v._id.toString();
      return !timedOutForThisFault.has(vehicleIdStr);
    });

    if (vehiclesAfterTimeoutFilter.length === 0) {
      logger.warn("No eligible vehicles after excluding timed-out vehicles", {
        faultId: fault._id,
        timedOutCount: timedOutForThisFault.size,
        originalCount: eligibleVehicles.length
      });
      return {
        success: false,
        error: "No available vehicles (all have timed out for this fault).",
        fault_id: fault._id
      };
    }

    logger.info("Found eligible vehicles for dispatch", {
      faultId: fault._id,
      vehicleCount: vehiclesAfterTimeoutFilter.length,
      excludedTimedOut: timedOutForThisFault.size
    });

    // 2️⃣ Select best vehicle using ML (if available) or Rule-Based (fallback)
    const vehicleIds = vehiclesAfterTimeoutFilter.map(v => v._id);
    let selectedVehicle;
    let selectionScore;
    let selectionMethod;
    let scoreBreakdown = null;
    let scoredVehicles = [];

    // Try ML first, fallback to rule-based
    const mlAvailable = await isMLServiceAvailable();

    if (mlAvailable) {
      logger.info("Dispatching with ML engine", {
        faultId: fault._id,
        faultType: fault.fault_type,
        vehicleCount: vehiclesAfterTimeoutFilter.length
      });

      try {
        // Extract ML features for all vehicles
        logger.debug("Extracting ML features for vehicles", {
          faultId: fault._id,
          vehicleCount: vehiclesAfterTimeoutFilter.length
        });

        // Get performance and fatigue data for ML features
        const [performanceMap, fatigueMap] = await Promise.all([
          calculatePerformanceScoresBatch(vehicleIds),
          calculateFatigueLevelsBatch(vehicleIds)
        ]);

        // Extract ML features for each vehicle
        const mlCandidates = await Promise.all(
          vehiclesAfterTimeoutFilter.map(async (vehicle) => {
            // Get vehicle's latest GPS coordinates
            const latestGPS = await GPS.findOne({ vehicle: vehicle._id })
              .sort({ timestamp: -1 })
              .select('latitude longitude')
              .lean();

            // Use vehicle coordinates or default to Karachi center if GPS not available
            // Ensure all coordinates are valid numbers (not null, undefined, or NaN)
            const vehicleLat = Number(latestGPS?.latitude) || Number(vehicle.latitude) || 24.8607;
            const vehicleLon = Number(latestGPS?.longitude) || Number(vehicle.longitude) || 67.0011;
            const faultLat = Number(fault.latitude) || 24.8607;
            const faultLon = Number(fault.longitude) || 67.0011;

            // Validate coordinates before calculation
            if (isNaN(vehicleLat) || isNaN(vehicleLon) || isNaN(faultLat) || isNaN(faultLon)) {
              logger.warn('Invalid coordinates detected, using defaults', {
                vehicleId: vehicle._id.toString(),
                latestGPS: latestGPS ? { lat: latestGPS.latitude, lon: latestGPS.longitude } : null,
                vehicleCoords: { lat: vehicle.latitude, lon: vehicle.longitude },
                faultCoords: { lat: fault.latitude, lon: fault.longitude }
              });
            }

            // Calculate distance in meters
            const distance = calculateHaversineDistance(vehicleLat, vehicleLon, faultLat, faultLon);

            // Get performance and fatigue data
            const vehicleIdStr = vehicle._id.toString();
            const performance = performanceMap.get(vehicleIdStr) || 0.5;
            const fatigueCount = fatigueMap.get(vehicleIdStr) || 0;
            // ML service expects fatigue in hours (0-24), cap at 24
            const fatigue = Math.min(fatigueCount, 24);

            // Get fault history count (total resolved faults)
            const faultHistory = await Fault.countDocuments({
              assigned_vehicle: vehicle._id,
              status: "resolved"
            });

            // Map fault category to severity (1=Low, 2=Medium, 3=High)
            const severityMap = { "Low": 1, "Medium": 2, "High": 3 };
            const faultSeverity = severityMap[fault.category] || 2;

            // Distance category (0=0-5km, 1=5-10km, 2=10km+)
            // ML service expects 0-2, so cap at 2 for distances >= 10km
            const distanceCat = distance < 5000 ? 0 : distance < 10000 ? 1 : 2;

            // Map performance ratio (0-1) to ML scale (1-10)
            // performance 0.0 -> 1.0, performance 1.0 -> 10.0
            const pastPerf = (performance * 9) + 1;

            // Validate all values before creating candidate object
            const candidate = {
              distance_m: distance,
              distance_cat: distanceCat,
              past_perf: parseFloat(pastPerf.toFixed(2)), // Must be float, range 1-10
              fault_history: faultHistory,
              fatigue_h: fatigue,
              fault_severity: faultSeverity
            };

            // Validate for NaN, undefined, or invalid ranges
            const validationIssues = [];
            if (isNaN(candidate.distance_m) || candidate.distance_m < 0) {
              validationIssues.push(`distance_m: ${distance} (calculated from lat1:${vehicleLat}, lon1:${vehicleLon}, lat2:${faultLat}, lon2:${faultLon})`);
            }
            if (isNaN(candidate.distance_cat) || candidate.distance_cat < 0 || candidate.distance_cat > 2) {
              validationIssues.push(`distance_cat: ${distanceCat} (from distance: ${distance})`);
            }
            if (isNaN(candidate.past_perf) || candidate.past_perf < 1 || candidate.past_perf > 10) {
              validationIssues.push(`past_perf: ${candidate.past_perf} (from performance: ${performance}, calculated: ${pastPerf})`);
            }
            if (isNaN(candidate.fault_history) || candidate.fault_history < 0) {
              validationIssues.push(`fault_history: ${faultHistory}`);
            }
            if (isNaN(candidate.fatigue_h) || candidate.fatigue_h < 0 || candidate.fatigue_h > 24) {
              validationIssues.push(`fatigue_h: ${candidate.fatigue_h} (from fatigueCount: ${fatigueCount})`);
            }
            if (isNaN(candidate.fault_severity) || candidate.fault_severity < 1 || candidate.fault_severity > 3) {
              validationIssues.push(`fault_severity: ${candidate.fault_severity} (from fault.category: ${fault.category})`);
            }

            if (validationIssues.length > 0) {
              logger.error('Invalid ML candidate values detected', {
                vehicleId: vehicle._id.toString(),
                vehicleNumber: vehicle.vehicle_number,
                candidate,
                validationIssues,
                rawValues: {
                  vehicleLat,
                  vehicleLon,
                  faultLat,
                  faultLon,
                  distance,
                  performance,
                  fatigueCount,
                  faultHistory,
                  faultCategory: fault.category,
                  calculatedPastPerf: pastPerf
                }
              });
            }

            return candidate;
          })
        );

        logger.debug("ML features extracted successfully", {
          featureCount: mlCandidates.length,
          sampleFeature: mlCandidates[0]
        });

        // Call ML service to predict best vehicle
        logger.debug("Calling ML service with candidates", {
          candidateCount: mlCandidates.length,
          sampleCandidate: mlCandidates[0]
        });

        const mlResult = await predictBestVehicle(mlCandidates);

        if (mlResult && mlResult.bestIndex !== undefined && mlResult.bestIndex < vehiclesAfterTimeoutFilter.length) {
          selectedVehicle = vehiclesAfterTimeoutFilter[mlResult.bestIndex];
          selectionScore = mlResult.bestScore;
          selectionMethod = "ML";

          logger.info("ML dispatch successful", {
            faultId: fault._id,
            selectedVehicle: selectedVehicle.vehicle_number,
            mlScore: selectionScore.toFixed(2),
            bestIndex: mlResult.bestIndex
          });
        } else {
          throw new Error("ML prediction returned invalid result");
        }
      } catch (mlError) {
        logger.warn("ML dispatch failed, falling back to rule-based", {
          faultId: fault._id,
          error: mlError.message
        });
        // Fall through to rule-based
      }
    }

    // If ML not available or failed, use rule-based
    if (!selectedVehicle) {
      logger.debug("Using rule-based vehicle selection", { faultId: fault._id });

      // Fetch all scoring data in parallel batch queries
      const [performanceMap, fatigueMap, locationExpMap, faultTypeExpMap] = await Promise.all([
        calculatePerformanceScoresBatch(vehicleIds),
        calculateFatigueLevelsBatch(vehicleIds),
        checkLocationExperienceBatch(vehicleIds, fault.fault_location),
        checkFaultTypeExperienceBatch(vehicleIds, fault.fault_type)
      ]);

      // Score all vehicles using pre-computed data
      scoredVehicles = scoreVehiclesBatch(
        vehiclesAfterTimeoutFilter,
        fault,
        performanceMap,
        fatigueMap,
        locationExpMap,
        faultTypeExpMap
      );

      // Sort by score (highest first)
      scoredVehicles.sort((a, b) => b.score - a.score);

      // Log scoring results
      logger.debug("Vehicle scoring results", {
        faultId: fault._id,
        results: scoredVehicles.map((sv, idx) => ({
          rank: idx + 1,
          vehicle: sv.vehicle.vehicle_number,
          score: sv.score.toFixed(2),
          breakdown: sv.breakdown
        }))
      });

      const bestMatch = scoredVehicles[0];
      selectedVehicle = bestMatch.vehicle;
      selectionScore = bestMatch.score;
      selectionMethod = "Rule";
      scoreBreakdown = bestMatch.breakdown;
    }

    // 3️⃣ Vehicle selected - continue with standard dispatch flow
    const device = selectedVehicle.assigned_device;

    logger.info("Selected vehicle for dispatch", {
      faultId: fault._id,
      vehicle: selectedVehicle.vehicle_number,
      score: selectionScore.toFixed(2),
      engine: selectionMethod,
      mlAvailable: mlAvailable
    });

    // 🔍 Validate device before dispatch
    if (!device) {
      if (prototypeMode) {
        console.log(`⚠️ PROTOTYPE MODE: Vehicle ${selectedVehicle.vehicle_number} has no assigned_device - proceeding without MQTT`);
      } else {
        console.error(`❌ CRITICAL: Selected vehicle ${selectedVehicle.vehicle_number} has no assigned_device!`);
        return {
          success: false,
          error: `Vehicle ${selectedVehicle.vehicle_number} has no assigned device. Cannot dispatch.`,
          fault_id: fault._id
        };
      }
    } else if (!device.device_id) {
      if (prototypeMode) {
        console.log(`⚠️ PROTOTYPE MODE: Device for vehicle ${selectedVehicle.vehicle_number} missing device_id - proceeding without MQTT`);
      } else {
        console.error(`❌ CRITICAL: Device object missing device_id field for vehicle ${selectedVehicle.vehicle_number}!`);
        return {
          success: false,
          error: `Device associated with vehicle ${selectedVehicle.vehicle_number} is missing device_id field. Cannot construct MQTT topic.`,
          fault_id: fault._id
        };
      }
    } else {
      console.log(`✅ Device validation passed: device_id = ${device.device_id}`);
      console.log(`📡 Expected MQTT topic: device/${device.device_id}/dispatch`);
    }

    // 4️⃣ Update fault status to pending confirmation
    fault.status = "pending_confirmation";
    fault.assigned_vehicle = selectedVehicle._id;
    await fault.save();

    // 5️⃣ Update vehicle status to onRoute
    selectedVehicle.status = "onRoute";
    await selectedVehicle.save();
    
    // Invalidate caches
    cache.delPattern('faults:*');
    cache.delPattern('vehicles:*');

    // 6️⃣ Send dispatch alert with priority
    const alert = await sendDispatchAlert(fault, selectedVehicle, device);
    
    // 6️⃣.5 Start dispatch timeout timer (only for vehicles WITH devices)
    // Prototype mode auto-confirm doesn't need timeout since it's immediate
    if (device && device.device_id) {
      const timeoutId = setTimeout(() => {
        handleDispatchTimeout(fault._id.toString(), selectedVehicle._id.toString());
      }, 60000); // 1 minute timeout

      activeDispatches.set(fault._id.toString(), {
        vehicleId: selectedVehicle._id.toString(),
        dispatchTime: new Date(),
        timeoutId: timeoutId
      });

      logger.info("Started dispatch timeout timer", {
        faultId: fault._id.toString(),
        vehicleId: selectedVehicle._id.toString(),
        vehicleNumber: selectedVehicle.vehicle_number
      });
    }
    
    // Get vehicle's latest GPS coordinates for route calculation
    const latestGPS = await GPS.findOne({ vehicle: selectedVehicle._id })
      .sort({ timestamp: -1 })
      .select('latitude longitude speed')
      .lean();
    
    // Emit WebSocket events for dispatch
    const io = getIO();
    if (io) {
      io.emit('fault:dispatched', {
        faultId: fault._id.toString(),
        vehicleId: selectedVehicle._id.toString(),
        vehicleNumber: selectedVehicle.vehicle_number,
        status: 'pending_confirmation',
        faultLatitude: fault.latitude,
        faultLongitude: fault.longitude,
        vehicleLatitude: latestGPS?.latitude || null,
        vehicleLongitude: latestGPS?.longitude || null
      });
      
      io.emit('vehicle:status-change', {
        vehicleId: selectedVehicle._id.toString(),
        status: 'onRoute',
        updatedFields: { status: 'onRoute' }
      });
      
      io.emit('fault:updated', {
        fault: {
          _id: fault._id.toString(),
          fault_type: fault.fault_type,
          fault_location: fault.fault_location,
          category: fault.category,
          status: fault.status,
          latitude: fault.latitude,
          longitude: fault.longitude,
          assigned_vehicle: selectedVehicle._id.toString()
        }
      });
    }

    // 7️⃣ Auto-confirm in prototype mode if no device
    let isAutoConfirmed = false;
    if (prototypeMode && (!device || !device.device_id)) {
      console.log(`🔄 PROTOTYPE MODE: Auto-confirming dispatch for vehicle ${selectedVehicle.vehicle_number}`);
      
      try {
        // Simulate confirmation - update fault status to assigned
        fault.status = "assigned";
        await fault.save();
        console.log(`✅ Fault ${fault._id} auto-assigned to vehicle ${selectedVehicle.vehicle_number}`);
        
        // Auto-create trip (same logic as MQTT confirmation handler)
        // Check if vehicle already has an ongoing trip - only one ongoing trip per vehicle allowed
        let trip = await Trip.findOne({
          vehicle: selectedVehicle._id,
          status: "ongoing"
        });
        
        if (!trip) {
          // No ongoing trip exists, create a new one
          // Multiple completed trips are allowed, but only one ongoing trip per vehicle
          trip = await Trip.create({
            vehicle: selectedVehicle._id,
            driver: selectedVehicle.assigned_driver?._id || null,
            start_time: new Date(),
            start_location: "Depot",
            status: "ongoing",
            managed_by: null
          });
          console.log(`🚗 Trip ${trip._id} auto-created for ${selectedVehicle.vehicle_number}`);
        } else {
          // Ongoing trip already exists, reuse it
          console.log(`🚗 Ongoing trip ${trip._id} already exists for ${selectedVehicle.vehicle_number}, reusing existing trip`);
        }
        
        // Keep vehicle status as "onRoute" until arrival at fault location
        // Status was already set to "onRoute" at line 570 during dispatch
        // Vehicle will change to "working" when it arrives at fault location (detected by GPS or simulator)
        
        // Emit WebSocket events for auto-confirmation (matching MQTT confirmation handler pattern)
        const io = getIO();
        if (io) {
          io.emit('vehicle:confirmation', {
            vehicleId: selectedVehicle._id.toString(),
            vehicleNumber: selectedVehicle.vehicle_number,
            faultId: fault._id.toString(),
            status: 'assigned'
          });
          
          io.emit('fault:updated', {
            fault: {
              _id: fault._id.toString(),
              status: 'assigned',
              assigned_vehicle: selectedVehicle._id.toString()
            }
          });
          
          // Emit status change - vehicle stays "onRoute" (not "working")
          io.emit('vehicle:status-change', {
            vehicleId: selectedVehicle._id.toString(),
            status: 'onRoute',
            updatedFields: { status: 'onRoute' }
          });
        }
        
        console.log(`📍 Vehicle ${selectedVehicle.vehicle_number} auto-confirmed, staying onRoute until arrival`);
        
        // Timer will start when vehicle arrives at fault location (detected by GPS or simulator)
        // Do NOT start timer here - vehicle hasn't arrived yet
        
        isAutoConfirmed = true;
      } catch (autoConfirmError) {
        console.error(`❌ Failed to auto-confirm dispatch:`, autoConfirmError);
        // Don't fail the dispatch - it was successful, just confirmation failed
      }
    }

    // 8️⃣ Prepare result
    const dispatchResult = {
      fault_id: fault._id,
      fault_type: fault.fault_type,
      fault_location: fault.fault_location,
      fault_category: fault.category,
      selected_vehicle: selectedVehicle.vehicle_number,
      device_id: device?.device_id || null,
      driver: selectedVehicle.assigned_driver?.name || "Not assigned",
      selection_score: selectionScore.toFixed(2),
      selection_method: selectionMethod,
      score_breakdown: scoreBreakdown,
      alert_priority: alert.priority,
      status: isAutoConfirmed ? "assigned" : "pending_confirmation",
      alternatives: scoredVehicles.length > 0 ? scoredVehicles.slice(1, 3).map(sv => ({
        vehicle: sv.vehicle.vehicle_number,
        score: sv.score.toFixed(2)
      })) : []
    };

    // Emit dispatch complete event
    if (io) {
      io.emit('dispatch:complete', {
        faultId: fault._id.toString(),
        vehicleId: selectedVehicle._id.toString(),
        vehicleNumber: selectedVehicle.vehicle_number,
        dispatchResult: dispatchResult
      });
    }
    
    logger.info("Dispatch complete", {
      faultId: fault._id,
      vehicle: selectedVehicle.vehicle_number,
      deviceId: device?.device_id || null
    });
    
    return {
      success: true,
      result: dispatchResult,
      fault_id: fault._id
    };

  } catch (error) {
    logger.error("Dispatch error", {
      faultId: fault._id,
      error: error.message,
      stack: error.stack
    });
    return {
      success: false,
      error: error.message,
      fault_id: fault._id
    };
  }
};

/**
 * Main Dispatch Engine with AI Vehicle Selection (HTTP Endpoint)
 * This endpoint can be called manually or used for batch processing
 * Processes all waiting faults until no more can be dispatched
 */
export const runDispatchEngine = async (req, res) => {
  try {
    logger.info("Running AI Dispatch Engine (Batch Mode)");

    let dispatchedCount = 0;
    let failedCount = 0;
    const results = [];
    const maxIterations = 100; // Safety limit to prevent infinite loops
    let iterations = 0;

    while (iterations < maxIterations) {
      iterations++;
      
      // Refresh waiting faults list each iteration to get updated status
      const waitingFaults = await Fault.find({ status: "waiting" })
        .sort({ reported_date: 1 });
      
      if (waitingFaults.length === 0) {
        logger.info("No more waiting faults - batch complete", { iterations, dispatchedCount, failedCount });
        break;
      }

      // Log total waiting faults on first iteration
      if (iterations === 1) {
        logger.info("Found waiting faults to process", { count: waitingFaults.length });
      }

      // Process first waiting fault
      const fault = waitingFaults[0];
      const dispatchResult = await dispatchFaultToVehicle(fault);

      if (dispatchResult.success) {
        dispatchedCount++;
        results.push({
          fault_id: fault._id.toString(),
          vehicle: dispatchResult.result.selected_vehicle,
          status: "dispatched"
        });
        logger.info("Fault dispatched in batch", { iteration: iterations, faultId: fault._id, vehicle: dispatchResult.result.selected_vehicle });
      } else {
        failedCount++;
        results.push({
          fault_id: fault._id.toString(),
          error: dispatchResult.error,
          status: "failed"
        });
        logger.warn("Failed to dispatch fault in batch", { iteration: iterations, faultId: fault._id, error: dispatchResult.error });
        
        // Stop if no vehicles available (all remaining faults will fail)
        if (dispatchResult.error.includes("No available vehicles")) {
          logger.info("Stopping batch - no more available vehicles", { iterations, dispatchedCount, failedCount });
          break;
        }
      }
    }

    // Safety check - log warning if max iterations reached
    if (iterations >= maxIterations) {
      logger.warn("Reached maximum iteration limit", { maxIterations, dispatchedCount, failedCount });
    }

    // Return results
    if (dispatchedCount === 0 && failedCount === 0) {
      return res.json({ message: "No waiting faults to dispatch." });
    }

    logger.info("Batch dispatch summary", { dispatched: dispatchedCount, failed: failedCount, iterations });
    
    res.json({
      message: `Dispatched ${dispatchedCount} fault(s), ${failedCount} failed`,
      dispatched: dispatchedCount,
      failed: failedCount,
      results: results
    });

  } catch (error) {
    logger.error("Dispatch batch error", { error: error.message, stack: error.stack });
    res.status(500).json({ error: error.message });
  }
};
