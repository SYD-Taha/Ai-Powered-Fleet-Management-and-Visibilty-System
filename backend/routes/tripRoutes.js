import express from "express";
import { auth } from "../middleware/auth.js";
import { getTrips, startTrip, endTrip } from "../controllers/tripController.js";
const router = express.Router();

router.get("/", auth, getTrips);
router.post("/start", auth, startTrip);
router.post("/:id/end", auth, endTrip);

export default router;
