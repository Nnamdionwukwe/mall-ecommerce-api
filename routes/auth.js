const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");
const { auth } = require("../middleware/auth");

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-this";

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
};

router.post("/test", (req, res) => {
  console.log("Received body:", req.body);
  res.json({ received: req.body });
});

// ========================================
// REGISTER - POST /api/auth/register
// ========================================
// router.post(
//   "/register",
//   [
//     body("name")
//       .trim()
//       .isLength({ min: 2 })
//       .withMessage("Name must be at least 2 characters"),
//     body("email")
//       .isEmail()
//       .normalizeEmail()
//       .withMessage("Please enter a valid email"),
//     body("password")
//       .isLength({ min: 6 })
//       .withMessage("Password must be at least 6 characters"),
//     body("role")
//       .optional()
//       .isIn(["user", "vendor"])
//       .withMessage("Invalid role"),
//   ],
//   async (req, res) => {
//     try {
//       // Validate input
//       const errors = validationResult(req);
//       if (!errors.isEmpty()) {
//         return res.status(400).json({ errors: errors.array() });
//       }

//       const { name, email, password, role } = req.body;

//       // Check if user already exists
//       const existingUser = await User.findOne({ email });
//       if (existingUser) {
//         return res.status(400).json({ error: "Email already registered" });
//       }

//       // Hash password
//       const hashedPassword = await bcrypt.hash(password, 10);

//       // Create vendor ID if role is vendor
//       const vendorId = role === "vendor" ? `vendor_${Date.now()}` : undefined;

//       // Create user
//       const user = new User({
//         name,
//         email,
//         password: hashedPassword,
//         role: role || "user",
//         vendorId,
//       });

//       await user.save();

//       // Generate token
//       const token = generateToken(user._id);

//       res.status(201).json({
//         success: true,
//         message: "User registered successfully",
//         data: {
//           user: user.toJSON(),
//           token,
//         },
//       });
//     } catch (error) {
//       console.error("Register error:", error);
//       res.status(500).json({ error: "Server error", message: error.message });
//     }
//   }
// );

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

    // Generate token
    const token = generateToken(user);

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
router.post(
  "/login",
  [
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Please enter a valid email"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  async (req, res) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      // Find user
      const user = await User.findOne({ email, isActive: true });
      if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Check password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Generate token
      const token = generateToken(user._id);

      res.json({
        success: true,
        message: "Login successful",
        data: {
          user: user.toJSON(),
          token,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Server error", message: error.message });
    }
  }
);

// ========================================
// GET PROFILE - GET /api/auth/me
// ========================================
router.get("/me", auth, async (req, res) => {
  try {
    res.json({
      success: true,
      data: req.user,
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
          _id: { $ne: req.user._id },
        });
        if (existingUser) {
          return res.status(400).json({ error: "Email already in use" });
        }
        updates.email = req.body.email;
      }

      const user = await User.findByIdAndUpdate(req.user._id, updates, {
        new: true,
        runValidators: true,
      });

      res.json({
        success: true,
        message: "Profile updated successfully",
        data: user,
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
      const user = await User.findById(req.user._id);
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
