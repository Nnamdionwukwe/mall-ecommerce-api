const jwt = require("jsonwebtoken");

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

    // ✅ FIXED: Use 'id' property to match order routes
    // The decoded token should have one of these: id, _id, or userId
    req.user = {
      id: decoded.id || decoded._id || decoded.userId, // ✅ Map to 'id'
      email: decoded.email,
      role: decoded.role,
      userId: decoded.userId || decoded.id || decoded._id, // Also include userId for compatibility
    };

    console.log("👤 User attached to request:", req.user);
    console.log("👤 User ID:", req.user.id);

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

    res.status(401).json({
      success: false,
      message: "Invalid or expired token",
      error: error.message,
    });
  }
};

const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin role required",
    });
  }

  next();
};

const isVendor = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  if (req.user.role !== "vendor" && req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Vendor role required",
    });
  }

  next();
};

module.exports = { auth, isAdmin, isVendor };
