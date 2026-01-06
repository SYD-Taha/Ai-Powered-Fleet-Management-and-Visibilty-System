import Driver from "../models/Driver.js";
import Vehicle from "../models/Vehicle.js";

export const getDrivers = async (_, res) => {
  try { res.json(await Driver.find().populate("assigned_vehicle")); }
  catch (e) { res.status(500).json({ error: e.message }); }
};

export const addDriver = async (req, res) => {
  try { res.status(201).json(await Driver.create(req.body)); }
  catch (e) { res.status(400).json({ error: e.message }); }
};

export const assignVehicle = async (req, res) => {
  try {
    const { driverId, vehicleId } = req.body;
    
    // Update driver's assigned_vehicle
    const d = await Driver.findByIdAndUpdate(driverId, { assigned_vehicle: vehicleId }, { new: true })
      .populate("assigned_vehicle");
    
    // Update vehicle's assigned_driver (bidirectional sync)
    await Vehicle.findByIdAndUpdate(vehicleId, { assigned_driver: driverId });
    
    res.json(d);
  } catch (e) { res.status(400).json({ error: e.message }); }
};
