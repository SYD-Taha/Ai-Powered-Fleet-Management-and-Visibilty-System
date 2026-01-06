import express from "express";
import { auth, requireRole } from "../middleware/auth.js";
// import { vehiclesLimiter } from "../middleware/rateLimiter.js";
import { getVehicles, addVehicle, updateVehicle, removeVehicle, assignDevice } from "../controllers/vehicleController.js";
const router = express.Router();

// Make auth optional for GET /api/vehicles in development
const optionalAuth = (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return auth(req, res, next);
  }
  // In development, allow request to proceed without auth
  next();
};

// Apply vehicles-specific rate limiter (overrides general limiter for this route)
// DISABLED: Rate limiting removed for development/testing
// router.use(vehiclesLimiter);

router.get("/", optionalAuth, getVehicles);
router.post("/", auth, requireRole("admin", "dispatcher"), addVehicle);
router.put("/:id", optionalAuth, updateVehicle); // Optional auth in development for simulator compatibility
router.delete("/:id", auth, requireRole("admin"), removeVehicle);
router.post("/assign-device", auth, requireRole("admin", "dispatcher"), assignDevice);

export default router;
