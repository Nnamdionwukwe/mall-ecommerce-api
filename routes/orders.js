const express = require("express");
const Order = require("../models/Order.js");
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const { auth, isAdmin, isVendor } = require("../middleware/auth");
const axios = require("axios");

const router = express.Router();

const paystackKey = process.env.PAYSTACK_SECRET_KEY;

// Initialize Paystack payment
router.post("/initiate-payment", auth, async (req, res) => {
  try {
    const { email, amount, reference, metadata } = req.body;
    const userId = req.user.id;

    console.log(`💳 [initiate-payment] Starting payment for user: ${userId}`);

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
      console.log(`✅ Payment initialized: ${reference}`);
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
    console.error("❌ Payment initialization error:", error);
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
    const { reference, orderId, shippingInfo, orderNote } = req.body;
    const userId = req.user.id;

    console.log(
      `\n💳 [verify-payment] Verifying payment for user: ${userId}, Reference: ${reference}`
    );

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: "Payment reference is required",
      });
    }

    // Verify with Paystack
    console.log(`🔄 Verifying with Paystack...`);
    const verificationResponse = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    if (!verificationResponse.data.status) {
      console.error(`❌ Payment verification failed`);
      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
      });
    }

    const paymentData = verificationResponse.data.data;

    if (paymentData.status !== "success") {
      console.error(`❌ Payment status not success: ${paymentData.status}`);
      return res.status(400).json({
        success: false,
        message: "Payment was not successful",
      });
    }

    console.log(`✅ Payment verified successfully`);

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

    // Get user's cart
    console.log(`🛒 Fetching cart for user: ${userId}`);
    const cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty",
      });
    }

    console.log(`📦 Processing ${cart.items.length} cart items...`);

    // Validate items and check stock
    const orderItems = [];
    let subtotal = 0;

    for (const cartItem of cart.items) {
      console.log(`📝 Processing item: ${cartItem.name}`);

      // Get fresh product data
      const product = await Product.findById(cartItem.productId._id);

      if (!product) {
        console.error(`❌ Product not found: ${cartItem.productId._id}`);
        return res.status(404).json({
          success: false,
          message: `Product "${cartItem.name}" is no longer available`,
        });
      }

      // Check stock
      if (product.stock < cartItem.quantity) {
        console.error(
          `❌ Insufficient stock for ${product.name}: Requested ${cartItem.quantity}, Available ${product.stock}`
        );
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${product.name}". Only ${product.stock} available.`,
        });
      }

      console.log(`✅ ${product.name} - Stock OK`);

      orderItems.push({
        productId: product._id,
        name: product.name,
        price: product.price,
        quantity: cartItem.quantity,
        image: product.images?.[0] || null,
      });

      subtotal += product.price * cartItem.quantity;
    }

    // Calculate totals
    const shipping = subtotal > 100 ? 0 : 10;
    const tax = subtotal * 0.1;
    const total = subtotal + shipping + tax;

    console.log(
      `💰 Order totals - Subtotal: ${subtotal}, Shipping: ${shipping}, Tax: ${tax}, Total: ${total}`
    );

    // Create order document
    const order = new Order({
      orderId,
      userId,
      items: orderItems,
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
    console.log(`✅ Order created: ${order._id}`);

    // Clear user's cart
    cart.items = [];
    cart.totalPrice = 0;
    cart.totalItems = 0;
    await cart.save();
    console.log(`✅ Cart cleared for user: ${userId}`);

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
    console.error("❌ Order creation error:", error);
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
    const daysLeft = order.daysUntilDelivery?.() || null;

    res.json({
      success: true,
      data: {
        ...order.toObject(),
        daysUntilDelivery: daysLeft,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching order:", error);
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
    console.error("❌ Error fetching orders:", error);
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
    console.error("❌ Error fetching stats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching statistics",
      error: error.message,
    });
  }
});

// Add note to order (admin only)
router.post("/:orderId/notes", auth, async (req, res) => {
  try {
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
    console.error("❌ Error adding note:", error);
    res.status(500).json({
      success: false,
      message: "Error adding note",
      error: error.message,
    });
  }
});

// Update order status (admin only)
router.patch("/:orderId/status", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can update order status",
      });
    }

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
    console.error("❌ Error updating order status:", error);
    res.status(500).json({
      success: false,
      message: "Error updating order status",
      error: error.message,
    });
  }
});

// Update delivery information (admin only)
router.patch("/:orderId/delivery", auth, async (req, res) => {
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
    console.error("❌ Error updating delivery info:", error);
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
    if (order.canBeCancelled && !order.canBeCancelled()) {
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
    console.error("❌ Error cancelling order:", error);
    res.status(500).json({
      success: false,
      message: "Error cancelling order",
      error: error.message,
    });
  }
});

// Find orders by status (admin)
router.get("/filter/status/:status", auth, async (req, res) => {
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
    console.error("❌ Error filtering orders:", error);
    res.status(500).json({
      success: false,
      message: "Error filtering orders",
      error: error.message,
    });
  }
});

// Get all order statistics (admin)
router.get("/admin/stats", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can view statistics",
      });
    }

    const stats = await Order.getOrderStats?.();

    res.json({
      success: true,
      message: "All order statistics",
      data: stats,
    });
  } catch (error) {
    console.error("❌ Error fetching stats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching statistics",
      error: error.message,
    });
  }
});

module.exports = router;
