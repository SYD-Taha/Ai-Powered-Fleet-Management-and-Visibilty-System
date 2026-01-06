import mongoose from "mongoose";
import GPS from "../models/GPS.js";
import Vehicle from "../models/Vehicle.js";
import Fault from "../models/Fault.js";
import Route from "../models/Route.js";
import cache from "../services/cacheService.js";
import { getIO } from "../services/socketService.js";
import { calculateRoute, calculateDistance } from "../services/routingService.js";
import { getLatestGPS } from "../services/gpsService.js";
import logger from "../services/logger.js";
import { startAutoResolutionTimer, hasActiveTimer } from "../services/prototypeTimerService.js";

/**
 * Cancel active routes for a vehicle when status changes to available
 * @param {ObjectId} vehicleId - Vehicle ID
 * @param {string} reason - Reason for cancellation ('available', 'cancelled', etc.)
 */
export const cancelActiveRoutes = async (vehicleId, reason = 'cancelled') => {
  try {
    const cancelledRoutes = await Route.updateMany(
      {
        vehicle: vehicleId,
        status: 'active'
      },
      {
        status: reason === 'available' ? 'cancelled' : reason
      }
    );

    if (cancelledRoutes.modifiedCount > 0) {
      logger.info('Cancelled active routes for vehicle', {
        vehicleId: vehicleId.toString(),
        cancelledCount: cancelledRoutes.modifiedCount,
        reason
      });
    }

    return cancelledRoutes.modifiedCount;
  } catch (error) {
    logger.error('Error cancelling active routes', {
      vehicleId: vehicleId?.toString(),
      error: error.message,
      stack: error.stack
    });
    return 0;
  }
};

// ✅ Add new GPS point
export const addPoint = async (req, res) => {
  try {
    const { vehicle, latitude, longitude, speed } = req.body;

    // Validate vehicle ID first
    if (!vehicle || (typeof vehicle !== 'string' && typeof vehicle !== 'object')) {
      return res.status(400).json({ 
        error: 'Invalid vehicle ID',
        details: 'Vehicle ID is required'
      });
    }

    // Validate ObjectId format
    const vehicleStr = typeof vehicle === 'string' ? vehicle : vehicle.toString();
    if (!mongoose.Types.ObjectId.isValid(vehicleStr)) {
      return res.status(400).json({ 
        error: 'Invalid vehicle ID format',
        details: `Vehicle ID must be a valid MongoDB ObjectId. Received: ${vehicleStr}`
      });
    }

    // Validate coordinates before creating
    if (latitude != null && longitude != null) {
      if (typeof latitude !== 'number' || typeof longitude !== 'number' ||
          isNaN(latitude) || isNaN(longitude) ||
          latitude < -90 || latitude > 90 ||
          longitude < -180 || longitude > 180) {
        return res.status(400).json({ 
          error: 'Invalid GPS coordinates',
          details: `Latitude must be -90 to 90, Longitude must be -180 to 180. Received: lat=${latitude}, lng=${longitude}`
        });
      }
    }

    // Ensure vehicle is stored as ObjectId
    const vehicleId = new mongoose.Types.ObjectId(vehicleStr);
    const newPoint = await GPS.create({ vehicle: vehicleId, latitude, longitude, speed });

    // Invalidate GPS cache for this vehicle and vehicle list cache
    cache.del(`vehicle:${vehicleId}:gps:latest`);
    cache.delPattern('vehicles:*');
    
    // Emit WebSocket event for real-time GPS update
    const io = getIO();
    if (io) {
      io.emit('vehicle:gps-update', {
        vehicleId: vehicleId.toString(),
        latitude: newPoint.latitude,
        longitude: newPoint.longitude,
        speed: newPoint.speed,
        timestamp: newPoint.timestamp
      });
    }
    
    // Check if vehicle has arrived at assigned fault location
    await checkVehicleArrival(vehicleId, newPoint.latitude, newPoint.longitude);
    
    // Check if route recalculation is needed (vehicle moved > 100m from route start)
    await checkAndRecalculateRoute(vehicleId, newPoint.latitude, newPoint.longitude);
    
    res.status(201).json(newPoint);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

// ✅ Get latest GPS point for a specific vehicle
export const latestByVehicle = async (req, res) => {
  try {
    const vehicleId = new mongoose.Types.ObjectId(req.params.vehicleId);
    
    // Use centralized GPS service
    const gpsData = await getLatestGPS(vehicleId, false); // Don't use default for API response
    
    if (!gpsData) {
      return res.status(404).json({ error: "GPS data not found for this vehicle" });
    }
    
    res.json(gpsData);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

/**
 * Check if vehicle has arrived at assigned fault location
 * Updates vehicle status to "working" when within 50 meters of fault
 */
const checkVehicleArrival = async (vehicleId, latitude, longitude) => {
  try {
    // Find vehicle
    const vehicle = await Vehicle.findById(vehicleId);
    
    // Allow check for vehicles that are "onRoute" OR "working"
    // - "onRoute": Normal case - vehicle is traveling to fault
    // - "working": Edge case - status might have been set incorrectly, need to verify/start timer
    if (!vehicle || (vehicle.status !== 'onRoute' && vehicle.status !== 'working')) return;
    
    // Find assigned fault (fault assigned to this vehicle)
    const fault = await Fault.findOne({ 
      assigned_vehicle: vehicleId,
      status: { $in: ['assigned', 'pending_confirmation'] }
    });
    
    if (!fault || !fault.latitude || !fault.longitude) return;
    
    // Use routing service to calculate road distance (more accurate than straight-line)
    // Cache key for arrival check route
    const routeCacheKey = `arrival:${vehicleId}:${fault._id}`;
    let distanceMeters;
    
    // Check if we have a cached route distance
    const cachedDistance = cache.get(routeCacheKey);
    if (cachedDistance !== null) {
      distanceMeters = cachedDistance;
    } else {
      try {
        // Try to get road distance from routing service
        const route = await calculateRoute(
          { lat: latitude, lng: longitude },
          { lat: fault.latitude, lng: fault.longitude }
        );
        distanceMeters = route.distance;
        
        // Cache the distance for 30 seconds (arrival checks happen frequently)
        cache.set(routeCacheKey, distanceMeters, 30);
      } catch (routeError) {
        // Fallback to straight-line distance if routing fails
        logger.warn("Route calculation failed for arrival check, using Haversine", {
          vehicleId: vehicleId.toString(),
          faultId: fault._id.toString(),
          error: routeError.message
        });
        distanceMeters = calculateDistance(
          latitude, longitude,
          fault.latitude, fault.longitude
        );
      }
    }
    
    // Arrival threshold: 50 meters
    if (distanceMeters <= 50) {
      // Clear arrival check cache
      cache.del(routeCacheKey);
      
      // Only update status if it's not already "working" (avoid unnecessary updates)
      const statusChanged = vehicle.status !== 'working';
      if (statusChanged) {
        vehicle.status = 'working';
        await vehicle.save();
        
        // ✅ Save GPS data when status changes to "working"
        // Use the exact coordinates that triggered arrival detection (fresh GPS update)
        // This ensures location persists correctly if browser/server reloads
        try {
          await GPS.create({
            vehicle: vehicleId,
            latitude: latitude,
            longitude: longitude,
            speed: 0, // Vehicle is stopped at fault location
            timestamp: new Date()
          });
          
          // Invalidate GPS cache to force reload with fresh data
          cache.del(`vehicle:${vehicleId.toString()}:gps:latest`);
          
          logger.info('Saved GPS data when vehicle status changed to working (arrival detection)', {
            vehicleId: vehicleId.toString(),
            faultId: fault._id.toString(),
            latitude,
            longitude,
            distance: distanceMeters.toFixed(2)
          });
        } catch (gpsError) {
          logger.error('Error saving GPS data when status changed to working (arrival detection)', {
            vehicleId: vehicleId.toString(),
            faultId: fault._id.toString(),
            error: gpsError.message,
            stack: gpsError.stack
          });
          // Continue even if GPS save fails - status change should still proceed
        }
        
        // Invalidate cache
        cache.delPattern('vehicles:*');
        
        // Emit WebSocket events only if status changed
        const io = getIO();
        if (io) {
          io.emit('vehicle:arrived', {
            vehicleId: vehicleId.toString(),
            faultId: fault._id.toString(),
            status: 'working'
          });
          
          io.emit('vehicle:status-change', {
            vehicleId: vehicleId.toString(),
            status: 'working',
            updatedFields: { status: 'working' }
          });
        }
        
        logger.info('Vehicle arrived at fault location', {
          vehicleId: vehicleId.toString(),
          faultId: fault._id.toString(),
          distance: distanceMeters.toFixed(2),
          previousStatus: vehicle.status
        });
      }
      
      // Mark active route as completed
      try {
        const activeRoute = await Route.findOne({
          vehicle: vehicleId,
          fault: fault._id,
          status: 'active'
        });
        
        if (activeRoute) {
          activeRoute.status = 'completed';
          await activeRoute.save();
          
          logger.info('Route marked as completed on vehicle arrival', {
            routeId: activeRoute._id.toString(),
            vehicleId: vehicleId.toString(),
            faultId: fault._id.toString()
          });
        }
      } catch (routeUpdateError) {
        logger.error('Failed to mark route as completed', {
          vehicleId: vehicleId.toString(),
          faultId: fault._id.toString(),
          error: routeUpdateError.message
        });
        // Continue even if route update fails
      }
      
      // Start auto-resolution timer ONLY when status changes to "working"
      // This prevents the timer from restarting on every GPS update
      // Timer starts when vehicle FIRST arrives at fault location
      // After 30 seconds, fault will be automatically resolved and vehicle becomes available
      if (statusChanged) {
        await startAutoResolutionTimer(
          vehicleId.toString(),
          fault._id.toString(),
          vehicle,
          fault
        );
        logger.info('Started auto-resolution timer after vehicle arrival', {
          vehicleId: vehicleId.toString(),
          faultId: fault._id.toString(),
          distance: distanceMeters.toFixed(2),
          willResolveIn: '30 seconds'
        });
      } else {
        // Vehicle is already "working" - timer should already be running
        // Log if timer is missing (shouldn't happen, but helps with debugging)
        if (!hasActiveTimer(vehicleId.toString())) {
          logger.warn('Vehicle is working but no timer found - starting timer', {
            vehicleId: vehicleId.toString(),
            faultId: fault._id.toString()
          });
          // Safety: start timer if it's missing (edge case recovery)
          await startAutoResolutionTimer(
            vehicleId.toString(),
            fault._id.toString(),
            vehicle,
            fault
          );
        }
      }
    } else if (vehicle.status === 'working' && distanceMeters > 50) {
      // Edge case: Vehicle has status "working" but is far away from fault location
      // This can happen if status was set incorrectly (e.g., via API before arrival)
      // Reset status to "onRoute" so arrival detection can work properly
      logger.warn('Vehicle status is "working" but not at fault location - resetting to onRoute', {
        vehicleId: vehicleId.toString(),
        faultId: fault._id.toString(),
        distance: distanceMeters.toFixed(2),
        threshold: '50 meters'
      });
      
      vehicle.status = 'onRoute';
      await vehicle.save();
      
      // Cancel any active timer (vehicle is not actually at location)
      const { cancelTimer } = await import("../services/prototypeTimerService.js");
      cancelTimer(vehicleId.toString());
      
      // Invalidate cache
      cache.delPattern('vehicles:*');
      
      // Emit WebSocket event for status correction
      const io = getIO();
      if (io) {
        io.emit('vehicle:status-change', {
          vehicleId: vehicleId.toString(),
          status: 'onRoute',
          updatedFields: { status: 'onRoute' },
          reason: 'Vehicle not at fault location - status corrected'
        });
      }
      
      logger.info('Vehicle status corrected from working to onRoute', {
        vehicleId: vehicleId.toString(),
        faultId: fault._id.toString(),
        distance: distanceMeters.toFixed(2)
      });
    }
  } catch (error) {
    logger.error('Error checking vehicle arrival', {
      vehicleId: vehicleId?.toString(),
      error: error.message,
      stack: error.stack
    });
  }
};

/**
 * Calculate expected position along route based on elapsed time
 * Uses same logic as frontend calculatePositionAlongRoute for consistency
 * @param {Array} waypoints - Array of [lat, lng] pairs
 * @param {Date|number} routeStartTime - Timestamp when route started (Date object or number)
 * @param {number} routeTotalDistance - Total route distance in meters
 * @param {number} routeDuration - Total route duration in seconds
 * @returns {[number, number]|null} Expected position [lat, lng] or null if route complete
 */
const calculateExpectedPositionOnRoute = (waypoints, routeStartTime, routeTotalDistance, routeDuration) => {
  if (!waypoints || waypoints.length < 2) {
    return null;
  }

  // Handle both Date object and number (timestamp)
  const startTime = routeStartTime instanceof Date ? routeStartTime.getTime() : routeStartTime;
  const elapsedTime = (Date.now() - startTime) / 1000; // seconds
  
  // Use same speed calculation as frontend (60 km/h = 16.67 m/s)
  const speed = 16.67; // m/s (matches frontend default)
  const expectedDistanceTraveled = elapsedTime * speed; // meters

  // If route is complete, return destination
  if (expectedDistanceTraveled >= routeTotalDistance) {
    return waypoints[waypoints.length - 1];
  }

  // Find which segment we should be on
  let accumulatedDistance = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const segmentStart = waypoints[i]; // [lat, lng]
    const segmentEnd = waypoints[i + 1]; // [lat, lng]
    
    const segmentDistance = calculateDistance(
      segmentStart[0], segmentStart[1],
      segmentEnd[0], segmentEnd[1]
    );

    if (accumulatedDistance + segmentDistance >= expectedDistanceTraveled) {
      // We should be on this segment
      const distanceOnSegment = expectedDistanceTraveled - accumulatedDistance;
      const t = distanceOnSegment / segmentDistance; // 0 to 1
      
      // Interpolate position
      const lat = segmentStart[0] + (segmentEnd[0] - segmentStart[0]) * t;
      const lng = segmentStart[1] + (segmentEnd[1] - segmentStart[1]) * t;
      
      return [lat, lng];
    }

    accumulatedDistance += segmentDistance;
  }

  // Fallback: return destination
  return waypoints[waypoints.length - 1];
};

/**
 * Check if route recalculation is needed and recalculate if vehicle deviated > 100m from expected route position
 * @param {ObjectId} vehicleId - Vehicle ID
 * @param {number} latitude - Current latitude
 * @param {number} longitude - Current longitude
 */
const checkAndRecalculateRoute = async (vehicleId, latitude, longitude) => {
  try {
    // Only check for vehicles on route
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle || vehicle.status !== 'onRoute') {
      return;
    }

    // Find active route for this vehicle
    const activeRoute = await Route.findOne({
      vehicle: vehicleId,
      status: 'active'
    }).populate('fault');

    if (!activeRoute || !activeRoute.fault) {
      return; // No active route to recalculate
    }

    const fault = activeRoute.fault;
    
    // Validate route data
    if (!activeRoute.waypoints || activeRoute.waypoints.length === 0 || 
        !activeRoute.distance || !activeRoute.duration) {
      return; // Invalid route
    }

    // Use routeStartTime if available, otherwise fallback to calculatedAt (for backward compatibility)
    const routeStartTime = activeRoute.routeStartTime || activeRoute.calculatedAt;
    if (!routeStartTime) {
      logger.warn("Route missing both routeStartTime and calculatedAt", {
        routeId: activeRoute._id.toString(),
        vehicleId: vehicleId.toString()
      });
      return; // Cannot calculate expected position without start time
    }

    // Calculate expected position along route based on elapsed time
    // Uses same logic as frontend for consistency
    const expectedPosition = calculateExpectedPositionOnRoute(
      activeRoute.waypoints,
      routeStartTime,
      activeRoute.distance,
      activeRoute.duration
    );

    if (!expectedPosition) {
      return; // Route is complete
    }

    // Calculate distance from current GPS to expected position on route
    const deviationFromRoute = calculateDistance(
      latitude,
      longitude,
      expectedPosition[0],
      expectedPosition[1]
    );

    // Recalculate if vehicle deviated significantly from expected route position
    // Increased threshold to 200m to prevent frequent recalculations
    // Also check if route is near completion (within 500m) - don't recalculate near destination
    const distanceToDestination = calculateDistance(
      latitude,
      longitude,
      activeRoute.waypoints[activeRoute.waypoints.length - 1][0],
      activeRoute.waypoints[activeRoute.waypoints.length - 1][1]
    );
    
    // Only recalculate if:
    // 1. Deviation > 200m (increased from 100m to reduce sensitivity)
    // 2. Vehicle is not too close to destination (> 500m away)
    // 3. Route hasn't been recalculated too recently (prevent rapid recalculation loops)
    const routeAge = Date.now() - (routeStartTime instanceof Date ? routeStartTime.getTime() : routeStartTime);
    const routeAgeSeconds = routeAge / 1000;
    const shouldRecalculate = deviationFromRoute > 200 && 
                              distanceToDestination > 500 && 
                              routeAgeSeconds > 30; // Don't recalculate routes less than 30 seconds old
    
    if (shouldRecalculate) {
      logger.info("Vehicle deviated significantly from expected route position, recalculating route", {
        vehicleId: vehicleId.toString(),
        deviationFromRoute: deviationFromRoute.toFixed(2) + 'm',
        distanceToDestination: distanceToDestination.toFixed(2) + 'm',
        routeAgeSeconds: routeAgeSeconds.toFixed(1) + 's',
        expectedPosition: expectedPosition,
        currentPosition: [latitude, longitude],
        faultId: fault._id.toString()
      });

      // Calculate new route from current GPS to fault
      if (fault.latitude && fault.longitude) {
        try {
          const newRouteData = await calculateRoute(
            { lat: latitude, lng: longitude },
            { lat: fault.latitude, lng: fault.longitude }
          );

          // Mark old route as superseded
          activeRoute.status = 'superseded';
          await activeRoute.save();

          // Create new route record
          // IMPORTANT: When recalculating, routeStartTime = NOW (current time)
          // This ensures the frontend animation starts from the current moment, not from when route was calculated
          const now = new Date();
          const newRoute = await Route.create({
            vehicle: vehicleId,
            fault: fault._id,
            waypoints: newRouteData.waypoints,
            distance: newRouteData.distance,
            duration: newRouteData.duration,
            source: newRouteData.source || 'osrm',
            isFallback: newRouteData.isFallback || false,
            calculatedAt: new Date(newRouteData.calculatedAt || Date.now()),
            routeStartTime: now, // Route starts NOW when recalculated
            status: 'active',
            geometry: newRouteData.geometry,
            summary: newRouteData.summary
          });

          logger.info("Route recalculated and saved", {
            oldRouteId: activeRoute._id.toString(),
            newRouteId: newRoute._id.toString(),
            vehicleId: vehicleId.toString(),
            faultId: fault._id.toString(),
            newDistance: newRouteData.distance,
            newDuration: newRouteData.duration
          });

          // Emit route update event to frontend
          // IMPORTANT: routeStartTime is NOW (current time) when route is recalculated
          // This ensures animation starts from the current moment, preventing teleporting
          const routeStartTimeMs = now.getTime();
          const io = getIO();
          if (io) {
            io.emit('route:updated', {
              vehicleId: vehicleId.toString(),
              faultId: fault._id.toString(),
              route: {
                waypoints: newRouteData.waypoints,
                distance: newRouteData.distance,
                duration: newRouteData.duration,
                isFallback: newRouteData.isFallback || false,
                calculatedAt: newRouteData.calculatedAt || routeStartTimeMs,
                routeStartTime: routeStartTimeMs, // Current time when route update happens (prevents teleporting)
                source: newRouteData.source || 'osrm'
              }
            });
          }
        } catch (routeError) {
          logger.error("Route recalculation failed", {
            vehicleId: vehicleId.toString(),
            faultId: fault._id.toString(),
            error: routeError.message
          });
          // Continue - old route remains active
        }
      }
    }
  } catch (error) {
    logger.error('Error checking route recalculation', {
      vehicleId: vehicleId?.toString(),
      error: error.message,
      stack: error.stack
    });
  }
};

// ✅ Get GPS track history for a vehicle
export const trackByVehicle = async (req, res) => {
  try {
    const vehicleId = new mongoose.Types.ObjectId(req.params.vehicleId);
    const { from, to, limit } = req.query;

    const q = { vehicle: vehicleId };
    if (from || to) q.timestamp = {};
    if (from) q.timestamp.$gte = new Date(from);
    if (to) q.timestamp.$lte = new Date(to);

    const data = await GPS.find(q).sort({ timestamp: 1 }).limit(parseInt(limit || "1000"));
    res.json(data);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};
