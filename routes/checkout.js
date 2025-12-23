const express = require("express");
const Order = require("../models/Order.js");
const { auth, isAdmin, isVendor } = require("../middleware/auth");
const axios = require("axios");
// const mongoose = require("mongoose");

const router = express.Router();

const paystackKey = process.env.PAYSTACK_SECRET_KEY;

// Initialize Paystack payment
router.post("/initiate-payment", auth, async (req, res) => {
  try {
    const { email, amount, reference, metadata } = req.body;
    const userId = req.user.id;

    if (!email || !amount || !reference) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: email, amount, reference",
      });
    }

    // Validate with Paystack
    const paystackResponse = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email,
        amount: Math.round(amount * 100), // Convert to kobo
        reference,
        metadata: {
          user_id: userId,
          ...metadata,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (paystackResponse.data.status) {
      res.json({
        success: true,
        message: "Payment initiated successfully",
        data: {
          authorizationUrl: paystackResponse.data.data.authorization_url,
          accessCode: paystackResponse.data.data.access_code,
          reference: paystackResponse.data.data.reference,
        },
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Failed to initialize payment",
      });
    }
  } catch (error) {
    console.error("Payment initialization error:", error);
    res.status(500).json({
      success: false,
      message: "Error initializing payment",
      error: error.message,
    });
  }
});

// Verify payment and create order
router.post("/orders/verify-payment", auth, async (req, res) => {
  try {
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

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: "Payment reference is required",
      });
    }

    // Verify with Paystack
    const verificationResponse = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    if (!verificationResponse.data.status) {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
      });
    }

    const paymentData = verificationResponse.data.data;

    if (paymentData.status !== "success") {
      return res.status(400).json({
        success: false,
        message: "Payment was not successful",
      });
    }

    // Validate shipping info
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
      return res.status(400).json({
        success: false,
        message: "Incomplete shipping information",
      });
    }

    // Validate items
    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty",
      });
    }

    // Create order document
    const order = new Order({
      orderId,
      userId,
      items: items.map((item) => ({
        productId: item._id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.images?.[0] || null,
      })),
      shippingInfo: {
        fullName,
        email,
        phone,
        address,
        city,
        state,
        zipCode,
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
        paidAt: new Date(),
      },
      status: "processing",
    });

    // Save order to database
    await order.save();

    // Clear user's cart
    // await Cart.deleteMany({ userId });

    res.status(201).json({
      success: true,
      message: "Payment verified and order created successfully",
      data: {
        orderId: order.orderId,
        _id: order._id,
        status: order.status,
        total: order.pricing.total,
        paymentStatus: order.paymentInfo.status,
      },
    });
  } catch (error) {
    console.error("Order creation error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating order",
      error: error.message,
    });
  }
});

// Get order by ID
router.get("/:orderId", auth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    const order = await Order.findOne({
      _id: orderId,
      userId,
    }).populate("items.productId notes.createdBy");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Get days until delivery
    const daysLeft = order.daysUntilDelivery();

    res.json({
      success: true,
      data: {
        ...order.toObject(),
        daysUntilDelivery: daysLeft,
      },
    });
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching order",
      error: error.message,
    });
  }
});

// Get user's orders
router.get("/user/orders", auth, async (req, res) => {
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
      .populate("items.productId");

    const total = await Order.countDocuments(query);

    res.json({
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
    res.status(500).json({
      success: false,
      message: "Error fetching orders",
      error: error.message,
    });
  }
});

// Get user's order statistics
router.get("/user/stats", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const stats = await Order.getOrderStats(userId);

    res.json({
      success: true,
      message: "Order statistics retrieved",
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching statistics",
      error: error.message,
    });
  }
});

// Add note to order (admin only)
router.post("/:orderId/notes", isAdmin, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can add notes to orders",
      });
    }

    const { orderId } = req.params;
    const { message } = req.body;
    const adminId = req.user.id;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Note message is required",
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Use the addNote method from schema
    await order.addNote(message, adminId);

    res.json({
      success: true,
      message: "Note added successfully",
      data: order,
    });
  } catch (error) {
    console.error("Error adding note:", error);
    res.status(500).json({
      success: false,
      message: "Error adding note",
      error: error.message,
    });
  }
});

// Update order status (admin only)
router.patch("/:orderId/status", isAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    // Check if user is admin
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can update order status",
      });
    }

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

    const order = await Order.findByIdAndUpdate(
      orderId,
      { status, updatedAt: new Date() },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.json({
      success: true,
      message: "Order status updated successfully",
      data: order,
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({
      success: false,
      message: "Error updating order status",
      error: error.message,
    });
  }
});

// Update delivery information (admin only)
router.patch("/:orderId/delivery", isAdmin, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can update delivery information",
      });
    }

    const { orderId } = req.params;
    const { trackingNumber, estimatedDelivery, deliveredAt } = req.body;

    const order = await Order.findByIdAndUpdate(
      orderId,
      {
        trackingNumber,
        estimatedDelivery,
        deliveredAt,
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

    res.json({
      success: true,
      message: "Delivery information updated successfully",
      data: order,
    });
  } catch (error) {
    console.error("Error updating delivery info:", error);
    res.status(500).json({
      success: false,
      message: "Error updating delivery information",
      error: error.message,
    });
  }
});

// Cancel order (user)
router.post("/:orderId/cancel", auth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Use the canBeCancelled method
    if (!order.canBeCancelled()) {
      return res.status(400).json({
        success: false,
        message: "This order cannot be cancelled",
        currentStatus: order.status,
        paymentStatus: order.paymentInfo.status,
      });
    }

    // Cancel order
    order.status = "cancelled";
    order.cancellationReason = reason || "User requested cancellation";
    await order.save();

    res.json({
      success: true,
      message: "Order cancelled successfully",
      data: order,
    });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(500).json({
      success: false,
      message: "Error cancelling order",
      error: error.message,
    });
  }
});

// Find orders by status (admin)
router.get("/filter/status/:status", isAdmin, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can filter orders",
      });
    }

    const { status } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const orders = await Order.find({ status })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate("items.productId userId");

    const total = await Order.countDocuments({ status });

    res.json({
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
    res.status(500).json({
      success: false,
      message: "Error filtering orders",
      error: error.message,
    });
  }
});

// Get all order statistics (admin)
router.get("/admin/stats", isAdmin, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can view statistics",
      });
    }

    const stats = await Order.getOrderStats();

    res.json({
      success: true,
      message: "All order statistics",
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching statistics",
      error: error.message,
    });
  }
});

module.exports = router;
