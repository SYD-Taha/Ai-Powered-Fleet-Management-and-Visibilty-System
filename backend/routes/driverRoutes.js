import express from "express";
import { auth, requireRole } from "../middleware/auth.js";
import { getDrivers, addDriver, assignVehicle } from "../controllers/driverController.js";
const router = express.Router();

router.get("/", auth, getDrivers);
router.post("/", auth, requireRole("admin","dispatcher"), addDriver);
router.post("/assign", auth, requireRole("admin","dispatcher"), assignVehicle);

export default router;
