import express from "express";
import { calculateRoute } from "../services/routingService.js";
import { auth } from "../middleware/auth.js";
import logger from "../services/logger.js";

const router = express.Router();

// Make auth optional for route calculation in development
const optionalAuth = (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return auth(req, res, next);
  }
  // In development, allow request to proceed without auth
  next();
};

/**
 * GET /api/routes/calculate
 * Calculate route between two coordinates
 * Query params: fromLat, fromLng, toLat, toLng
 */
router.get("/calculate", optionalAuth, async (req, res) => {
  try {
    const { fromLat, fromLng, toLat, toLng } = req.query;

    // Validate required parameters
    if (!fromLat || !fromLng || !toLat || !toLng) {
      return res.status(400).json({
        error: "Missing required parameters",
        required: ["fromLat", "fromLng", "toLat", "toLng"]
      });
    }

    // Parse and validate coordinates
    const start = {
      lat: parseFloat(fromLat),
      lng: parseFloat(fromLng)
    };
    const end = {
      lat: parseFloat(toLat),
      lng: parseFloat(toLng)
    };

    // Validate coordinate ranges
    if (
      isNaN(start.lat) || isNaN(start.lng) || isNaN(end.lat) || isNaN(end.lng) ||
      start.lat < -90 || start.lat > 90 || end.lat < -90 || end.lat > 90 ||
      start.lng < -180 || start.lng > 180 || end.lng < -180 || end.lng > 180
    ) {
      return res.status(400).json({
        error: "Invalid coordinates",
        message: "Latitude must be between -90 and 90, longitude must be between -180 and 180"
      });
    }

    // Calculate route using backend routing service
    const routeData = await calculateRoute(start, end);

    // Return route data in format expected by frontend
    res.json({
      waypoints: routeData.waypoints, // Array of [lat, lng] pairs
      distance: routeData.distance, // in meters
      duration: routeData.duration, // in seconds
      isFallback: routeData.isFallback || false,
      calculatedAt: routeData.calculatedAt || Date.now(),
      source: routeData.source || 'osrm'
    });

  } catch (error) {
    logger.error("Route calculation error", {
      error: error.message,
      stack: error.stack,
      query: req.query
    });

    res.status(500).json({
      error: "Failed to calculate route",
      message: error.message
    });
  }
});

export default router;

