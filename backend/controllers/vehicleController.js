import Vehicle from "../models/Vehicle.js";
import HardwareDevice from "../models/HardwareDevice.js";
import GPS from "../models/GPS.js";
import Fault from "../models/Fault.js";
import mongoose from "mongoose";
import cache from "../services/cacheService.js";
import { getIO } from "../services/socketService.js";
import { startAutoResolutionTimer, cancelTimerIfNotWorking } from "../services/prototypeTimerService.js";
import { calculateDistance } from "../services/routingService.js";
import logger from "../services/logger.js";

export const getVehicles = async (_, res) => {
  try {
    const cacheKey = 'vehicles:all';
    
    // Try to get from cache
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    
    // Get the GPS collection name from the model
    const gpsCollectionName = GPS.collection.name;
    
    // Get all vehicles with latest GPS data using aggregation
    const vehicles = await Vehicle.aggregate([
      {
        $lookup: {
          from: gpsCollectionName,
          let: { vehicleId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$vehicle", "$$vehicleId"] } } },
            { $sort: { timestamp: -1 } },
            { $limit: 1 },
            { $project: { latitude: 1, longitude: 1, speed: 1, timestamp: 1 } }
          ],
          as: "latestGPS"
        }
      },
      {
        $addFields: {
          latitude: { $arrayElemAt: ["$latestGPS.latitude", 0] },
          longitude: { $arrayElemAt: ["$latestGPS.longitude", 0] },
          speed: { $arrayElemAt: ["$latestGPS.speed", 0] },
          gpsTimestamp: { $arrayElemAt: ["$latestGPS.timestamp", 0] }
        }
      },
      {
        $project: {
          latestGPS: 0 // Remove the array, keep only the fields we added
        }
      }
    ]);
    
    // Cache for 30 seconds
    cache.set(cacheKey, vehicles, 30);
    
    res.json(vehicles);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const addVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.create(req.body);
    // Invalidate vehicle cache
    cache.delPattern('vehicles:*');
    res.status(201).json(vehicle);
  }
  catch (e) { res.status(400).json({ error: e.message }); }
};

export const updateVehicle = async (req, res) => {
  try {
    // Get old vehicle status before update
    const oldVehicle = await Vehicle.findById(req.params.id);
    
    // ✅ Prevent invalid status transitions: working -> dispatched/onRoute
    // Once a vehicle is "working", it can only transition to "available" (or stay "working")
    if (oldVehicle?.status === 'working' && req.body.status) {
      const invalidTransitions = ['dispatched', 'onRoute'];
      if (invalidTransitions.includes(req.body.status)) {
        logger.warn('Invalid status transition: working -> dispatched/onRoute not allowed', {
          vehicleId: req.params.id,
          vehicleNumber: oldVehicle.vehicle_number,
          currentStatus: oldVehicle.status,
          attemptedStatus: req.body.status
        });
        
        return res.status(400).json({ 
          error: `Cannot change vehicle status from "working" to "${req.body.status}". Vehicle can only transition to "available" from "working".` 
        });
      }
    }
    
    const v = await Vehicle.findByIdAndUpdate(req.params.id, req.body, { new: true });
    // Invalidate vehicle cache
    cache.delPattern('vehicles:*');
    
    // Check if status changed to "working" (vehicle arrived at fault location)
    const statusChangedToWorking = req.body.status === 'working' && 
                                   oldVehicle?.status !== 'working';
    
    // Check if status changed away from "working" (cancel timer if so)
    const statusChangedAwayFromWorking = oldVehicle?.status === 'working' && 
                                        req.body.status && 
                                        req.body.status !== 'working';
    
    // Handle timer cancellation if status changed away from "working"
    if (statusChangedAwayFromWorking) {
      await cancelTimerIfNotWorking(v._id.toString(), req.body.status);
    }
    
    // Handle status change to "working" - validate vehicle is at fault location
    if (statusChangedToWorking) {
      try {
        // Find assigned fault for this vehicle
        const fault = await Fault.findOne({
          assigned_vehicle: v._id,
          status: { $in: ['assigned', 'pending_confirmation'] }
        });
        
        if (fault) {
          // Check if vehicle is at fault location (GPS proximity) BEFORE allowing status change
          const latestGPS = await GPS.findOne({ vehicle: v._id })
            .sort({ timestamp: -1 })
            .select('latitude longitude')
            .lean();
          
          if (latestGPS && fault.latitude && fault.longitude) {
            // Calculate distance (returns meters)
            const distanceMeters = calculateDistance(
              latestGPS.latitude, latestGPS.longitude,
              fault.latitude, fault.longitude
            );
            
            // PREVENT status change if not within 50 meters
            if (distanceMeters > 50) {
              logger.warn('Cannot set vehicle status to working - not at fault location', {
                vehicleId: v._id.toString(),
                faultId: fault._id.toString(),
                distance: distanceMeters.toFixed(2),
                requiredDistance: '50 meters',
                currentStatus: oldVehicle?.status
              });
              
              // Revert the status change to prevent invalid state
              v.status = oldVehicle?.status || 'onRoute';
              await v.save();
              
              // Invalidate cache
              cache.delPattern('vehicles:*');
              
              // Emit WebSocket event for status revert
              const io = getIO();
              if (io) {
                io.emit('vehicle:status-change', {
                  vehicleId: v._id.toString(),
                  status: v.status,
                  updatedFields: { status: v.status },
                  reason: 'Vehicle not at fault location'
                });
              }
              
              return res.status(400).json({ 
                error: `Vehicle is ${distanceMeters.toFixed(2)}m away from fault location. Must be within 50m to set status to 'working'. Status reverted to '${v.status}'.` 
              });
            }
            
            // Vehicle is within 50 meters - status change is valid
            // ✅ Save GPS data when status changes to "working" via API
            // Use latest GPS coordinates (vehicle is at fault location)
            try {
              if (latestGPS && latestGPS.latitude != null && latestGPS.longitude != null) {
                await GPS.create({
                  vehicle: v._id,
                  latitude: latestGPS.latitude,
                  longitude: latestGPS.longitude,
                  speed: latestGPS.speed || 0,
                  timestamp: new Date()
                });
                
                // Invalidate GPS cache
                cache.del(`vehicle:${v._id.toString()}:gps:latest`);
                
                logger.info('Saved GPS data when vehicle status changed to working (API)', {
                  vehicleId: v._id.toString(),
                  faultId: fault._id.toString(),
                  latitude: latestGPS.latitude,
                  longitude: latestGPS.longitude,
                  distance: distanceMeters.toFixed(2)
                });
              }
            } catch (gpsError) {
              logger.error('Error saving GPS data when status changed to working (API)', {
                vehicleId: v._id.toString(),
                faultId: fault._id.toString(),
                error: gpsError.message,
                stack: gpsError.stack
              });
              // Continue even if GPS save fails
            }
            
            // Start auto-resolution timer (will cancel any existing timer)
            await startAutoResolutionTimer(
              v._id.toString(),
              fault._id.toString(),
              v,
              fault
            );
            logger.info('Started auto-resolution timer after status change to working', {
              vehicleId: v._id.toString(),
              faultId: fault._id.toString(),
              distance: distanceMeters.toFixed(2),
              willResolveIn: '30 seconds'
            });
          } else {
            // Missing GPS or fault location data - allow status change but log warning
            logger.warn('Vehicle status changed to working but cannot verify location', {
              vehicleId: v._id.toString(),
              faultId: fault._id.toString(),
              hasGPS: !!latestGPS,
              hasFaultLocation: !!(fault.latitude && fault.longitude)
            });
            
            // ✅ Try to save GPS even if location verification failed
            // Use latest GPS if available, otherwise use fault location
            try {
              let gpsToSave = null;
              
              if (latestGPS && latestGPS.latitude != null && latestGPS.longitude != null) {
                gpsToSave = {
                  latitude: latestGPS.latitude,
                  longitude: latestGPS.longitude,
                  speed: latestGPS.speed || 0
                };
              } else if (fault && fault.latitude && fault.longitude) {
                gpsToSave = {
                  latitude: fault.latitude,
                  longitude: fault.longitude,
                  speed: 0
                };
              }
              
              if (gpsToSave) {
                await GPS.create({
                  vehicle: v._id,
                  latitude: gpsToSave.latitude,
                  longitude: gpsToSave.longitude,
                  speed: gpsToSave.speed,
                  timestamp: new Date()
                });
                
                cache.del(`vehicle:${v._id.toString()}:gps:latest`);
                
                logger.info('Saved GPS data when vehicle status changed to working (API - fallback)', {
                  vehicleId: v._id.toString(),
                  faultId: fault._id.toString(),
                  latitude: gpsToSave.latitude,
                  longitude: gpsToSave.longitude,
                  source: latestGPS ? 'latestGPS' : 'faultLocation'
                });
              }
            } catch (gpsError) {
              logger.error('Error saving GPS data when status changed to working (API - fallback)', {
                vehicleId: v._id.toString(),
                error: gpsError.message
              });
            }
            
            // Still start timer as a safety measure (GPS-based arrival detection will handle it if needed)
            await startAutoResolutionTimer(
              v._id.toString(),
              fault._id.toString(),
              v,
              fault
            );
          }
        }
      } catch (timerError) {
        logger.error('Error starting timer on status change to working', {
          vehicleId: v._id.toString(),
          error: timerError.message,
          stack: timerError.stack
        });
        // Don't fail the update - timer error is non-critical, but log it
      }
    }
    
    // Emit WebSocket events for vehicle updates
    const io = getIO();
    if (io) {
      // Emit status change if status was updated
      if (req.body.status) {
        io.emit('vehicle:status-change', {
          vehicleId: v._id.toString(),
          status: v.status,
          updatedFields: req.body
        });
      }
      
      // Emit general vehicle update
      io.emit('vehicle:update', {
        vehicleId: v._id.toString(),
        vehicle: v,
        updatedFields: req.body
      });
    }
    
    res.json(v);
  } catch (e) { res.status(400).json({ error: e.message }); }
};

export const removeVehicle = async (req, res) => {
  try {
    await Vehicle.findByIdAndDelete(req.params.id);
    // Invalidate vehicle cache
    cache.delPattern('vehicles:*');
    res.json({ ok: true });
  }
  catch (e) { res.status(400).json({ error: e.message }); }
};

export const assignDevice = async (req, res) => {
  try {
    const { vehicleId, deviceId } = req.body;
    
    // Update vehicle's assigned_device
    const vehicle = await Vehicle.findByIdAndUpdate(vehicleId, { assigned_device: deviceId }, { new: true })
      .populate("assigned_device");
    
    // Update device's vehicle reference (bidirectional sync)
    await HardwareDevice.findByIdAndUpdate(deviceId, { vehicle: vehicleId });
    
    // Invalidate vehicle cache
    cache.delPattern('vehicles:*');
    
    res.json(vehicle);
  } catch (e) { res.status(400).json({ error: e.message }); }
};
