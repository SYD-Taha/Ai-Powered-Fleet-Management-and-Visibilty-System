import Fault from "../models/Fault.js";
import FaultCategory from "../models/FaultCategory.js";
import { dispatchFaultToVehicle } from "./dispatchController.js";
import cache from "../services/cacheService.js";
import { getIO } from "../services/socketService.js";

export const getFaults = async (_, res) => {
  try {
    const cacheKey = 'faults:all';
    
    // Try to get from cache
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    
    const faults = await Fault.find().populate("assigned_vehicle");
    
    // Cache for 30 seconds
    cache.set(cacheKey, faults, 30);
    
    res.json(faults);
  }
  catch (e) { res.status(500).json({ error: e.message }); }
};

export const reportFault = async (req, res) => {
  try {
    // Validate coordinates if provided (Karachi area: lat ~24.8-24.95, lng ~66.9-67.2)
    if (req.body.latitude !== undefined) {
      if (req.body.latitude < 24.8 || req.body.latitude > 24.95) {
        return res.status(400).json({ error: "Latitude must be between 24.8 and 24.95 (Karachi area)" });
      }
    }
    if (req.body.longitude !== undefined) {
      if (req.body.longitude < 66.9 || req.body.longitude > 67.2) {
        return res.status(400).json({ error: "Longitude must be between 66.9 and 67.2 (Karachi area)" });
      }
    }
    
    // Create the fault
    const fault = await Fault.create(req.body);
    
    // Invalidate fault cache
    cache.delPattern('faults:*');
    
    // Emit WebSocket event for new fault
    const io = getIO();
    if (io) {
      io.emit('fault:created', {
        fault: {
          _id: fault._id.toString(),
          fault_type: fault.fault_type,
          fault_location: fault.fault_location,
          category: fault.category,
          status: fault.status,
          latitude: fault.latitude,
          longitude: fault.longitude,
          detail: fault.detail,
          reported_date: fault.reported_date
        }
      });
    }
    
    // Send response immediately (non-blocking)
    res.status(201).json(fault);
    
    // Trigger dispatch asynchronously (non-blocking, runs in background)
    setImmediate(async () => {
      try {
        console.log(`🚀 Auto-dispatching fault ${fault._id} (${fault.fault_type} at ${fault.fault_location})`);
        const dispatchResult = await dispatchFaultToVehicle(fault);
        
        if (dispatchResult.success) {
          console.log(`✅ Auto-dispatch successful for fault ${fault._id}: ${dispatchResult.result.selected_vehicle}`);
        } else {
          console.warn(`⚠️ Auto-dispatch failed for fault ${fault._id}: ${dispatchResult.error}`);
          console.log(`   Fault will remain in 'waiting' status and can be dispatched manually later.`);
        }
      } catch (error) {
        // Log error but don't crash - fault creation was successful
        console.error(`❌ Error during auto-dispatch for fault ${fault._id}:`, error.message);
        console.log(`   Fault ${fault._id} was created successfully but dispatch failed. It can be dispatched manually later.`);
      }
    });
  }
  catch (e) { res.status(400).json({ error: e.message }); }
};

export const addCategory = async (req, res) => {
  try { res.status(201).json(await FaultCategory.create(req.body)); }
  catch (e) { res.status(400).json({ error: e.message }); }
};

export const getCategories = async (_, res) => {
  try { res.json(await FaultCategory.find()); }
  catch (e) { res.status(500).json({ error: e.message }); }
};
