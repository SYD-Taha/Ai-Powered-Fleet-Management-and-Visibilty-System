import express from "express";
import {
  registerUser,
  loginUser,
  getUsers,
  getMe,
  updateUser,
} from "../controllers/userController.js";
import { auth } from "../middleware/auth.js"; // adjust path if needed

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/", auth, getUsers);
router.get("/me", auth, getMe);
router.put("/:id", auth, updateUser);

export default router;
