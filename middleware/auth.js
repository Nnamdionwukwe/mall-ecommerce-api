const jwt = require("jsonwebtoken");

// ✅ FIXED: Complete auth middleware
const auth = (req, res, next) => {
  try {
    let token;

    // Get token from header
    if (req.headers.authorization) {
      // Expected format: "Bearer <token>"
      const parts = req.headers.authorization.split(" ");
      if (parts.length === 2 && parts[0] === "Bearer") {
        token = parts[1];
      }
    }

    if (!token) {
      console.log("❌ No token provided");
      return res.status(401).json({
        success: false,
        message: "No authorization token provided",
      });
    }

    console.log("🔑 Token found, verifying...");

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("✅ Token verified. Decoded:", decoded);

    // ✅ FIXED: Properly attach user to request
    // Map userId from token to both 'id' and 'userId' for compatibility
    req.user = {
      id: decoded.userId, // ✅ For orders.js
      userId: decoded.userId, // ✅ For auth.js and other routes
      email: decoded.email,
      role: decoded.role || "user",
    };

    console.log("👤 User attached to request:", req.user);
    console.log("👤 User ID (id):", req.user.id);
    console.log("👤 User ID (userId):", req.user.userId);

    // ✅ CRITICAL: Call next() to continue middleware chain
    next();
  } catch (error) {
    console.error("❌ Auth error:", error.message);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token has expired",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
      error: error.message,
    });
  }
};

// ✅ FIXED: Admin middleware
const isAdmin = (req, res, next) => {
  // ✅ Check if user exists
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  // ✅ Check if user is admin
  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin role required",
    });
  }

  // ✅ CRITICAL: Call next() to continue
  next();
};

// ✅ FIXED: Vendor middleware
const isVendor = (req, res, next) => {
  // ✅ Check if user exists
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  // ✅ Check if user is vendor or admin
  if (req.user.role !== "vendor" && req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Vendor role required",
    });
  }

  // ✅ CRITICAL: Call next() to continue
  next();
};

module.exports = { auth, isAdmin, isVendor };
