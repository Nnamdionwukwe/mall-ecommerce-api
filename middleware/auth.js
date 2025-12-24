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
      id: decoded.id || decoded._id || decoded.userId,
      email: decoded.email,
      role: decoded.role,
      userId: decoded.userId || decoded.id || decoded._id,
    };

    console.log("👤 User attached to request:", req.user);
    console.log("👤 User ID:", req.user.id);
    console.log("👤 User Role:", req.user.role);

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
    });
  }

  console.log("✅ Admin/Vendor access granted");
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
