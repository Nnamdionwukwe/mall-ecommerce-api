const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();
const app = express();

// ================================================
// CORS CONFIGURATION
// ================================================
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "https://mall-ecommerce-frontend2.vercel.app",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ================================================
// DEBUG: Check all routes before using them
// ================================================
console.log("\n🔍 DEBUGGING ROUTES...\n");

try {
  const authRoutes = require("./routes/auth");
  console.log("✅ authRoutes type:", typeof authRoutes);
  console.log("   authRoutes:", authRoutes);
} catch (e) {
  console.error("❌ Error loading authRoutes:", e.message);
}

try {
  const productRoutes = require("./routes/products");
  console.log("✅ productRoutes type:", typeof productRoutes);
  console.log("   productRoutes:", productRoutes);
} catch (e) {
  console.error("❌ Error loading productRoutes:", e.message);
}

try {
  const cartRoutes = require("./routes/cart");
  console.log("✅ cartRoutes type:", typeof cartRoutes);
  console.log("   cartRoutes:", cartRoutes);
} catch (e) {
  console.error("❌ Error loading cartRoutes:", e.message);
}

try {
  const orderRoutes = require("./routes/orders");
  console.log("✅ orderRoutes type:", typeof orderRoutes);
  console.log("   orderRoutes:", orderRoutes);
} catch (e) {
  console.error("❌ Error loading orderRoutes:", e.message);
}

try {
  const supportRoutes = require("./routes/support");
  console.log("✅ supportRoutes type:", typeof supportRoutes);
  console.log("   supportRoutes:", supportRoutes);
} catch (e) {
  console.error("❌ Error loading supportRoutes:", e.message);
}

try {
  const checkoutRoutes = require("./routes/checkout");
  console.log("✅ checkoutRoutes type:", typeof checkoutRoutes);
  console.log("   checkoutRoutes:", checkoutRoutes);
} catch (e) {
  console.error("❌ Error loading checkoutRoutes:", e.message);
}

console.log("\n🔍 END DEBUG\n");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================================================
// ROUTES IMPORT
// ================================================
const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/products");
const cartRoutes = require("./routes/cart");
const orderRoutes = require("./routes/orders");
const supportRoutes = require("./routes/support");
const checkoutRoutes = require("./routes/checkout");

// ================================================
// ROUTE SETUP
// ================================================
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/checkout", checkoutRoutes);

// ================================================
// DATABASE CONNECTION
// ================================================
const MONGODB_URI = process.env.MONGODB_URI;
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err.message));

// ================================================
// HEALTH CHECK
// ================================================
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// ================================================
// ROUTES LIST (FOR DEBUGGING)
// ================================================
app.get("/api/routes", (req, res) => {
  const routes = [
    // Auth
    "POST /api/auth/register",
    "POST /api/auth/login",
    "GET /api/auth/me",
    "PATCH /api/auth/profile",
    "POST /api/auth/change-password",
    "POST /api/auth/logout",
    // Products
    "GET /api/products",
    "GET /api/products/:id",
    "POST /api/products",
    "PUT /api/products/:id",
    "DELETE /api/products/:id",
    // Cart
    "GET /api/cart",
    "POST /api/cart/add",
    "DELETE /api/cart/remove/:productId",
    "PATCH /api/cart/update/:productId",
    "DELETE /api/cart/clear",
    // Orders
    "POST /api/orders/verify-payment",
    "GET /api/orders",
    "GET /api/orders/:orderId",
    "POST /api/orders/:orderId/cancel",
  ];
  res.json({
    success: true,
    message: "Available API routes",
    routes,
    total: routes.length,
  });
});

// ================================================
// 404 HANDLER
// ================================================
app.use((req, res) => {
  console.log("❌ 404 - Route not found:", req.method, req.path);
  res.status(404).json({
    success: false,
    error: "Route not found",
    path: req.path,
    method: req.method,
    hint: "Visit /api/routes to see all available endpoints",
  });
});

// ================================================
// ERROR HANDLER
// ================================================
app.use((error, req, res, next) => {
  console.error("❌ Error:", error.message);
  res.status(error.status || 500).json({
    success: false,
    message: error.message || "Internal server error",
  });
});

// ================================================
// SERVER START
// ================================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("\n========================================");
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🏥 Health: http://localhost:${PORT}/health`);
  console.log(`📋 Routes: http://localhost:${PORT}/api/routes`);
  console.log("========================================\n");
});
