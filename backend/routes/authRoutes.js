import express from "express";
import { loginUser as login, registerUser as register } from "../controllers/userController.js";
// import { authLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// Apply rate limiting to authentication endpoints
// DISABLED: Rate limiting removed for development/testing
router.post("/register", register); // protect in prod (admin-only)
router.post("/login", login);

export default router;
