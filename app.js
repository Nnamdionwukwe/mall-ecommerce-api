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
      "https://ochachopharmacysupermarket.com",
      "https://www.ochachopharmacysupermarket.com",
      "http://localhost:5173",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static("uploads"));

// ================================================
// DATABASE CONNECTION
// ================================================
const MONGODB_URI = process.env.MONGODB_URI;
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err.message));

// ================================================
// HEALTH CHECK - FIRST ENDPOINT
// ================================================
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// ================================================
// ROUTES IMPORT WITH ERROR HANDLING
// ================================================
console.log("\n🔍 Loading routes...\n");

let authRoutes,
  productRoutes,
  cartRoutes,
  orderRoutes,
  supportRoutes,
  checkoutRoutes;

try {
  console.log("📦 Loading authRoutes...");
  authRoutes = require("./routes/auth");
  console.log("✅ authRoutes loaded");
} catch (e) {
  console.error("❌ Error loading authRoutes:", e.message);
  authRoutes = (req, res) =>
    res.status(500).json({ error: "Auth routes failed to load" });
}

try {
  console.log("📦 Loading productRoutes...");
  productRoutes = require("./routes/products");
  console.log("✅ productRoutes loaded");
} catch (e) {
  console.error("❌ Error loading productRoutes:", e.message);
  productRoutes = (req, res) =>
    res.status(500).json({ error: "Product routes failed to load" });
}

try {
  console.log("📦 Loading cartRoutes...");
  // ✅ UPDATED: Changed from './routes/cart' to './routes/carts'
  cartRoutes = require("./routes/carts");
  console.log("✅ cartRoutes loaded");
} catch (e) {
  console.error("❌ Error loading cartRoutes:", e.message);
  cartRoutes = (req, res) =>
    res.status(500).json({ error: "Cart routes failed to load" });
}

try {
  console.log("📦 Loading orderRoutes...");
  orderRoutes = require("./routes/orders");
  console.log("✅ orderRoutes loaded");
} catch (e) {
  console.error("❌ Error loading orderRoutes:", e.message);
  orderRoutes = (req, res) =>
    res.status(500).json({ error: "Order routes failed to load" });
}

try {
  console.log("📦 Loading supportRoutes...");
  supportRoutes = require("./routes/support");
  console.log("✅ supportRoutes loaded");
} catch (e) {
  console.error("❌ Error loading supportRoutes:", e.message);
  supportRoutes = (req, res) =>
    res.status(500).json({ error: "Support routes failed to load" });
}

try {
  console.log("📦 Loading checkoutRoutes...");
  checkoutRoutes = require("./routes/checkout");
  console.log("✅ checkoutRoutes loaded");
} catch (e) {
  console.error("❌ Error loading checkoutRoutes:", e.message);
  checkoutRoutes = (req, res) =>
    res.status(500).json({ error: "Checkout routes failed to load" });
}

console.log("\n✅ All routes loaded!\n");

// ================================================
// ROUTE SETUP
// ================================================
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
// ✅ UPDATED: Changed from '/api/cart' to '/api/carts'
app.use("/api/carts", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/checkout", checkoutRoutes);

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
    // Cart - User Routes
    "GET /api/carts",
    "POST /api/carts/add",
    "DELETE /api/carts/remove/:productId",
    "PATCH /api/carts/update/:productId",
    "DELETE /api/carts/clear",
    "GET /api/carts/summary",
    // Cart - Admin Routes
    "GET /api/carts/admin/all-carts",
    "GET /api/carts/admin/cart/:userId",
    "GET /api/carts/admin/carts-summary",
    "DELETE /api/carts/admin/cart/:userId",
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
  console.log(`🏥 Health: http://localhost:${PORT}/api/health`);
  console.log(`📋 Routes: http://localhost:${PORT}/api/routes`);
  console.log("========================================\n");
});
