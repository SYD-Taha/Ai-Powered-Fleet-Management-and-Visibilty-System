import express from "express";
import { auth } from "../middleware/auth.js";
import { sendDispatchAlert } from "../controllers/alertController.js";
const router = express.Router();


export default router;
