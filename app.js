const express = require("express");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

// ================================================
// CORS CONFIGURATION - BEFORE SOCKET.IO
// ================================================
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5173",
  "https://mall-ecommerce-frontend2.vercel.app",
  "https://ochachopharmacysupermarket.com",
  "https://www.ochachopharmacysupermarket.com",
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ================================================
// SOCKET.IO SETUP
// ================================================
const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
  allowEIO3: true,
});

// Make io globally accessible
global.io = io;

console.log("✅ Socket.IO initialized");

// ================================================
// MIDDLEWARE
// ================================================
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
// SOCKET.IO AUTHENTICATION MIDDLEWARE
// ================================================
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token;

    console.log("🔐 Socket auth attempt:", {
      socketId: socket.id,
      hasToken: !!token,
    });

    if (!token) {
      console.log("❌ No token provided");
      return next(new Error("Authentication error: No token"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id || decoded._id || decoded.userId;
    socket.userRole = decoded.role || "user";
    socket.userName = decoded.name || "User";

    console.log("✅ Socket authenticated:", {
      userId: socket.userId,
      role: socket.userRole,
      name: socket.userName,
    });

    next();
  } catch (error) {
    console.error("❌ Socket auth error:", error.message);
    next(new Error("Authentication error: Invalid token"));
  }
});

// ================================================
// SOCKET.IO CONNECTION HANDLER
// ================================================
io.on("connection", (socket) => {
  console.log(`\n🔌 Socket connected: ${socket.id}`);
  console.log(`   User: ${socket.userName} (${socket.userRole})`);
  console.log(`   User ID: ${socket.userId}`);

  // Join user-specific room
  socket.join(`user:${socket.userId}`);
  console.log(`   ✅ Joined room: user:${socket.userId}`);

  // Admin/Vendor joins admin room
  if (socket.userRole === "admin" || socket.userRole === "vendor") {
    socket.join("admin-room");
    console.log(`   ✅ Joined admin-room`);
  }

  // Send connection confirmation
  socket.emit("connected", {
    message: "Connected to server",
    userId: socket.userId,
    role: socket.userRole,
  });

  // Handle sending messages
  socket.on("send-message", async (data) => {
    try {
      console.log("📨 Message event received:", {
        chatId: data.chatId,
        from: socket.userName,
      });

      const Chat = require("./models/Chat");
      const chat = await Chat.findById(data.chatId);

      if (!chat) {
        console.log("❌ Chat not found");
        return socket.emit("error", { message: "Chat not found" });
      }

      const lastMessage = chat.messages[chat.messages.length - 1];

      // Broadcast to user
      io.to(`user:${chat.userId}`).emit("new-message", {
        chatId: data.chatId,
        message: lastMessage,
      });

      // Broadcast to admins
      io.to("admin-room").emit("new-message", {
        chatId: data.chatId,
        message: lastMessage,
      });

      console.log("✅ Message broadcasted");
    } catch (error) {
      console.error("❌ Error handling message:", error);
      socket.emit("error", { message: "Failed to send message" });
    }
  });

  // Handle typing indicator
  socket.on("typing", (data) => {
    socket.broadcast.emit("typing", {
      chatId: data.chatId,
      userId: socket.userId,
    });
  });

  socket.on("stop-typing", (data) => {
    socket.broadcast.emit("stop-typing", { chatId: data.chatId });
  });

  // Handle disconnection
  socket.on("disconnect", (reason) => {
    console.log(`❌ Socket disconnected: ${socket.id} - ${reason}`);
  });
});

// ================================================
// HEALTH CHECK
// ================================================
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Server is running",
    timestamp: new Date().toISOString(),
    socketIO: "enabled",
  });
});

// ================================================
// ROUTES IMPORT
// ================================================
console.log("\n🔍 Loading routes...\n");

let authRoutes,
  productRoutes,
  cartRoutes,
  orderRoutes,
  supportRoutes,
  checkoutRoutes,
  chatRoutes;

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

try {
  console.log("📦 Loading chatRoutes...");
  chatRoutes = require("./routes/chat");
  console.log("✅ chatRoutes loaded");
} catch (e) {
  console.error("❌ Error loading chatRoutes:", e.message);
  chatRoutes = (req, res) =>
    res.status(500).json({ error: "Chat routes failed to load" });
}

console.log("\n✅ All routes loaded!\n");

// ================================================
// ROUTE SETUP
// ================================================
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/carts", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/chat", chatRoutes);

// ================================================
// ROUTES LIST (FOR DEBUGGING)
// ================================================
app.get("/api/routes", (req, res) => {
  const routes = [
    // Auth
    "POST /api/auth/register",
    "POST /api/auth/login",
    "GET /api/auth/me",
    // Products
    "GET /api/products",
    "POST /api/products",
    "PUT /api/products/:id",
    "DELETE /api/products/:id",
    // Carts
    "GET /api/carts",
    "POST /api/carts/add",
    "DELETE /api/carts/remove/:productId",
    "PATCH /api/carts/update/:productId",
    "DELETE /api/carts/clear",
    // Orders
    "POST /api/orders/verify-payment",
    "GET /api/orders",
    // Chat
    "GET /api/chat/my-chat",
    "POST /api/chat/send-message",
    "PATCH /api/chat/:chatId/read",
    "PATCH /api/chat/:chatId/close",
    "GET /api/chat/admin/all",
    "GET /api/chat/:chatId",
    "PATCH /api/chat/:chatId/assign",
  ];
  res.json({
    success: true,
    message: "Available API routes",
    routes,
    total: routes.length,
    socketIO: "enabled",
  });
});

// ================================================
// 404 HANDLER
// ================================================
app.use((req, res) => {
  // Don't log socket.io polling attempts
  if (!req.path.includes("/socket.io/")) {
    console.log("❌ 404 - Route not found:", req.method, req.path);
  }
  res.status(404).json({
    success: false,
    error: "Route not found",
    path: req.path,
    method: req.method,
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
// SERVER START - USE server.listen() NOT app.listen()
// ================================================
const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
  console.log("\n========================================");
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🏥 Health: http://localhost:${PORT}/api/health`);
  console.log(`📋 Routes: http://localhost:${PORT}/api/routes`);
  console.log(`💬 Socket.IO: ENABLED`);
  console.log("========================================\n");
});
