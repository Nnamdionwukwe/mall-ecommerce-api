const jwt = require("jsonwebtoken");
const User = require("../models/User"); // ✅ ADD THIS - Import User model

const auth = async (req, res, next) => {
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

    // ✅ FIXED: Fetch user from database to get latest role
    const userId = decoded.id || decoded._id || decoded.userId;
    const user = await User.findById(userId).select("-password");

    if (!user) {
      console.log("❌ User not found in database");
      return res.status(401).json({
        success: false,
        message: "User not found. Token is invalid.",
      });
    }

    // Attach user with latest data from database
    req.user = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role, // ✅ Fresh role from database
      userId: user._id.toString(),
    };

    console.log("👤 User attached to request:", {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
    });

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
    console.log("❌ No user attached to request");
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  console.log("🔍 Checking admin/vendor role. User role:", req.user.role);

  if (req.user.role !== "admin" && req.user.role !== "vendor") {
    console.log(
      `❌ Access denied. User role is '${req.user.role}', must be 'admin' or 'vendor'`
    );
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin or Vendor role required",
      userRole: req.user.role, // ✅ Include role in response for debugging
    });
  }

  console.log("✅ Admin/Vendor access granted");
  next();
};

const isVendor = (req, res, next) => {
  if (!req.user) {
    console.log("❌ [isVendor] No user attached to request");
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  console.log("🔍 [isVendor] Checking role. User role:", req.user.role);

  if (req.user.role !== "vendor" && req.user.role !== "admin") {
    console.log(
      `❌ [isVendor] Access denied. User role is '${req.user.role}', must be 'vendor' or 'admin'`
    );
    return res.status(403).json({
      success: false,
      message: "Access denied. Vendor or Admin role required",
      userRole: req.user.role, // ✅ Include role in response for debugging
    });
  }

  console.log("✅ [isVendor] Vendor/Admin access granted");
  next();
};

module.exports = { auth, isAdmin, isVendor };
