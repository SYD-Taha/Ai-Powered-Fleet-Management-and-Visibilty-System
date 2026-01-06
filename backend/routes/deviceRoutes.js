import express from "express";
import { auth, requireRole } from "../middleware/auth.js";
import { registerDevice, getDevices } from "../controllers/deviceController.js";

const router = express.Router();

// Get all devices
router.get("/", auth, getDevices);

// Register a new hardware device
router.post("/", auth, requireRole("admin", "dispatcher"), registerDevice);

export default router;
