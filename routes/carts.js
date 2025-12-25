const express = require("express");
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const User = require("../models/User");
const { auth, isAdmin } = require("../middleware/auth");

const router = express.Router();

// ================================================
// ADMIN ROUTES - GET ALL USERS' CARTS
// ================================================

// GET /admin/all-carts - Get all users' carts with pagination
router.get("/admin/all-carts", auth, isAdmin, async (req, res) => {
  try {
    console.log("🔍 [GET /admin/all-carts] Fetching all users' carts");

    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    // Get all carts with user and product details
    const carts = await Cart.find()
      .populate({
        path: "userId",
        select: "name email phone address",
      })
      .populate({
        path: "items.productId",
        select: "name price images description stock",
      })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit * 1);

    const total = await Cart.countDocuments();

    console.log(`✅ Found ${carts.length} carts out of ${total} total`);

    return res.json({
      success: true,
      message: "All users' carts retrieved successfully",
      data: carts.map((cart) => ({
        cartId: cart._id,
        userId: cart.userId._id,
        userName: cart.userId.name,
        userEmail: cart.userId.email,
        userPhone: cart.userId.phone,
        itemCount: cart.items.length,
        cartSummary: cart.getCartSummary(),
        lastUpdated: cart.updatedAt,
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("❌ Error fetching all carts:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching all carts",
      error: error.message,
    });
  }
});

// GET /admin/cart/:userId - Get specific user's cart with full details and products
router.get("/admin/cart/:userId", auth, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    console.log(
      `🔍 [GET /admin/cart/:userId] Fetching cart for user: ${userId}`
    );

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Get user's cart with populated product details
    let cart = await Cart.findOne({ userId }).populate(
      "items.productId",
      "name price images description stock vendor vendorId category"
    );

    if (!cart || cart.items.length === 0) {
      return res.json({
        success: true,
        message: "User has no items in cart",
        data: {
          userId,
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            address: user.address,
            role: user.role,
            isActive: user.isActive,
            joinedDate: user.createdAt,
          },
          items: [],
          cartSummary: {
            itemCount: 0,
            subtotal: 0,
            shipping: 0,
            tax: 0,
            total: 0,
          },
        },
      });
    }

    // Get cart summary
    const cartSummary = cart.getCartSummary();

    // Enrich items with product details
    const enrichedItems = cart.items.map((item) => ({
      productId: item.productId._id,
      name: item.productId.name,
      price: item.price,
      quantity: item.quantity,
      itemTotal: item.price * item.quantity,
      image: item.productId.images?.[0] || null,
      stock: item.productId.stock,
      vendor: item.productId.vendor || null,
      category: item.productId.category || null,
    }));

    console.log(
      `✅ Found cart for user ${userId} with ${cart.items.length} items`
    );

    return res.json({
      success: true,
      message: "User cart retrieved successfully",
      data: {
        cartId: cart._id,
        userId,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          address: user.address,
          role: user.role,
          isActive: user.isActive,
          joinedDate: user.createdAt,
        },
        items: enrichedItems,
        cartSummary,
        updatedAt: cart.updatedAt,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching user cart:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching user cart",
      error: error.message,
    });
  }
});

// GET /admin/carts-summary - Get summary of all carts
router.get("/admin/carts-summary", auth, isAdmin, async (req, res) => {
  try {
    console.log("🔍 [GET /admin/carts-summary] Fetching cart summary");

    // Get carts with items
    const cartsWithItems = await Cart.countDocuments({
      "items.0": { $exists: true },
    });
    const totalCarts = await Cart.countDocuments();
    const emptyCarts = totalCarts - cartsWithItems;

    // Get total items across all carts
    const cartStats = await Cart.aggregate([
      {
        $group: {
          _id: null,
          totalItems: { $sum: { $size: "$items" } },
          totalValue: {
            $sum: {
              $reduce: {
                input: "$items",
                initialValue: 0,
                in: {
                  $add: [
                    "$$value",
                    { $multiply: ["$$this.price", "$$this.quantity"] },
                  ],
                },
              },
            },
          },
        },
      },
    ]);

    const stats = cartStats[0] || { totalItems: 0, totalValue: 0 };

    console.log("✅ Cart summary retrieved");

    return res.json({
      success: true,
      message: "Cart summary retrieved successfully",
      data: {
        totalUsers: totalCarts,
        usersWithItems: cartsWithItems,
        usersWithoutItems: emptyCarts,
        totalItemsInCarts: stats.totalItems,
        estimatedCartValue: parseFloat(stats.totalValue.toFixed(2)),
      },
    });
  } catch (error) {
    console.error("❌ Error fetching cart summary:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching cart summary",
      error: error.message,
    });
  }
});

// DELETE /admin/cart/:userId - Clear a user's cart (admin)
router.delete("/admin/cart/:userId", auth, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    console.log(
      `🔍 [DELETE /admin/cart/:userId] Clearing cart for user: ${userId}`
    );

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    // Clear cart and save
    cart.clearCart();
    await cart.save();

    console.log(`✅ Cart cleared for user ${userId}`);

    return res.json({
      success: true,
      message: "User cart cleared successfully",
      data: {
        cartId: cart._id,
        userId,
        items: [],
        cartSummary: {
          itemCount: 0,
          subtotal: 0,
          shipping: 0,
          tax: 0,
          total: 0,
        },
      },
    });
  } catch (error) {
    console.error("❌ Error clearing cart:", error);
    return res.status(500).json({
      success: false,
      message: "Error clearing cart",
      error: error.message,
    });
  }
});

// ================================================
// USER ROUTES - GET OWN CART (Existing functionality)
// ================================================

// Get user's cart
router.get("/", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`🔍 [GET /] Fetching cart for user: ${userId}`);

    let cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!cart) {
      // Create new cart if doesn't exist
      console.log(`📦 Creating new cart for user: ${userId}`);
      cart = await Cart.create({ userId, items: [] });
    }

    const cartSummary = cart.getCartSummary();

    res.json({
      success: true,
      message: "Cart retrieved successfully",
      data: {
        _id: cart._id,
        userId: cart.userId,
        items: cart.items,
        ...cartSummary,
      },
    });
  } catch (error) {
    console.error("Error fetching cart:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching cart",
      error: error.message,
    });
  }
});

// Add item to cart
router.post("/add", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, quantity = 1 } = req.body;

    console.log(
      `📝 [POST /add] Adding item to cart. User: ${userId}, Product: ${productId}, Quantity: ${quantity}`
    );

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    // Validate product exists
    const product = await Product.findById(productId);
    if (!product) {
      console.error(`❌ Product not found: ${productId}`);
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    console.log(`✅ Product found: ${product.name}`);

    // Validate quantity
    if (quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be greater than 0",
      });
    }

    // Get or create cart
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      console.log(`📦 Creating new cart for user: ${userId}`);
      cart = await Cart.create({ userId, items: [] });
    }

    console.log(`🔄 Adding item to cart...`);

    // Add item to cart and save
    cart.addItem(product, quantity);
    await cart.save();

    console.log(`✅ Item added. Cart saved.`);

    // Repopulate and get updated cart
    cart = await cart.populate("items.productId");

    const cartSummary = cart.getCartSummary();

    console.log(
      `✅ Cart updated successfully. Total items: ${cart.items.length}`
    );

    res.status(200).json({
      success: true,
      message: "Item added to cart successfully",
      data: {
        _id: cart._id,
        items: cart.items,
        ...cartSummary,
      },
    });
  } catch (error) {
    console.error("❌ Error adding to cart:", error);
    res.status(500).json({
      success: false,
      message: "Error adding item to cart",
      error: error.message,
    });
  }
});

// Remove item from cart
router.delete("/remove/:productId", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;

    console.log(
      `🗑️ [DELETE /remove] Removing item. User: ${userId}, Product: ${productId}`
    );

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    // Remove item and save
    cart.removeItem(productId);
    await cart.save();

    const cartSummary = cart.getCartSummary();

    console.log(`✅ Item removed successfully`);

    res.json({
      success: true,
      message: "Item removed from cart",
      data: {
        _id: cart._id,
        items: cart.items,
        ...cartSummary,
      },
    });
  } catch (error) {
    console.error("Error removing from cart:", error);
    res.status(500).json({
      success: false,
      message: "Error removing item from cart",
      error: error.message,
    });
  }
});

// Update item quantity
router.patch("/update/:productId", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;
    const { quantity } = req.body;

    console.log(
      `📝 [PATCH /update] Updating quantity. User: ${userId}, Product: ${productId}, Quantity: ${quantity}`
    );

    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be greater than 0",
      });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    // Update quantity and save
    cart.updateQuantity(productId, quantity);
    await cart.save();

    const cartSummary = cart.getCartSummary();

    console.log(`✅ Quantity updated successfully`);

    res.json({
      success: true,
      message: "Cart updated successfully",
      data: {
        _id: cart._id,
        items: cart.items,
        ...cartSummary,
      },
    });
  } catch (error) {
    console.error("Error updating cart:", error);
    res.status(500).json({
      success: false,
      message: "Error updating cart",
      error: error.message,
    });
  }
});

// Clear cart
router.delete("/clear", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`🗑️ [DELETE /clear] Clearing entire cart for user: ${userId}`);

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    // Clear cart and save
    cart.clearCart();
    await cart.save();

    console.log(`✅ Cart cleared successfully`);

    res.json({
      success: true,
      message: "Cart cleared successfully",
      data: {
        _id: cart._id,
        items: [],
        subtotal: 0,
        shipping: 0,
        tax: 0,
        total: 0,
        itemCount: 0,
      },
    });
  } catch (error) {
    console.error("Error clearing cart:", error);
    res.status(500).json({
      success: false,
      message: "Error clearing cart",
      error: error.message,
    });
  }
});

// Get cart summary
router.get("/summary", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`📊 [GET /summary] Fetching cart summary for user: ${userId}`);

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.json({
        success: true,
        data: {
          items: [],
          subtotal: 0,
          shipping: 0,
          tax: 0,
          total: 0,
          itemCount: 0,
        },
      });
    }

    const cartSummary = cart.getCartSummary();

    res.json({
      success: true,
      data: cartSummary,
    });
  } catch (error) {
    console.error("Error fetching cart summary:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching cart summary",
      error: error.message,
    });
  }
});

module.exports = router;
