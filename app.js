// const express = require("express");
// const cors = require("cors");
// const mongoose = require("mongoose");
// require("dotenv").config();

// const app = express();

// app.use(cors());

// // CORS Configuration - Add this BEFORE your routes
// app.use(
//   cors({
//     origin: [
//       "http://localhost:3000",
//       "http://localhost:3001",
//       "https://mall-ecommerce-frontend2.vercel.app/", // Add your production domain
//     ],
//     credentials: true,
//     methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
//     allowedHeaders: ["Content-Type", "Authorization"],
//   })
// );

// app.use(express.json());
// // ========================================
// // 6. UPDATE APP.JS TO USE AUTH ROUTES
// // ========================================
// const productRoutes = require("./routes/products");
// const authRoutes = require("./routes/auth");

// const supportRoutes = require("./routes/support");
// const checkoutRoutes = require("./routes/checkout");
// const orderRoutes = require("./routes/orders");
// const cartRoutes = require("./routes/cart");

// // Routes
// app.use("/api/products", productRoutes);
// // app.use("/api/auth", authRoutes);
// app.use("/api/support", supportRoutes);
// app.use("/api/checkout", checkoutRoutes);
// // app.use("/routes/auth", authRoutes);
// app.use("/api/auth", authRoutes);
// app.use("/api/orders", orderRoutes);
// app.use("/api/cart", cartRoutes);

// // Middleware

// const MONGODB_URI =
//   process.env.MONGODB_URI ||
//   process.env.MONGO_URL ||
//   "mongodb://mongo:PFunFtgHfjDjQAFpiSvtMIjNctaQOrtS@turntable.proxy.rlwy.net:10584";

// // mongoose
// //   .connect(MONGODB_URI, {
// //     serverSelectionTimeoutMS: 5000,
// //     socketTimeoutMS: 45000,
// //   })
// //   .then(() => console.log("✅ MongoDB connected"))
// //   .catch((err) => {
// //     console.error("❌ MongoDB connection error:", err);
// //   });

// mongoose
//   .connect(process.env.MONGODB_URI)
//   .then(() => console.log("✅ MongoDB connected"))
//   .catch((err) => console.log("❌ MongoDB error:", err));

// // Health check
// app.get("/health", (req, res) => {
//   res.json({ status: "OK", message: "Server is running" });
// });

// // 404 handler - ADD THIS
// app.use((req, res) => {
//   console.log("404 - Route not found:", req.method, req.path);
//   res.status(404).json({
//     error: "Route not found",
//     path: req.path,
//     method: req.method,
//   });
// });

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, "0.0.0.0", () => {
//   console.log(`🚀 Server running on port ${PORT}`);
// });

// // ========================================
// // 8. TESTING WITH CURL
// // ========================================

// /*
// # Register a new user
// curl -X POST http://localhost:5000/api/auth/register \
//   -H "Content-Type: application/json" \
//   -d '{
//     "name": "John Doe",
//     "email": "john@example.com",
//     "password": "password123",
//     "role": "user"
//   }'

// # Register a vendor
// curl -X POST http://localhost:5000/api/auth/register \
//   -H "Content-Type: application/json" \
//   -d '{
//     "name": "Tech Store",
//     "email": "tech@store.com",
//     "password": "password123",
//     "role": "vendor"
//   }'

// # Login
// curl -X POST http://localhost:5000/api/auth/login \
//   -H "Content-Type: application/json" \
//   -d '{
//     "email": "john@example.com",
//     "password": "password123"
//   }'

// # Get profile (use token from login)
// curl http://localhost:5000/api/auth/me \
//   -H "Authorization: Bearer YOUR_TOKEN_HERE"

// # Update profile
// curl -X PUT http://localhost:5000/api/auth/me \
//   -H "Authorization: Bearer YOUR_TOKEN_HERE" \
//   -H "Content-Type: application/json" \
//   -d '{
//     "name": "John Updated"
//   }'

// # Change password
// curl -X PUT http://localhost:5000/api/auth/password \
//   -H "Authorization: Bearer YOUR_TOKEN_HERE" \
//   -H "Content-Type: application/json" \
//   -d '{
//     "currentPassword": "password123",
//     "newPassword": "newpassword456"
//   }'

// # Create product (protected route - vendor only)
// curl -X POST http://localhost:5000/api/products \
//   -H "Authorization: Bearer YOUR_TOKEN_HERE" \
//   -H "Content-Type: application/json" \
//   -d '{
//     "name": "New Product",
//     "price": 99.99,
//     "stock": 100,
//     "category": "Electronics",
//     "vendorId": "vendor_123",
//     "vendorName": "Tech Store"
//   }'
// */

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

app.use("/api/auth", authRoutes); // ✅ FIXED: /api/auth NOT /routes/auth
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
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
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
