import express from "express";
import http from "http";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import logger from "./services/logger.js";
import { initializeSocket } from "./services/socketService.js";
import { checkStuckVehicles } from "./controllers/dispatchController.js";

import vehicleRoutes from "./routes/vehicleRoutes.js";
import driverRoutes from "./routes/driverRoutes.js";
import tripRoutes from "./routes/tripRoutes.js";
import gpsRoutes from "./routes/gpsRoutes.js";
import faultRoutes from "./routes/faultRoutes.js";
import alertRoutes from "./routes/alertRoutes.js";
import deviceRoutes from "./routes/deviceRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import dispatchRoutes from "./routes/dispatchRoutes.js";
import routeRoutes from "./routes/routeRoutes.js";
// import { generalLimiter } from "./middleware/rateLimiter.js";
import "./mqttService.js"; // Initialize MQTT connection

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

// Apply general rate limiting to all API routes
// DISABLED: Rate limiting removed for development/testing
// app.use("/api/", generalLimiter);

// DB - Optimized connection with pooling
mongoose.connect(process.env.MONGO_URI, {
  maxPoolSize: 10, // Maintain up to 10 socket connections
  minPoolSize: 2, // Maintain at least 2 socket connections
  serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  bufferCommands: false // Disable mongoose buffering
})
  .then(() => logger.info("MongoDB Connected"))
  .catch(err => logger.error("MongoDB Connection Error", { error: err.message, stack: err.stack }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/gps", gpsRoutes);
app.use("/api/faults", faultRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/dispatch", dispatchRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/routes", routeRoutes);

// Root
app.get("/", (_, res) => res.send("Fleet backend running 🚀"));

// Create HTTP server and attach Socket.io
const server = http.createServer(app);
initializeSocket(server);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => logger.info(`Server running on port ${PORT}`, { port: PORT, env: process.env.NODE_ENV || 'development' }));

// Periodic cleanup job to check for stuck vehicles
// Run every 30 seconds to catch any vehicles that got stuck in dispatched status
// This acts as a safety net in case the timeout logic misses an edge case
setInterval(async () => {
  try {
    await checkStuckVehicles();
  } catch (error) {
    logger.error("Error in periodic stuck vehicle cleanup", {
      error: error.message,
      stack: error.stack
    });
  }
}, 30000); // 30 seconds
