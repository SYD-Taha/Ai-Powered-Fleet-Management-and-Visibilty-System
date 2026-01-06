import User from "../models/User.js";
import Role from "../models/Role.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { validateEmail, validatePassword, validateUsername } from "../utils/validation.js";

// ===========================
// REGISTER
// ===========================

export const registerUser = async (req, res) => {
  try {
    const { username, email, password, role: roleName } = req.body;

    // 🧩 Check all required fields
    if (!username || !email || !password || !roleName) {
      return res.status(400).json({ 
        error: "username, email, password, and role are required" 
      });
    }

    // Validate username format
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.isValid) {
      return res.status(400).json({ 
        error: usernameValidation.error 
      });
    }

    // Validate email format
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      return res.status(400).json({ 
        error: emailValidation.error 
      });
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ 
        error: passwordValidation.errors.length === 1 
          ? passwordValidation.errors[0]
          : "Password does not meet requirements: " + passwordValidation.errors.join(", ")
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.trim().toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: "User with this email already exists" });
    }

    // Check if username already exists
    const existingUsername = await User.findOne({ username: username.trim() });
    if (existingUsername) {
      return res.status(400).json({ error: "Username is already taken" });
    }

    // 🧩 Find role by NAME (not username!)
    const role = await Role.findOne({ name: roleName }); // ✅ FIXED
    if (!role) {
      return res.status(400).json({ 
        error: `Invalid role: ${roleName}. Available roles should be checked in database.` 
      });
    }

    // 🧩 Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 🧩 Create new user with role._id
    const user = new User({
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      role: role._id,
    });

    await user.save();

    // Don't send password in response
    const userResponse = {
      _id: user._id,
      username: user.username,
      email: user.email,
      role: role.name
    };

    res.status(201).json({ 
      message: "User registered successfully", 
      user: userResponse 
    });
  } catch (e) {
    console.error("Registration error:", e);
    res.status(500).json({ error: "Server error", details: e.message });
  }
};

// ===========================
// LOGIN
// ===========================
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Find user and populate role
    const user = await User.findOne({ email }).populate("role");
    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // Compare passwords
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate token with role name
    const token = jwt.sign(
      { 
        id: user._id, 
        role: user.role?.name || "user" // ✅ Changed from username to name
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ 
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role?.name
      }
    });
  } catch (e) {
    console.error("Login error:", e);
    res.status(500).json({ error: "Server error" });
  }
};

// ===========================
// GET USERS
// ===========================
export const getUsers = async (_, res) => {
  try {
    const users = await User.find()
      .select("-password")
      .populate("role", "name description permissions"); // ✅ Changed username to name
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ===========================
// GET CURRENT USER
// ===========================
export const getMe = async (req, res) => {
  try {
    const me = await User.findById(req.user.id)
      .select("-password")
      .populate("role", "name description permissions"); // ✅ Changed username to name
    
    if (!me) {
      return res.status(404).json({ error: "User not found" });
    }
    
    res.json(me);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ===========================
// UPDATE USER
// ===========================
export const updateUser = async (req, res) => {
  try {
    const { username, role: roleName, password } = req.body;
    const update = {};

    if (username) update.username = username;

    // Handle role update
    if (roleName) {
      const role = await Role.findOne({ name: roleName }); // ✅ Changed username to name
      if (!role) {
        return res.status(400).json({ error: `Invalid role: ${roleName}` });
      }
      update.role = role._id;
    }

    // Handle password update
    if (password) {
      // Validate password strength before updating
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        return res.status(400).json({ 
          error: passwordValidation.errors.length === 1 
            ? passwordValidation.errors[0]
            : "Password does not meet requirements: " + passwordValidation.errors.join(", ")
        });
      }
      update.password = await bcrypt.hash(password, 10);
    }

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true })
      .select("-password")
      .populate("role", "name description permissions"); // ✅ Changed username to name

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};