import express from "express";
import { auth } from "../middleware/auth.js";
import { addPoint, latestByVehicle, trackByVehicle } from "../controllers/gpsController.js";
// import { gpsLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// Make auth optional for GET routes in development
const optionalAuth = (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return auth(req, res, next);
  }
  // In development, allow request to proceed without auth
  next();
};

// DISABLED: Rate limiting removed for development/testing
// Use optionalAuth for POST route to allow GPS updates in development (consistent with GET routes)
router.post("/", optionalAuth, addPoint);
router.get("/latest/:vehicleId", optionalAuth, latestByVehicle);
router.get("/track/:vehicleId", optionalAuth, trackByVehicle);

export default router;
