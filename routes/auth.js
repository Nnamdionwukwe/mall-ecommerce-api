const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");
const { auth } = require("../middleware/auth");

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-this";

// Generate JWT token - FIXED: Takes userId, not whole user object
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
};

// ========================================
// REGISTER - POST /api/auth/register
// ========================================
router.post("/register", async (req, res) => {
  try {
    console.log("📝 Register request received:", req.body);

    const { name, email, password, role } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide name, email, and password",
      });
    }

    // Check if user exists
    console.log("🔍 Checking if user exists with email:", email);
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    console.log("✅ User doesn't exist, creating new user...");

    // Create user
    user = await User.create({
      name,
      email,
      password,
      role: role || "user",
    });

    console.log("✅ User created successfully:", user._id);

    // Generate token - FIXED: Pass user._id, not user
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    console.error("❌ Register error:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);

    res.status(500).json({
      success: false,
      message: "Error registering user",
      error: error.message,
    });
  }
});

// ========================================
// LOGIN - POST /api/auth/login
// ========================================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log("🔐 Login attempt for email:", email);

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    // Check for user and explicitly select password
    console.log("🔍 Looking for user...");
    const user = await User.findOne({ email }).select("+password");

    console.log("👤 User found:", user ? "Yes" : "No");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated",
      });
    }

    // Compare password
    console.log("🔑 Comparing passwords...");
    console.log(
      "⚠️ Checking if matchPassword method exists:",
      typeof user.matchPassword
    );

    let isPasswordCorrect;

    // Check if matchPassword method exists
    if (typeof user.matchPassword === "function") {
      isPasswordCorrect = await user.matchPassword(password);
      console.log("✅ Using matchPassword method");
    } else {
      // Fallback: use bcrypt directly
      const bcrypt = require("bcryptjs");
      isPasswordCorrect = await bcrypt.compare(password, user.password);
      console.log("⚠️ Using bcrypt fallback (matchPassword not found)");
    }

    console.log("🔐 Password correct:", isPasswordCorrect);

    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Generate token - FIXED: Pass user._id, not user
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    console.error("❌ Login error:", error);
    console.error("📋 Error message:", error.message);
    console.error("📋 Error stack:", error.stack);

    res.status(500).json({
      success: false,
      message: "Error logging in",
      error: error.message,
    });
  }
});

// ========================================
// GET PROFILE - GET /api/auth/me
// ========================================
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    res.json({
      success: true,
      data: user.toJSON(),
    });
  } catch (error) {
    res.status(500).json({ error: "Server error", message: error.message });
  }
});

// ========================================
// UPDATE PROFILE - PUT /api/auth/me
// ========================================
router.put(
  "/me",
  auth,
  [
    body("name").optional().trim().isLength({ min: 2 }),
    body("email").optional().isEmail().normalizeEmail(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const updates = {};
      if (req.body.name) updates.name = req.body.name;
      if (req.body.email) {
        // Check if email is already taken
        const existingUser = await User.findOne({
          email: req.body.email,
          _id: { $ne: req.user.userId },
        });
        if (existingUser) {
          return res.status(400).json({ error: "Email already in use" });
        }
        updates.email = req.body.email;
      }

      const user = await User.findByIdAndUpdate(req.user.userId, updates, {
        new: true,
        runValidators: true,
      });

      res.json({
        success: true,
        message: "Profile updated successfully",
        data: user.toJSON(),
      });
    } catch (error) {
      res.status(500).json({ error: "Server error", message: error.message });
    }
  }
);

// ========================================
// CHANGE PASSWORD - PUT /api/auth/password
// ========================================
router.put(
  "/password",
  auth,
  [
    body("currentPassword")
      .notEmpty()
      .withMessage("Current password is required"),
    body("newPassword")
      .isLength({ min: 6 })
      .withMessage("New password must be at least 6 characters"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { currentPassword, newPassword } = req.body;

      // Verify current password
      const user = await User.findById(req.user.userId).select("+password");
      const isPasswordValid = await bcrypt.compare(
        currentPassword,
        user.password
      );
      if (!isPasswordValid) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      // Hash new password
      user.password = await bcrypt.hash(newPassword, 10);
      await user.save();

      res.json({
        success: true,
        message: "Password changed successfully",
      });
    } catch (error) {
      res.status(500).json({ error: "Server error", message: error.message });
    }
  }
);

// ========================================
// LOGOUT - POST /api/auth/logout
// ========================================
router.post("/logout", auth, async (req, res) => {
  try {
    // In a stateless JWT setup, logout is handled client-side by deleting the token
    // For added security, you could maintain a token blacklist in Redis
    res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    res.status(500).json({ error: "Server error", message: error.message });
  }
});

module.exports = router;
