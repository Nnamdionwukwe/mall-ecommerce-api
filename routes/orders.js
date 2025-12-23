const express = require("express");
const Order = require("../models/Order");
const Product = require("../models/Product");
const { auth, isAdmin } = require("../middleware/auth");
const axios = require("axios");

const router = express.Router();

// ================================================
// MIDDLEWARE
// ================================================

const validateOrderData = (req, res, next) => {
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

  if (!reference) {
    return res.status(400).json({ error: "Payment reference is required" });
  }

  if (!orderId) {
    return res.status(400).json({ error: "Order ID is required" });
  }

  if (!items || items.length === 0) {
    return res.status(400).json({ error: "Cart is empty" });
  }

  if (!shippingInfo) {
    return res.status(400).json({ error: "Shipping information is required" });
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
    return res.status(400).json({ error: "Incomplete shipping information" });
  }

  if (subtotal === undefined || shipping === undefined || tax === undefined) {
    return res.status(400).json({ error: "Pricing information is incomplete" });
  }

  next();
};

// ================================================
// ROUTES
// ================================================

// POST /api/orders/verify-payment - Verify payment and create order
router.post("/verify-payment", auth, validateOrderData, async (req, res) => {
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

    console.log("\n========== ORDER CREATION START ==========");
    console.log("Timestamp:", new Date().toISOString());
    console.log("Reference:", reference);
    console.log("Order ID:", orderId);
    console.log("User ID:", userId);
    console.log("Items Count:", items.length);
    console.log("Total Amount:", total);

    // ========== STEP 1: Verify Paystack ==========
    console.log("\n[STEP 1] Verifying payment with Paystack...");

    if (!process.env.PAYSTACK_SECRET_KEY) {
      console.error("❌ PAYSTACK_SECRET_KEY not set in environment variables");
      return res.status(500).json({
        success: false,
        message: "Server configuration error: Paystack key missing",
      });
    }

    console.log(
      "Using Paystack Key:",
      process.env.PAYSTACK_SECRET_KEY.substring(0, 10) + "..."
    );

    let paymentData;
    try {
      const verificationResponse = await axios.get(
        `https://api.paystack.co/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          },
        }
      );

      console.log(
        "Paystack Response Status:",
        verificationResponse.data.status
      );

      if (!verificationResponse.data.status) {
        console.error("❌ Paystack verification failed");
        return res.status(400).json({
          success: false,
          message: "Payment verification failed with Paystack",
          details: verificationResponse.data,
        });
      }

      paymentData = verificationResponse.data.data;

      if (paymentData.status !== "success") {
        console.error("❌ Payment status is not success:", paymentData.status);
        return res.status(400).json({
          success: false,
          message: "Payment was not successful",
          paymentStatus: paymentData.status,
        });
      }

      console.log("✅ Payment verified successfully");
      console.log("Payment Amount:", paymentData.amount / 100, "NGN");
    } catch (paystackError) {
      console.error("❌ Paystack API Error:", paystackError.message);
      console.error("Paystack Error Details:", paystackError.response?.data);
      return res.status(400).json({
        success: false,
        message: "Paystack verification failed",
        error: paystackError.message,
        details: paystackError.response?.data,
      });
    }

    // ========== STEP 2: Validate Items & Stock ==========
    console.log("\n[STEP 2] Validating items and stock...");

    for (const item of items) {
      try {
        const productId = item._id || item.productId;
        console.log(`Checking product: ${item.name} (ID: ${productId})`);

        const product = await Product.findById(productId);

        if (!product) {
          console.error(`❌ Product not found: ${item.name}`);
          return res.status(404).json({
            success: false,
            message: `Product not found: ${item.name}`,
          });
        }

        console.log(
          `Current stock: ${product.stock}, Requested: ${item.quantity}`
        );

        if (!product.isInStock(item.quantity)) {
          console.error(`❌ Insufficient stock for ${product.name}`);
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${product.name}. Available: ${product.stock}`,
          });
        }

        console.log(`✅ Stock OK for ${item.name}`);
      } catch (itemError) {
        console.error(`❌ Error checking item: ${itemError.message}`);
        return res.status(500).json({
          success: false,
          message: `Error validating item: ${itemError.message}`,
        });
      }
    }

    console.log("✅ All items validated");

    // ========== STEP 3: Update Stock ==========
    console.log("\n[STEP 3] Updating product stock...");

    for (const item of items) {
      try {
        const productId = item._id || item.productId;
        const product = await Product.findById(productId);

        console.log(`Decreasing stock for ${item.name} by ${item.quantity}`);
        await product.decreaseStock(item.quantity);
        console.log(
          `✅ Stock updated for ${item.name}. New stock: ${product.stock}`
        );
      } catch (stockError) {
        console.error(`❌ Error updating stock: ${stockError.message}`);
        return res.status(500).json({
          success: false,
          message: `Error updating stock: ${stockError.message}`,
        });
      }
    }

    console.log("✅ All stock updated");

    // ========== STEP 4: Create Order ==========
    console.log("\n[STEP 4] Creating order in database...");

    try {
      const order = new Order({
        orderId,
        userId,
        items: items.map((item) => ({
          productId: item._id || item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.images?.[0] || item.image || null,
        })),
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
      });

      console.log("Order object created:", JSON.stringify(order, null, 2));

      const savedOrder = await order.save();

      console.log("✅ Order saved successfully");
      console.log("Order ID in DB:", savedOrder._id);
      console.log("\n========== ORDER CREATION COMPLETE ==========\n");

      res.status(201).json({
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
    } catch (saveError) {
      console.error("❌ Error saving order:", saveError.message);
      console.error("Validation Errors:", saveError.errors);
      console.error("Full Error:", saveError);

      if (saveError.name === "ValidationError") {
        return res.status(400).json({
          success: false,
          message: "Invalid order data",
          error: Object.keys(saveError.errors).map((key) => ({
            field: key,
            message: saveError.errors[key].message,
          })),
        });
      }

      return res.status(500).json({
        success: false,
        message: "Error saving order",
        error: saveError.message,
      });
    }
  } catch (error) {
    console.error("\n========== UNEXPECTED ERROR ==========");
    console.error("Error Message:", error.message);
    console.error("Error Type:", error.name);
    console.error("Error Stack:", error.stack);
    console.error("==========================================\n");

    res.status(500).json({
      success: false,
      message: "Error creating order",
      error: error.message,
      errorType: error.name,
    });
  }
});

// GET /api/orders - Get user's orders
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

// GET /api/orders/:orderId - Get single order
router.get("/:orderId", auth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    const order = await Order.findOne({
      _id: orderId,
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

// POST /api/orders/:orderId/cancel - Cancel order
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

    if (!order.canBeCancelled()) {
      return res.status(400).json({
        success: false,
        message: "This order cannot be cancelled",
        currentStatus: order.status,
        paymentStatus: order.paymentInfo.status,
      });
    }

    order.status = "cancelled";
    order.cancellationReason = reason || "User requested cancellation";
    await order.save();

    // Restore product stock
    for (const item of order.items) {
      const product = await Product.findById(item.productId);
      if (product) {
        await product.increaseStock(item.quantity);
      }
    }

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

module.exports = router;
