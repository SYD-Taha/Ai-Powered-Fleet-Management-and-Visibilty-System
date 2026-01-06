import express from "express";
import { auth, requireRole } from "../middleware/auth.js";
import { getFaults, reportFault, addCategory, getCategories } from "../controllers/faultController.js";
const router = express.Router();

// Make auth optional for GET routes in development (consistent with vehicles/GPS)
const optionalAuth = (req, res, next) => {
  // Only require auth in production environment
  // In development or when NODE_ENV is not set, skip authentication
  if (process.env.NODE_ENV === 'production') {
    return auth(req, res, next);
  }
  // In development, allow request to proceed without auth
  next();
};

router.get("/", optionalAuth, getFaults);
router.post("/", optionalAuth, reportFault);
router.get("/categories", optionalAuth, getCategories);
router.post("/categories", auth, requireRole("admin","dispatcher"), addCategory);

export default router;
