const express = require("express");
const Order = require("../models/Order");
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const User = require("../models/User");
const { auth, isAdmin } = require("../middleware/auth");
const axios = require("axios");

// 🔥 FORCE SET RESEND API KEY
if (!process.env.RESEND_API_KEY) {
  console.warn("⚠️  [orders.js] RESEND_API_KEY not found, setting it manually");
  process.env.RESEND_API_KEY = "re_bTfoC4Xs_7oYsAM31UHFbX7AsSgPnLDAg";
  process.env.RESEND_FROM_EMAIL = "hello@ochachopharmacysupermarket.com";
}

// ✅ Import email functions
const {
  sendOrderConfirmationEmail,
  sendBankTransferConfirmationEmail,
  sendPaymentVerifiedEmail,
  sendOrderShippedEmail,
  sendOrderDeliveredEmail,
  sendOrderCancelledEmail,
} = require("../utils/email");

const router = express.Router();

console.log("✅ Orders routes loading...\n");

// ================================================
// HELPER FUNCTIONS
// ================================================

const getPaystackKey = () => {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error("PAYSTACK_SECRET_KEY not configured");
  }
  return key;
};

const verifyPaystackPayment = async (reference) => {
  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${getPaystackKey()}`,
        },
      }
    );
    return response.data.data;
  } catch (error) {
    throw new Error(`Paystack verification failed: ${error.message}`);
  }
};

// ================================================
// PAYMENT ROUTES
// ================================================

// POST /initiate-payment - Initialize Paystack payment
router.post("/initiate-payment", auth, async (req, res) => {
  try {
    const { email, amount, reference, metadata } = req.body;
    const userId = req.user.id;

    console.log(`💳 [initiate-payment] User: ${userId}, Amount: ${amount}`);

    if (!email || !amount || !reference) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: email, amount, reference",
      });
    }

    const paystackResponse = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email,
        amount: Math.round(amount * 100),
        reference,
        metadata: {
          user_id: userId,
          ...metadata,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${getPaystackKey()}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!paystackResponse.data.status) {
      return res.status(400).json({
        success: false,
        message: "Failed to initialize payment",
      });
    }

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
  } catch (error) {
    console.error("❌ Payment initialization error:", error.message);
    res.status(500).json({
      success: false,
      message: "Error initializing payment",
      error: error.message,
    });
  }
});

// POST /verify-payment - Verify payment and create order
router.post("/verify-payment", auth, async (req, res) => {
  try {
    const { reference, orderId, shippingInfo, orderNote } = req.body;
    const userId = req.user.id;

    console.log(`\n💳 [verify-payment] Starting checkout for user: ${userId}`);

    // ✅ Validate input
    if (!reference) {
      return res.status(400).json({
        success: false,
        message: "Payment reference is required",
      });
    }

    if (!shippingInfo || !shippingInfo.fullName) {
      return res.status(400).json({
        success: false,
        message: "Shipping information is required",
      });
    }

    // ✅ Verify payment with Paystack
    console.log("🔄 Verifying payment with Paystack...");
    const paymentData = await verifyPaystackPayment(reference);

    if (paymentData.status !== "success") {
      console.error(`❌ Payment not successful: ${paymentData.status}`);
      return res.status(400).json({
        success: false,
        message: "Payment was not successful",
      });
    }

    console.log("✅ Payment verified successfully");

    // ✅ Get user's cart
    console.log(`🛒 Fetching cart for user: ${userId}`);
    const cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Your cart is empty. Please add items before checkout.",
      });
    }

    console.log(`📦 Cart has ${cart.items.length} items`);

    // ✅ Validate items and prepare order
    const orderItems = [];
    let subtotal = 0;

    console.log("\n🔄 Processing items...");

    for (const cartItem of cart.items) {
      console.log(`  📝 ${cartItem.name}`);

      const productId = cartItem.productId._id;
      const product = await Product.findById(productId);

      if (!product) {
        console.error(`    ❌ Not found in database`);
        return res.status(404).json({
          success: false,
          message: `Product "${cartItem.name}" no longer available. Please clear your cart and try again.`,
        });
      }

      if (product.stock < cartItem.quantity) {
        console.error(
          `    ❌ Insufficient stock (Need: ${cartItem.quantity}, Have: ${product.stock})`
        );
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${product.name}". Available: ${product.stock}`,
        });
      }

      console.log(`    ✅ Verified`);

      orderItems.push({
        productId: product._id,
        name: product.name,
        price: product.price,
        quantity: cartItem.quantity,
        image: product.images?.[0] || null,
      });

      subtotal += product.price * cartItem.quantity;

      // Decrease stock
      await product.decreaseStock(cartItem.quantity);
    }

    // ✅ Calculate totals
    const shipping = subtotal > 100 ? 0 : 10;
    const tax = Number((subtotal * 0.1).toFixed(2));
    const total = subtotal + shipping + tax;

    console.log(
      `\n💰 Totals: Subtotal: ${subtotal}, Shipping: ${shipping}, Tax: ${tax}, Total: ${total}`
    );

    // ✅ Validate shipping info
    const { fullName, email, phone, address, city, state } = shippingInfo;

    if (!fullName || !email || !phone || !address || !city || !state) {
      return res.status(400).json({
        success: false,
        message: "Incomplete shipping information",
      });
    }

    // ✅ Create order
    console.log("\n💾 Creating order...");

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
        zipCode: shippingInfo.zipCode || "",
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
        paidAt: new Date(paymentData.paid_at || new Date()),
      },
      status: "processing",
    });

    await order.save();
    console.log(`✅ Order created: ${order._id}`);

    // ✅ SEND PAYSTACK ORDER CONFIRMATION EMAIL (Non-blocking)
    sendOrderConfirmationEmail({
      email: shippingInfo.email,
      fullName: shippingInfo.fullName,
      orderId: order.orderId,
      total: order.pricing.total,
      items: orderItems,
      shippingInfo: order.shippingInfo,
      paymentMethod: "Paystack (Card Payment)",
    }).catch((error) => {
      console.error("⚠️ Email failed (non-critical):", error.message);
    });

    // ✅ Clear cart
    console.log("🗑️ Clearing cart...");
    cart.items = [];
    cart.totalPrice = 0;
    cart.totalItems = 0;
    await cart.save();
    console.log("✅ Cart cleared");

    console.log("✅ Checkout complete!\n");

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: {
        orderId: order.orderId,
        _id: order._id,
        status: order.status,
        total: order.pricing.total,
        paymentStatus: "paid",
      },
    });
  } catch (error) {
    console.error("\n❌ ERROR IN VERIFY-PAYMENT:");
    console.error("Message:", error.message);
    console.error("Stack:", error.stack);

    if (error.name === "ValidationError") {
      const errors = Object.keys(error.errors).map((key) => ({
        field: key,
        message: error.errors[key].message,
      }));

      return res.status(400).json({
        success: false,
        message: "Invalid order data",
        errors,
      });
    }

    res.status(500).json({
      success: false,
      message: "Error creating order",
      error: error.message,
    });
  }
});

// POST /create-bank-transfer - Create Bank Transfer Order
router.post("/create-bank-transfer", auth, async (req, res) => {
  try {
    const {
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

    console.log(
      `\n💰 [create-bank-transfer] User: ${userId}, Total: ₦${total}`
    );

    // Validation
    if (!orderId || !shippingInfo || !items || !total) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    if (
      !shippingInfo.fullName ||
      !shippingInfo.email ||
      !shippingInfo.phone ||
      !shippingInfo.address ||
      !shippingInfo.city ||
      !shippingInfo.state
    ) {
      return res.status(400).json({
        success: false,
        message: "All shipping information fields are required",
      });
    }

    if (items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart cannot be empty",
      });
    }

    // Create order
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
        fullName: shippingInfo.fullName,
        email: shippingInfo.email,
        phone: shippingInfo.phone,
        address: shippingInfo.address,
        city: shippingInfo.city,
        state: shippingInfo.state,
        zipCode: shippingInfo.zipCode || "",
      },
      pricing: {
        subtotal,
        shipping,
        tax,
        total,
      },
      paymentInfo: {
        method: "bank_transfer",
        reference: orderId,
        status: "pending",
      },
      status: "pending_payment",
      orderNote: orderNote || "",
    });

    await order.save();
    console.log("✅ Bank transfer order created:", orderId);

    // ✅ SEND BANK TRANSFER CONFIRMATION EMAIL (Non-blocking)
    sendBankTransferConfirmationEmail({
      email: shippingInfo.email,
      fullName: shippingInfo.fullName,
      orderId,
      total,
      items: items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      })),
      shippingInfo,
      bankDetails: {
        bankName: "Monie Point",
        accountName:
          "Providence Courts Integrated Services Nigeria Limited - SuperMarket 2",
        accountNumber: "5165004578",
      },
    }).catch((error) => {
      console.error("⚠️ Email failed (non-critical):", error.message);
    });

    res.status(201).json({
      success: true,
      message: "Order created successfully. Please complete the bank transfer.",
      data: {
        orderId,
        paymentMethod: "bank_transfer",
        paymentStatus: "pending",
        total,
        bankDetails: {
          bankName: "Monie Point",
          accountName:
            "Providence Courts Integrated Services Nigeria Limited - SuperMarket 2",
          accountNumber: "5165004578",
        },
        order,
      },
    });
  } catch (error) {
    console.error("❌ Error creating bank transfer order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create order",
      error: error.message,
    });
  }
});

// POST /verify-bank-transfer/:orderId - Verify Bank Transfer Payment (Admin)
router.post(
  "/verify-bank-transfer/:orderId",
  auth,
  isAdmin,
  async (req, res) => {
    try {
      const { orderId } = req.params;
      const { transactionId, amountReceived, bankStatementProof } = req.body;

      console.log(`\n🔍 [verify-bank-transfer] Order: ${orderId}`);

      // Find order by orderId field
      const order = await Order.findOne({ orderId });
      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      // Verify amount matches
      if (amountReceived < order.pricing.total) {
        return res.status(400).json({
          success: false,
          message: `Amount received (₦${amountReceived}) is less than required (₦${order.pricing.total})`,
        });
      }

      // Update order with verified payment info
      order.paymentInfo.status = "paid";
      order.paymentInfo.paidAt = new Date();
      order.paymentInfo.transactionId = transactionId;
      order.status = "processing";

      await order.save();
      console.log("✅ Bank transfer verified for order:", orderId);

      // ✅ SEND PAYMENT VERIFICATION EMAIL (Non-blocking)
      sendPaymentVerifiedEmail({
        email: order.shippingInfo.email,
        fullName: order.shippingInfo.fullName,
        orderId: order.orderId,
        total: order.pricing.total,
      }).catch((error) => {
        console.error(
          "⚠️ Verification email failed (non-critical):",
          error.message
        );
      });

      res.json({
        success: true,
        message: "Payment verified successfully",
        data: order,
      });
    } catch (error) {
      console.error("❌ Error verifying bank transfer:", error);
      res.status(500).json({
        success: false,
        message: "Failed to verify payment",
        error: error.message,
      });
    }
  }
);

// GET /pending-bank-transfers - Get Pending Bank Transfers (Admin)
router.get("/pending-bank-transfers", auth, isAdmin, async (req, res) => {
  try {
    const pendingOrders = await Order.find({
      "paymentInfo.method": "bank_transfer",
      "paymentInfo.status": "pending",
    })
      .populate("userId", "name email phone")
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      data: pendingOrders,
      count: pendingOrders.length,
    });
  } catch (error) {
    console.error("❌ Error fetching pending transfers:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch pending transfers",
      error: error.message,
    });
  }
});

// GET /bank-transfer-stats - Get Bank Transfer Stats (Admin)
router.get("/bank-transfer-stats", auth, isAdmin, async (req, res) => {
  try {
    const stats = await Order.aggregate([
      { $match: { "paymentInfo.method": "bank_transfer" } },
      {
        $group: {
          _id: "$paymentInfo.status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$pricing.total" },
        },
      },
    ]);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("❌ Error fetching bank transfer stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch stats",
      error: error.message,
    });
  }
});

// GET /user/pending-bank-transfers - Get User's Pending Bank Transfer Orders
router.get("/user/pending-bank-transfers", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const pendingOrders = await Order.find({
      userId,
      "paymentInfo.method": "bank_transfer",
      "paymentInfo.status": "pending",
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: pendingOrders,
      count: pendingOrders.length,
    });
  } catch (error) {
    console.error("❌ Error fetching user pending transfers:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch pending transfers",
      error: error.message,
    });
  }
});

// ================================================
// ADMIN ROUTES (Must come BEFORE dynamic :orderId routes)
// ================================================

// GET /admin/all - Get all orders (admin only)
router.get("/admin/all", auth, isAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 100, status } = req.query;

    let query = {};
    if (status && status !== "all") {
      query.status = status;
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate("userId", "name email")
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

// PATCH /admin/:orderId/status - Update order status (admin only)
router.patch("/admin/:orderId/status", auth, isAdmin, async (req, res) => {
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
        message: `Invalid status. Must be: ${validStatuses.join(", ")}`,
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

    console.log(`✅ Order status updated to: ${status}`);

    // ✅ SEND EMAIL BASED ON STATUS CHANGE (Non-blocking)
    if (status === "delivered") {
      sendOrderDeliveredEmail({
        email: order.shippingInfo.email,
        fullName: order.shippingInfo.fullName,
        orderId: order.orderId,
      }).catch((error) => {
        console.error(
          "⚠️ Delivery email failed (non-critical):",
          error.message
        );
      });
    }

    res.json({
      success: true,
      message: "Order status updated",
      data: order,
    });
  } catch (error) {
    console.error("❌ Error updating status:", error);
    res.status(500).json({
      success: false,
      message: "Error updating order status",
      error: error.message,
    });
  }
});

// PATCH /admin/:orderId/delivery - Update delivery information (admin only)
router.patch("/admin/:orderId/delivery", auth, isAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { trackingNumber, estimatedDelivery, deliveredAt } = req.body;

    console.log("🔄 Updating delivery info for order:", orderId);

    const updateData = {
      updatedAt: new Date(),
    };

    if (trackingNumber !== undefined) {
      updateData.trackingNumber = trackingNumber;
    }

    if (estimatedDelivery !== undefined) {
      updateData.estimatedDelivery = estimatedDelivery;
    }

    if (deliveredAt !== undefined) {
      updateData.deliveredAt = deliveredAt;
    }

    const order = await Order.findByIdAndUpdate(orderId, updateData, {
      new: true,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    console.log("✅ Delivery info updated successfully");

    // ✅ SEND SHIPPING EMAIL IF TRACKING NUMBER PROVIDED (Non-blocking)
    if (trackingNumber) {
      // Also update status to shipped if not already
      if (order.status !== "shipped" && order.status !== "delivered") {
        order.status = "shipped";
        await order.save();
      }

      sendOrderShippedEmail({
        email: order.shippingInfo.email,
        fullName: order.shippingInfo.fullName,
        orderId: order.orderId,
        trackingNumber,
        estimatedDelivery,
      }).catch((error) => {
        console.error(
          "⚠️ Shipping email failed (non-critical):",
          error.message
        );
      });
    }

    res.json({
      success: true,
      message: "Delivery information updated",
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

// ================================================
// USER ROUTES (Dynamic routes must come AFTER specific routes)
// ================================================

// GET / - Get user's orders (alternative to /user/orders)
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

// GET /user/orders - Get user's orders
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

// GET /:orderId - Get single order (search by orderId or _id)
router.get("/:orderId", auth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    console.log(`🔍 Fetching order: ${orderId}`);

    // Try to find by orderId first (custom ID like "ORD-xxx")
    let order = await Order.findOne({
      orderId,
      userId,
    }).populate("items.productId");

    // If not found, try by MongoDB _id
    if (!order) {
      console.log("  Not found by orderId, trying _id...");

      // Check if it's a valid MongoDB ObjectId
      if (orderId.match(/^[0-9a-fA-F]{24}$/)) {
        order = await Order.findOne({
          _id: orderId,
          userId,
        }).populate("items.productId");
      }
    }

    if (!order) {
      console.error(`❌ Order not found: ${orderId}`);
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    console.log(`✅ Order found: ${order._id}`);

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("❌ Error fetching order:", error.message);
    res.status(500).json({
      success: false,
      message: "Error fetching order",
      error: error.message,
    });
  }
});

// POST /:orderId/cancel - Cancel order
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

    if (order.status === "delivered" || order.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "This order cannot be cancelled",
        currentStatus: order.status,
      });
    }

    // Restore stock
    console.log(`🔄 Restoring stock for cancelled order ${orderId}...`);
    for (const item of order.items) {
      const product = await Product.findById(item.productId);
      if (product) {
        await product.increaseStock(item.quantity);
        console.log(`  ✅ Restored ${product.name}`);
      }
    }

    order.status = "cancelled";
    order.cancellationReason = reason || "User requested cancellation";
    await order.save();

    console.log("✅ Order cancelled");

    // ✅ SEND CANCELLATION EMAIL (Non-blocking)
    sendOrderCancelledEmail({
      email: order.shippingInfo.email,
      fullName: order.shippingInfo.fullName,
      orderId: order.orderId,
      reason: order.cancellationReason,
    }).catch((error) => {
      console.error(
        "⚠️ Cancellation email failed (non-critical):",
        error.message
      );
    });

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

console.log("✅ Orders routes ready\n");

module.exports = router;

// const express = require("express");
// const Order = require("../models/Order");
// const Cart = require("../models/Cart");
// const Product = require("../models/Product");
// const User = require("../models/User");
// const { auth, isAdmin } = require("../middleware/auth");
// const axios = require("axios");

// // 🔥 FORCE SET RESEND API KEY
// if (!process.env.RESEND_API_KEY) {
//   console.warn("⚠️  [orders.js] RESEND_API_KEY not found, setting it manually");
//   process.env.RESEND_API_KEY = "re_bTfoC4Xs_7oYsAM31UHFbX7AsSgPnLDAg";
//   process.env.RESEND_FROM_EMAIL = "onboarding@resend.dev";
// }

// // ✅ Import email functions
// const {
//   sendOrderConfirmationEmail,
//   sendBankTransferConfirmationEmail,
//   sendPaymentVerifiedEmail,
//   sendOrderShippedEmail,
//   sendOrderDeliveredEmail,
//   sendOrderCancelledEmail,
// } = require("../utils/email");

// const router = express.Router();

// console.log("✅ Orders routes loading...\n");

// // ================================================
// // HELPER FUNCTIONS
// // ================================================

// const getPaystackKey = () => {
//   const key = process.env.PAYSTACK_SECRET_KEY;
//   if (!key) {
//     throw new Error("sk_test_e5156bb252ddf122917f791b3e5e240ab93d90f5");
//   }
//   return key;
// };

// const verifyPaystackPayment = async (reference) => {
//   try {
//     const response = await axios.get(
//       `https://api.paystack.co/transaction/verify/${reference}`,
//       {
//         headers: {
//           Authorization: `Bearer ${getPaystackKey()}`,
//         },
//       }
//     );
//     return response.data.data;
//   } catch (error) {
//     throw new Error(`Paystack verification failed: ${error.message}`);
//   }
// };

// // ================================================
// // PAYMENT ROUTES
// // ================================================

// // POST /initiate-payment - Initialize Paystack payment
// router.post("/initiate-payment", auth, async (req, res) => {
//   try {
//     const { email, amount, reference, metadata } = req.body;
//     const userId = req.user.id;

//     console.log(`💳 [initiate-payment] User: ${userId}, Amount: ${amount}`);

//     if (!email || !amount || !reference) {
//       return res.status(400).json({
//         success: false,
//         message: "Missing required fields: email, amount, reference",
//       });
//     }

//     const paystackResponse = await axios.post(
//       "https://api.paystack.co/transaction/initialize",
//       {
//         email,
//         amount: Math.round(amount * 100),
//         reference,
//         metadata: {
//           user_id: userId,
//           ...metadata,
//         },
//       },
//       {
//         headers: {
//           Authorization: `Bearer ${getPaystackKey()}`,
//           "Content-Type": "application/json",
//         },
//       }
//     );

//     if (!paystackResponse.data.status) {
//       return res.status(400).json({
//         success: false,
//         message: "Failed to initialize payment",
//       });
//     }

//     console.log(`✅ Payment initialized: ${reference}`);

//     res.json({
//       success: true,
//       message: "Payment initiated successfully",
//       data: {
//         authorizationUrl: paystackResponse.data.data.authorization_url,
//         accessCode: paystackResponse.data.data.access_code,
//         reference: paystackResponse.data.data.reference,
//       },
//     });
//   } catch (error) {
//     console.error("❌ Payment initialization error:", error.message);
//     res.status(500).json({
//       success: false,
//       message: "Error initializing payment",
//       error: error.message,
//     });
//   }
// });

// // POST /verify-payment - Verify payment and create order
// router.post("/verify-payment", auth, async (req, res) => {
//   try {
//     const { reference, orderId, shippingInfo, orderNote } = req.body;
//     const userId = req.user.id;

//     console.log(`\n💳 [verify-payment] Starting checkout for user: ${userId}`);

//     // ✅ Validate input
//     if (!reference) {
//       return res.status(400).json({
//         success: false,
//         message: "Payment reference is required",
//       });
//     }

//     if (!shippingInfo || !shippingInfo.fullName) {
//       return res.status(400).json({
//         success: false,
//         message: "Shipping information is required",
//       });
//     }

//     // ✅ Verify payment with Paystack
//     console.log("🔄 Verifying payment with Paystack...");
//     const paymentData = await verifyPaystackPayment(reference);

//     if (paymentData.status !== "success") {
//       console.error(`❌ Payment not successful: ${paymentData.status}`);
//       return res.status(400).json({
//         success: false,
//         message: "Payment was not successful",
//       });
//     }

//     console.log("✅ Payment verified successfully");

//     // ✅ Get user's cart
//     console.log(`🛒 Fetching cart for user: ${userId}`);
//     const cart = await Cart.findOne({ userId }).populate("items.productId");

//     if (!cart || cart.items.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "Your cart is empty. Please add items before checkout.",
//       });
//     }

//     console.log(`📦 Cart has ${cart.items.length} items`);

//     // ✅ Validate items and prepare order
//     const orderItems = [];
//     let subtotal = 0;

//     console.log("\n🔄 Processing items...");

//     for (const cartItem of cart.items) {
//       console.log(`  📝 ${cartItem.name}`);

//       const productId = cartItem.productId._id;
//       const product = await Product.findById(productId);

//       if (!product) {
//         console.error(`    ❌ Not found in database`);
//         return res.status(404).json({
//           success: false,
//           message: `Product "${cartItem.name}" no longer available. Please clear your cart and try again.`,
//         });
//       }

//       if (product.stock < cartItem.quantity) {
//         console.error(
//           `    ❌ Insufficient stock (Need: ${cartItem.quantity}, Have: ${product.stock})`
//         );
//         return res.status(400).json({
//           success: false,
//           message: `Insufficient stock for "${product.name}". Available: ${product.stock}`,
//         });
//       }

//       console.log(`    ✅ Verified`);

//       orderItems.push({
//         productId: product._id,
//         name: product.name,
//         price: product.price,
//         quantity: cartItem.quantity,
//         image: product.images?.[0] || null,
//       });

//       subtotal += product.price * cartItem.quantity;

//       // Decrease stock
//       await product.decreaseStock(cartItem.quantity);
//     }

//     // ✅ Calculate totals
//     const shipping = subtotal > 100 ? 0 : 10;
//     const tax = Number((subtotal * 0.1).toFixed(2));
//     const total = subtotal + shipping + tax;

//     console.log(
//       `\n💰 Totals: Subtotal: ${subtotal}, Shipping: ${shipping}, Tax: ${tax}, Total: ${total}`
//     );

//     // ✅ Validate shipping info
//     const { fullName, email, phone, address, city, state } = shippingInfo;

//     if (!fullName || !email || !phone || !address || !city || !state) {
//       return res.status(400).json({
//         success: false,
//         message: "Incomplete shipping information",
//       });
//     }

//     // ✅ Create order
//     console.log("\n💾 Creating order...");

//     const order = new Order({
//       orderId,
//       userId,
//       items: orderItems,
//       shippingInfo: {
//         fullName,
//         email,
//         phone,
//         address,
//         city,
//         state,
//         zipCode: shippingInfo.zipCode || "",
//       },
//       orderNote: orderNote || "",
//       pricing: {
//         subtotal,
//         shipping,
//         tax,
//         total,
//       },
//       paymentInfo: {
//         method: "paystack",
//         reference: paymentData.reference,
//         transactionId: paymentData.id,
//         status: "paid",
//         paidAt: new Date(paymentData.paid_at || new Date()),
//       },
//       status: "processing",
//     });

//     await order.save();
//     console.log(`✅ Order created: ${order._id}`);

//     // ✅ SEND PAYSTACK ORDER CONFIRMATION EMAIL (Non-blocking)
//     sendOrderConfirmationEmail({
//       email: shippingInfo.email,
//       fullName: shippingInfo.fullName,
//       orderId: order.orderId,
//       total: order.pricing.total,
//       items: orderItems,
//       shippingInfo: order.shippingInfo,
//       paymentMethod: "Paystack (Card Payment)",
//     }).catch((error) => {
//       console.error("⚠️ Email failed (non-critical):", error.message);
//     });

//     // ✅ Clear cart
//     console.log("🗑️ Clearing cart...");
//     cart.items = [];
//     cart.totalPrice = 0;
//     cart.totalItems = 0;
//     await cart.save();
//     console.log("✅ Cart cleared");

//     console.log("✅ Checkout complete!\n");

//     res.status(201).json({
//       success: true,
//       message: "Order created successfully",
//       data: {
//         orderId: order.orderId,
//         _id: order._id,
//         status: order.status,
//         total: order.pricing.total,
//         paymentStatus: "paid",
//       },
//     });
//   } catch (error) {
//     console.error("\n❌ ERROR IN VERIFY-PAYMENT:");
//     console.error("Message:", error.message);
//     console.error("Stack:", error.stack);

//     if (error.name === "ValidationError") {
//       const errors = Object.keys(error.errors).map((key) => ({
//         field: key,
//         message: error.errors[key].message,
//       }));

//       return res.status(400).json({
//         success: false,
//         message: "Invalid order data",
//         errors,
//       });
//     }

//     res.status(500).json({
//       success: false,
//       message: "Error creating order",
//       error: error.message,
//     });
//   }
// });

// // POST /create-bank-transfer - Create Bank Transfer Order
// router.post("/create-bank-transfer", auth, async (req, res) => {
//   try {
//     const {
//       orderId,
//       shippingInfo,
//       items,
//       subtotal,
//       shipping,
//       tax,
//       total,
//       orderNote,
//     } = req.body;
//     const userId = req.user.id;

//     console.log(
//       `\n💰 [create-bank-transfer] User: ${userId}, Total: ₦${total}`
//     );

//     // Validation
//     if (!orderId || !shippingInfo || !items || !total) {
//       return res.status(400).json({
//         success: false,
//         message: "Missing required fields",
//       });
//     }

//     if (
//       !shippingInfo.fullName ||
//       !shippingInfo.email ||
//       !shippingInfo.phone ||
//       !shippingInfo.address ||
//       !shippingInfo.city ||
//       !shippingInfo.state
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "All shipping information fields are required",
//       });
//     }

//     if (items.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "Cart cannot be empty",
//       });
//     }

//     // Create order
//     const order = new Order({
//       orderId,
//       userId,
//       items: items.map((item) => ({
//         productId: item._id,
//         name: item.name,
//         price: item.price,
//         quantity: item.quantity,
//         image: item.images?.[0] || null,
//       })),
//       shippingInfo: {
//         fullName: shippingInfo.fullName,
//         email: shippingInfo.email,
//         phone: shippingInfo.phone,
//         address: shippingInfo.address,
//         city: shippingInfo.city,
//         state: shippingInfo.state,
//         zipCode: shippingInfo.zipCode || "",
//       },
//       pricing: {
//         subtotal,
//         shipping,
//         tax,
//         total,
//       },
//       paymentInfo: {
//         method: "bank_transfer",
//         reference: orderId,
//         status: "pending",
//       },
//       status: "pending_payment",
//       orderNote: orderNote || "",
//     });

//     await order.save();
//     console.log("✅ Bank transfer order created:", orderId);

//     // ✅ SEND BANK TRANSFER CONFIRMATION EMAIL (Non-blocking)
//     sendBankTransferConfirmationEmail({
//       email: shippingInfo.email,
//       fullName: shippingInfo.fullName,
//       orderId,
//       total,
//       items: items.map((item) => ({
//         name: item.name,
//         quantity: item.quantity,
//         price: item.price,
//       })),
//       shippingInfo,
//       bankDetails: {
//         bankName: "Monie Point",
//         accountName:
//           "Providence Courts Integrated Services Nigeria Limited - SuperMarket 2",
//         accountNumber: "5165004578",
//       },
//     }).catch((error) => {
//       console.error("⚠️ Email failed (non-critical):", error.message);
//     });

//     res.status(201).json({
//       success: true,
//       message: "Order created successfully. Please complete the bank transfer.",
//       data: {
//         orderId,
//         paymentMethod: "bank_transfer",
//         paymentStatus: "pending",
//         total,
//         bankDetails: {
//           bankName: "Monie Point",
//           accountName:
//             "Providence Courts Integrated Services Nigeria Limited - SuperMarket 2",
//           accountNumber: "5165004578",
//         },
//         order,
//       },
//     });
//   } catch (error) {
//     console.error("❌ Error creating bank transfer order:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to create order",
//       error: error.message,
//     });
//   }
// });

// // POST /verify-bank-transfer/:orderId - Verify Bank Transfer Payment (Admin)
// router.post(
//   "/verify-bank-transfer/:orderId",
//   auth,
//   isAdmin,
//   async (req, res) => {
//     try {
//       const { orderId } = req.params;
//       const { transactionId, amountReceived, bankStatementProof } = req.body;

//       console.log(`\n🔍 [verify-bank-transfer] Order: ${orderId}`);

//       // Find order by orderId field
//       const order = await Order.findOne({ orderId });
//       if (!order) {
//         return res.status(404).json({
//           success: false,
//           message: "Order not found",
//         });
//       }

//       // Verify amount matches
//       if (amountReceived < order.pricing.total) {
//         return res.status(400).json({
//           success: false,
//           message: `Amount received (₦${amountReceived}) is less than required (₦${order.pricing.total})`,
//         });
//       }

//       // Update order with verified payment info
//       order.paymentInfo.status = "paid";
//       order.paymentInfo.paidAt = new Date();
//       order.paymentInfo.transactionId = transactionId;
//       order.status = "processing";

//       await order.save();
//       console.log("✅ Bank transfer verified for order:", orderId);

//       // ✅ SEND PAYMENT VERIFICATION EMAIL (Non-blocking)
//       sendPaymentVerifiedEmail({
//         email: order.shippingInfo.email,
//         fullName: order.shippingInfo.fullName,
//         orderId: order.orderId,
//         total: order.pricing.total,
//       }).catch((error) => {
//         console.error(
//           "⚠️ Verification email failed (non-critical):",
//           error.message
//         );
//       });

//       res.json({
//         success: true,
//         message: "Payment verified successfully",
//         data: order,
//       });
//     } catch (error) {
//       console.error("❌ Error verifying bank transfer:", error);
//       res.status(500).json({
//         success: false,
//         message: "Failed to verify payment",
//         error: error.message,
//       });
//     }
//   }
// );

// // GET /pending-bank-transfers - Get Pending Bank Transfers (Admin)
// router.get("/pending-bank-transfers", auth, isAdmin, async (req, res) => {
//   try {
//     const pendingOrders = await Order.find({
//       "paymentInfo.method": "bank_transfer",
//       "paymentInfo.status": "pending",
//     })
//       .populate("userId", "name email phone")
//       .sort({ createdAt: -1 })
//       .limit(50);

//     res.json({
//       success: true,
//       data: pendingOrders,
//       count: pendingOrders.length,
//     });
//   } catch (error) {
//     console.error("❌ Error fetching pending transfers:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch pending transfers",
//       error: error.message,
//     });
//   }
// });

// // GET /bank-transfer-stats - Get Bank Transfer Stats (Admin)
// router.get("/bank-transfer-stats", auth, isAdmin, async (req, res) => {
//   try {
//     const stats = await Order.aggregate([
//       { $match: { "paymentInfo.method": "bank_transfer" } },
//       {
//         $group: {
//           _id: "$paymentInfo.status",
//           count: { $sum: 1 },
//           totalAmount: { $sum: "$pricing.total" },
//         },
//       },
//     ]);

//     res.json({
//       success: true,
//       data: stats,
//     });
//   } catch (error) {
//     console.error("❌ Error fetching bank transfer stats:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch stats",
//       error: error.message,
//     });
//   }
// });

// // GET /user/pending-bank-transfers - Get User's Pending Bank Transfer Orders
// router.get("/user/pending-bank-transfers", auth, async (req, res) => {
//   try {
//     const userId = req.user.id;

//     const pendingOrders = await Order.find({
//       userId,
//       "paymentInfo.method": "bank_transfer",
//       "paymentInfo.status": "pending",
//     }).sort({ createdAt: -1 });

//     res.json({
//       success: true,
//       data: pendingOrders,
//       count: pendingOrders.length,
//     });
//   } catch (error) {
//     console.error("❌ Error fetching user pending transfers:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch pending transfers",
//       error: error.message,
//     });
//   }
// });

// // ================================================
// // ADMIN ROUTES (Must come BEFORE dynamic :orderId routes)
// // ================================================

// // GET /admin/all - Get all orders (admin only)
// router.get("/admin/all", auth, isAdmin, async (req, res) => {
//   try {
//     const { page = 1, limit = 100, status } = req.query;

//     let query = {};
//     if (status && status !== "all") {
//       query.status = status;
//     }

//     const orders = await Order.find(query)
//       .sort({ createdAt: -1 })
//       .limit(limit * 1)
//       .skip((page - 1) * limit)
//       .populate("userId", "name email")
//       .populate("items.productId");

//     const total = await Order.countDocuments(query);

//     res.json({
//       success: true,
//       data: orders,
//       pagination: {
//         page: parseInt(page),
//         limit: parseInt(limit),
//         total,
//         pages: Math.ceil(total / limit),
//       },
//     });
//   } catch (error) {
//     console.error("❌ Error fetching orders:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error fetching orders",
//       error: error.message,
//     });
//   }
// });

// // PATCH /admin/:orderId/status - Update order status (admin only)
// router.patch("/admin/:orderId/status", auth, isAdmin, async (req, res) => {
//   try {
//     const { orderId } = req.params;
//     const { status } = req.body;

//     const validStatuses = [
//       "processing",
//       "shipped",
//       "delivered",
//       "cancelled",
//       "returned",
//     ];

//     if (!validStatuses.includes(status)) {
//       return res.status(400).json({
//         success: false,
//         message: `Invalid status. Must be: ${validStatuses.join(", ")}`,
//       });
//     }

//     const order = await Order.findByIdAndUpdate(
//       orderId,
//       { status, updatedAt: new Date() },
//       { new: true }
//     );

//     if (!order) {
//       return res.status(404).json({
//         success: false,
//         message: "Order not found",
//       });
//     }

//     res.json({
//       success: true,
//       message: "Order status updated",
//       data: order,
//     });
//   } catch (error) {
//     console.error("❌ Error updating status:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error updating order status",
//       error: error.message,
//     });
//   }
// });

// // PATCH /admin/:orderId/delivery - Update delivery information (admin only)
// router.patch("/admin/:orderId/delivery", auth, isAdmin, async (req, res) => {
//   try {
//     const { orderId } = req.params;
//     const { trackingNumber, estimatedDelivery, deliveredAt } = req.body;

//     console.log("🔄 Updating delivery info for order:", orderId);

//     const updateData = {
//       updatedAt: new Date(),
//     };

//     if (trackingNumber !== undefined) {
//       updateData.trackingNumber = trackingNumber;
//     }

//     if (estimatedDelivery !== undefined) {
//       updateData.estimatedDelivery = estimatedDelivery;
//     }

//     if (deliveredAt !== undefined) {
//       updateData.deliveredAt = deliveredAt;
//     }

//     const order = await Order.findByIdAndUpdate(orderId, updateData, {
//       new: true,
//     });

//     if (!order) {
//       return res.status(404).json({
//         success: false,
//         message: "Order not found",
//       });
//     }

//     console.log("✅ Delivery info updated successfully");

//     // ✅ SEND SHIPPING EMAIL IF TRACKING NUMBER PROVIDED (Non-blocking)
//     if (trackingNumber && order.status === "shipped") {
//       sendOrderShippedEmail({
//         email: order.shippingInfo.email,
//         fullName: order.shippingInfo.fullName,
//         orderId: order.orderId,
//         trackingNumber,
//         estimatedDelivery,
//       }).catch((error) => {
//         console.error(
//           "⚠️ Shipping email failed (non-critical):",
//           error.message
//         );
//       });
//     }

//     res.json({
//       success: true,
//       message: "Delivery information updated",
//       data: order,
//     });
//   } catch (error) {
//     console.error("❌ Error updating delivery info:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error updating delivery information",
//       error: error.message,
//     });
//   }
// });

// // ================================================
// // USER ROUTES (Dynamic routes must come AFTER specific routes)
// // ================================================

// // GET / - Get user's orders (alternative to /user/orders)
// router.get("/", auth, async (req, res) => {
//   try {
//     const userId = req.user.id;
//     const { page = 1, limit = 10, status } = req.query;

//     let query = { userId };
//     if (status) {
//       query.status = status;
//     }

//     const orders = await Order.find(query)
//       .sort({ createdAt: -1 })
//       .limit(limit * 1)
//       .skip((page - 1) * limit)
//       .populate("items.productId");

//     const total = await Order.countDocuments(query);

//     res.json({
//       success: true,
//       data: orders,
//       pagination: {
//         page: parseInt(page),
//         limit: parseInt(limit),
//         total,
//         pages: Math.ceil(total / limit),
//       },
//     });
//   } catch (error) {
//     console.error("❌ Error fetching orders:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error fetching orders",
//       error: error.message,
//     });
//   }
// });

// // GET /user/orders - Get user's orders
// router.get("/user/orders", auth, async (req, res) => {
//   try {
//     const userId = req.user.id;
//     const { page = 1, limit = 10, status } = req.query;

//     let query = { userId };
//     if (status) {
//       query.status = status;
//     }

//     const orders = await Order.find(query)
//       .sort({ createdAt: -1 })
//       .limit(limit * 1)
//       .skip((page - 1) * limit)
//       .populate("items.productId");

//     const total = await Order.countDocuments(query);

//     res.json({
//       success: true,
//       data: orders,
//       pagination: {
//         page: parseInt(page),
//         limit: parseInt(limit),
//         total,
//         pages: Math.ceil(total / limit),
//       },
//     });
//   } catch (error) {
//     console.error("❌ Error fetching orders:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error fetching orders",
//       error: error.message,
//     });
//   }
// });

// // GET /:orderId - Get single order (search by orderId or _id)
// router.get("/:orderId", auth, async (req, res) => {
//   try {
//     const { orderId } = req.params;
//     const userId = req.user.id;

//     console.log(`🔍 Fetching order: ${orderId}`);

//     // Try to find by orderId first (custom ID like "ORD-xxx")
//     let order = await Order.findOne({
//       orderId,
//       userId,
//     }).populate("items.productId");

//     // If not found, try by MongoDB _id
//     if (!order) {
//       console.log("  Not found by orderId, trying _id...");

//       // Check if it's a valid MongoDB ObjectId
//       if (orderId.match(/^[0-9a-fA-F]{24}$/)) {
//         order = await Order.findOne({
//           _id: orderId,
//           userId,
//         }).populate("items.productId");
//       }
//     }

//     if (!order) {
//       console.error(`❌ Order not found: ${orderId}`);
//       return res.status(404).json({
//         success: false,
//         message: "Order not found",
//       });
//     }

//     console.log(`✅ Order found: ${order._id}`);

//     res.json({
//       success: true,
//       data: order,
//     });
//   } catch (error) {
//     console.error("❌ Error fetching order:", error.message);
//     res.status(500).json({
//       success: false,
//       message: "Error fetching order",
//       error: error.message,
//     });
//   }
// });

// // POST /:orderId/cancel - Cancel order
// router.post("/:orderId/cancel", auth, async (req, res) => {
//   try {
//     const { orderId } = req.params;
//     const { reason } = req.body;
//     const userId = req.user.id;

//     const order = await Order.findOne({ _id: orderId, userId });

//     if (!order) {
//       return res.status(404).json({
//         success: false,
//         message: "Order not found",
//       });
//     }

//     if (order.status === "delivered" || order.status === "cancelled") {
//       return res.status(400).json({
//         success: false,
//         message: "This order cannot be cancelled",
//         currentStatus: order.status,
//       });
//     }

//     // Restore stock
//     console.log(`🔄 Restoring stock for cancelled order ${orderId}...`);
//     for (const item of order.items) {
//       const product = await Product.findById(item.productId);
//       if (product) {
//         await product.increaseStock(item.quantity);
//         console.log(`  ✅ Restored ${product.name}`);
//       }
//     }

//     order.status = "cancelled";
//     order.cancellationReason = reason || "User requested cancellation";
//     await order.save();

//     console.log("✅ Order cancelled");

//     res.json({
//       success: true,
//       message: "Order cancelled successfully",
//       data: order,
//     });
//   } catch (error) {
//     console.error("❌ Error cancelling order:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error cancelling order",
//       error: error.message,
//     });
//   }
// });

// console.log("✅ Orders routes ready\n");

// module.exports = router;
