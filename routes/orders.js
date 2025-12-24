const express = require("express");
const Order = require("../models/Order");
const Product = require("../models/Product");
const { auth, isAdmin } = require("../middleware/auth");
const axios = require("axios");

const router = express.Router();

console.log("🔍 PAYSTACK CONFIGURATION CHECK:");
console.log("PAYSTACK_SECRET_KEY exists:", !!process.env.PAYSTACK_SECRET_KEY);
console.log(
  "PAYSTACK_SECRET_KEY length:",
  process.env.PAYSTACK_SECRET_KEY?.length
);
console.log(
  "Starts with 'sk_':",
  process.env.PAYSTACK_SECRET_KEY?.startsWith("sk_")
);
console.log("---\n");

// ================================================
// MIDDLEWARE DEFINITIONS
// ================================================

const validateOrderData = (req, res, next) => {
  try {
    console.log("\n🔍 [validateOrderData] Middleware called");

    const {
      reference,
      orderId,
      shippingInfo,
      items,
      subtotal,
      shipping,
      tax,
      total,
    } = req.body;

    console.log("🔍 Validating order data...");

    if (!reference) {
      console.log("❌ Missing: reference");
      return res.status(400).json({
        success: false,
        error: "Payment reference is required",
      });
    }

    if (!orderId) {
      console.log("❌ Missing: orderId");
      return res.status(400).json({
        success: false,
        error: "Order ID is required",
      });
    }

    if (!items || items.length === 0) {
      console.log("❌ Missing: items");
      return res.status(400).json({
        success: false,
        error: "Cart is empty",
      });
    }

    if (!shippingInfo) {
      console.log("❌ Missing: shippingInfo");
      return res.status(400).json({
        success: false,
        error: "Shipping information is required",
      });
    }

    const { fullName, email, phone, address, city, state, zipCode } =
      shippingInfo;

    if (
      !fullName ||
      !email ||
      !phone ||
      !address ||
      !city ||
      !state ||
      !zipCode
    ) {
      console.log("❌ Missing: incomplete shipping information");
      return res.status(400).json({
        success: false,
        error: "Incomplete shipping information",
      });
    }

    if (subtotal === undefined || shipping === undefined || tax === undefined) {
      console.log("❌ Missing: pricing information");
      return res.status(400).json({
        success: false,
        error: "Pricing information is incomplete",
      });
    }

    console.log("✅ All order data validated successfully");
    return next();
  } catch (error) {
    console.error("❌ [validateOrderData] Error:", error.message);
    return res.status(500).json({
      success: false,
      error: "Validation error: " + error.message,
    });
  }
};

// ================================================
// SPECIFIC ROUTES (BEFORE GENERIC ONES)
// ================================================

// POST /verify-payment - Verify payment and create order
router.post("/verify-payment", auth, validateOrderData, async (req, res) => {
  try {
    console.log("\n🔍 [verify-payment] Route handler started");

    const {
      reference,
      orderId,
      shippingInfo,
      items,
      subtotal,
      shipping,
      tax,
      total,
      orderNote,
    } = req.body;

    const userId = req.user.id;

    console.log("\n=== PAYMENT VERIFICATION START ===");
    console.log("Reference:", reference);
    console.log("Order ID:", orderId);
    console.log("User ID:", userId);
    console.log("Items count:", items.length);

    const paystackKey = process.env.PAYSTACK_SECRET_KEY;

    if (!paystackKey) {
      console.error("❌ FATAL: PAYSTACK_SECRET_KEY is not set!");
      return res.status(500).json({
        success: false,
        message: "Server configuration error: Paystack key not found",
        error: "PAYSTACK_SECRET_KEY is not set in environment variables",
      });
    }

    console.log("✅ Paystack key found");
    console.log("🔄 Verifying payment with Paystack...");

    const verificationResponse = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${paystackKey}`,
        },
      }
    );

    console.log(
      "✅ Paystack Response Status:",
      verificationResponse.data.status
    );

    if (!verificationResponse.data.status) {
      console.log("❌ Paystack verification failed");
      return res.status(400).json({
        success: false,
        message: "Payment verification failed with Paystack",
      });
    }

    const paymentData = verificationResponse.data.data;

    if (paymentData.status !== "success") {
      console.log("❌ Payment status is not success");
      return res.status(400).json({
        success: false,
        message: "Payment was not successful",
        paymentStatus: paymentData.status,
      });
    }

    console.log("✅ Payment verified successfully");

    console.log("\n🔄 Validating cart items and updating stock...");

    for (const item of items) {
      console.log(`📦 Processing item: ${item.name}`);

      const product = await Product.findById(item._id || item.productId);
      if (!product) {
        console.error(`❌ Product not found: ${item.name}`);
        return res.status(404).json({
          success: false,
          message: `Product not found: ${item.name}`,
        });
      }

      console.log(`✅ Product found: ${product.name}`);

      if (!product.isInStock(item.quantity)) {
        console.error(`❌ Insufficient stock for ${product.name}`);
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}`,
        });
      }

      console.log(`🔄 Decreasing stock for ${product.name}...`);
      await product.decreaseStock(item.quantity);
      console.log(`✅ Stock updated for ${product.name}`);
    }

    console.log("✅ All items validated and stock updated");

    console.log("\n🔄 Creating order in database...");

    console.log("📋 Order data being created:");
    console.log("  - orderId:", orderId);
    console.log("  - userId:", userId);
    console.log("  - items count:", items.length);
    console.log("  - total:", total);

    const orderData = {
      orderId,
      userId,
      items: items.map((item) => {
        console.log(`  - Mapping item: ${item.name}`);
        return {
          productId: item._id || item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.images?.[0] || item.image || null,
        };
      }),
      shippingInfo: {
        fullName: shippingInfo.fullName,
        email: shippingInfo.email,
        phone: shippingInfo.phone,
        address: shippingInfo.address,
        city: shippingInfo.city,
        state: shippingInfo.state,
        zipCode: shippingInfo.zipCode,
      },
      orderNote: orderNote || "",
      pricing: {
        subtotal,
        shipping,
        tax,
        total,
      },
      paymentInfo: {
        method: "paystack",
        reference: paymentData.reference,
        transactionId: paymentData.id,
        status: "paid",
        paidAt: new Date(paymentData.paid_at),
      },
      status: "processing",
    };

    console.log("📦 Creating Order object...");
    const order = new Order(orderData);

    console.log("💾 Validating Order object...");
    await order.validate();
    console.log("✅ Order object validated");

    console.log("💾 Saving Order to database...");
    const savedOrder = await order.save();

    console.log("✅ Order saved successfully!");
    console.log("Order ID in DB:", savedOrder._id);
    console.log("=== PAYMENT VERIFICATION COMPLETE ===\n");

    return res.status(201).json({
      success: true,
      message: "Payment verified and order created successfully",
      data: {
        orderId: savedOrder.orderId,
        _id: savedOrder._id,
        status: savedOrder.status,
        total: savedOrder.pricing.total,
        paymentStatus: savedOrder.paymentInfo.status,
        email: savedOrder.shippingInfo.email,
        createdAt: savedOrder.createdAt,
      },
    });
  } catch (error) {
    console.error("\n========================================");
    console.error("❌ ORDER CREATION ERROR");
    console.error("========================================");
    console.error("Error Name:", error.name);
    console.error("Error Message:", error.message);
    console.error("Error Code:", error.code);
    console.error("Full Error Object:", error);
    console.error("Stack Trace:", error.stack);

    if (error.response) {
      console.error("HTTP Error Status:", error.response.status);
      console.error("HTTP Error Data:", error.response.data);
    }

    if (error.name === "ValidationError") {
      console.error("🔴 MONGODB VALIDATION ERROR");
      console.error("Validation Errors:", error.errors);

      const validationDetails = Object.keys(error.errors).map((key) => {
        const err = error.errors[key];
        return {
          field: key,
          message: err.message,
          value: err.value,
          kind: err.kind,
        };
      });

      console.error("Formatted Validation Errors:", validationDetails);

      return res.status(400).json({
        success: false,
        message: "Invalid order data",
        error: validationDetails,
        errorType: "ValidationError",
      });
    }

    if (error.name === "CastError") {
      console.error("🔴 MONGODB CAST ERROR");
      console.error("Cast Error Details:", error);
      return res.status(400).json({
        success: false,
        message: "Invalid data format",
        error: error.message,
        errorType: "CastError",
      });
    }

    console.error("========================================\n");

    return res.status(500).json({
      success: false,
      message: "Error creating order",
      error: error.message,
      errorType: error.name,
      details: error.errors || error,
    });
  }
});

// GET /stats/admin - Get order statistics (admin only)
router.get("/stats/admin", auth, isAdmin, async (req, res) => {
  try {
    const stats = (await Order.getOrderStats?.()) || {
      totalOrders: 0,
      totalRevenue: 0,
    };

    return res.json({
      success: true,
      message: "All order statistics",
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching statistics",
      error: error.message,
    });
  }
});

// GET /stats/user - Get user order statistics
router.get("/stats/user", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const stats = (await Order.getOrderStats?.(userId)) || {
      totalOrders: 0,
      totalSpent: 0,
    };

    return res.json({
      success: true,
      message: "User order statistics",
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching user stats:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching user statistics",
      error: error.message,
    });
  }
});

// GET /filter/status/:status - Get orders by status (admin only)
router.get("/filter/status/:status", auth, isAdmin, async (req, res) => {
  try {
    const { status } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const orders = await Order.find({ status })
      .skip((page - 1) * limit)
      .limit(limit * 1)
      .populate("items.productId")
      .populate("userId", "name email");

    const total = await Order.countDocuments({ status });

    return res.json({
      success: true,
      data: orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error filtering orders:", error);
    return res.status(500).json({
      success: false,
      message: "Error filtering orders",
      error: error.message,
    });
  }
});

// ================================================
// GENERIC ROUTES (AFTER SPECIFIC ONES)
// ================================================

// GET / - Get user's orders
router.get("/", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, status } = req.query;

    let query = { userId };
    if (status) {
      query.status = status;
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate("items.productId")
      .populate("notes.createdBy", "name email");

    const total = await Order.countDocuments(query);

    return res.json({
      success: true,
      data: orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching orders",
      error: error.message,
    });
  }
});

// GET /:orderId - Get single order by ID
// ✅ FIXED: Query by orderId field instead of _id
router.get("/:orderId", auth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    console.log(`🔍 Fetching order: ${orderId} for user: ${userId}`);

    const order = await Order.findOne({
      orderId: orderId,
      userId,
    })
      .populate("items.productId")
      .populate("notes.createdBy", "name email");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const daysLeft = order.daysUntilDelivery?.() || null;

    return res.json({
      success: true,
      data: {
        ...order.toObject(),
        daysUntilDelivery: daysLeft,
      },
    });
  } catch (error) {
    console.error("Error fetching order:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching order",
      error: error.message,
    });
  }
});

// POST /:orderId/notes - Add note to order (admin only)
// ✅ FIXED: Query by orderId field instead of _id
router.post("/:orderId/notes", auth, isAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { message } = req.body;
    const adminId = req.user.id;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Note message is required",
      });
    }

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.addNote) {
      await order.addNote(message, adminId);
    }

    return res.json({
      success: true,
      message: "Note added successfully",
      data: order,
    });
  } catch (error) {
    console.error("Error adding note:", error);
    return res.status(500).json({
      success: false,
      message: "Error adding note",
      error: error.message,
    });
  }
});

// PATCH /:orderId/status - Update order status (admin only)
// ✅ FIXED: Query by orderId field instead of _id
router.patch("/:orderId/status", auth, isAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const validStatuses = [
      "processing",
      "shipped",
      "delivered",
      "cancelled",
      "returned",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const order = await Order.findOneAndUpdate(
      { orderId },
      { status, updatedAt: new Date() },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.json({
      success: true,
      message: "Order status updated successfully",
      data: order,
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    return res.status(500).json({
      success: false,
      message: "Error updating order status",
      error: error.message,
    });
  }
});

// PATCH /:orderId/delivery - Update delivery information (admin only)
// ✅ FIXED: Query by orderId field instead of _id
router.patch("/:orderId/delivery", auth, isAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { trackingNumber, estimatedDelivery, deliveredAt } = req.body;

    const order = await Order.findOneAndUpdate(
      { orderId },
      {
        trackingNumber,
        estimatedDelivery: estimatedDelivery
          ? new Date(estimatedDelivery)
          : null,
        deliveredAt: deliveredAt ? new Date(deliveredAt) : null,
        status: deliveredAt ? "delivered" : "shipped",
        updatedAt: new Date(),
      },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.json({
      success: true,
      message: "Delivery information updated successfully",
      data: order,
    });
  } catch (error) {
    console.error("Error updating delivery info:", error);
    return res.status(500).json({
      success: false,
      message: "Error updating delivery information",
      error: error.message,
    });
  }
});

// POST /:orderId/cancel - Cancel order (user)
// ✅ FIXED: Query by orderId field instead of _id
router.post("/:orderId/cancel", auth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    const order = await Order.findOne({ orderId, userId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.canBeCancelled && !order.canBeCancelled()) {
      return res.status(400).json({
        success: false,
        message: "This order cannot be cancelled",
        currentStatus: order.status,
        paymentStatus: order.paymentInfo?.status,
      });
    }

    order.status = "cancelled";
    order.cancellationReason = reason || "User requested cancellation";
    await order.save();

    console.log("🔄 Restoring product stock on cancellation...");
    for (const item of order.items) {
      const product = await Product.findById(item.productId);
      if (product) {
        console.log(`📦 Restoring ${product.name} stock by ${item.quantity}`);
        await product.increaseStock(item.quantity);
        console.log(`✅ Stock restored for ${product.name}`);
      }
    }

    return res.json({
      success: true,
      message: "Order cancelled successfully",
      data: order,
    });
  } catch (error) {
    console.error("Error cancelling order:", error);
    return res.status(500).json({
      success: false,
      message: "Error cancelling order",
      error: error.message,
    });
  }
});

// ================================================
// EXPORT
// ================================================

module.exports = router;
