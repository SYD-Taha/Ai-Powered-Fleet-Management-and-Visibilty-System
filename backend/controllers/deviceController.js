import HardwareDevice from "../models/HardwareDevice.js";

// Get all devices
export const getDevices = async (req, res) => {
  try {
    const devices = await HardwareDevice.find().populate("vehicle", "vehicle_number status");
    res.json(devices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Register a new hardware device
export const registerDevice = async (req, res) => {
  try {
    const device = new HardwareDevice(req.body);
    const savedDevice = await device.save();
    res.status(201).json(savedDevice);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
