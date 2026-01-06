import mongoose from "mongoose";
import dotenv from "dotenv";
import GPS from "../models/GPS.js";
import Vehicle from "../models/Vehicle.js";

dotenv.config();

async function addGPSRecords() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const vehicles = await Vehicle.find();
    if (!vehicles.length) {
      console.log("❌ No vehicles found.");
      process.exit(0);
    }

    for (const v of vehicles) {
      const existing = await GPS.findOne({ vehicle: v._id });
      if (existing) {
        console.log(`⚠️ GPS already exists for ${v.vehicle_number} — skipping.`);
        continue;
      }

      const gpsPoint = {
        vehicle: new mongoose.Types.ObjectId(v._id),
        latitude: 24.8607 + (Math.random() - 0.5) * 0.05, // near Karachi
        longitude: 67.0011 + (Math.random() - 0.5) * 0.05,
        speed: v.speed || Math.floor(Math.random() * 40) + 20,
        timestamp: new Date()
      };

      await GPS.create(gpsPoint);
      console.log(`✅ GPS added for ${v.vehicle_number}`);
    }

    console.log("🌍 All GPS records added successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error adding GPS records:", err);
    process.exit(1);
  }
}

addGPSRecords();
