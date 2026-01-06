import express from "express";
import { auth } from "../middleware/auth.js";
import { runDispatchEngine } from "../controllers/dispatchController.js";
// import { dispatchLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// DISABLED: Rate limiting removed for development/testing
router.post("/run", auth, runDispatchEngine);

export default router;
