const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const productRoutes = require("./routes/products");

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

const MONGODB_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URL ||
  "mongodb://localhost:27017/mall-ecommerce";

mongoose
  .connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
  });

// Routes
app.use("/api/products", productRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
