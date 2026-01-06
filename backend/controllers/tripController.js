import Trip from "../models/Trip.js";

export const getTrips = async (_, res) => {
  try { res.json(await Trip.find().populate("vehicle driver")); }
  catch (e) { res.status(500).json({ error: e.message }); }
};

export const startTrip = async (req, res) => {
  try {
    // Check if vehicle already has an ongoing trip - only one ongoing trip per vehicle allowed
    const existingTrip = await Trip.findOne({
      vehicle: req.body.vehicle,
      status: "ongoing"
    });
    
    if (existingTrip) {
      return res.status(400).json({ 
        error: `Vehicle already has an ongoing trip (ID: ${existingTrip._id}). Please complete or cancel the existing trip before starting a new one.` 
      });
    }
    
    // No ongoing trip exists, create a new one
    // Multiple completed trips are allowed, but only one ongoing trip per vehicle
    const t = await Trip.create(req.body); // {vehicle, driver, start_location}
    res.status(201).json(t);
  } catch (e) { res.status(400).json({ error: e.message }); }
};

export const endTrip = async (req, res) => {
  try {
    const t = await Trip.findByIdAndUpdate(req.params.id, { end_time: new Date(), status: "completed", end_location: req.body?.end_location }, { new: true });
    res.json(t);
  } catch (e) { res.status(400).json({ error: e.message }); }
};
