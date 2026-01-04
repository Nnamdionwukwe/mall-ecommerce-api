const express = require("express");
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const User = require("../models/User");
const { auth, isAdmin } = require("../middleware/auth");

const router = express.Router();

console.log("✅ Carts routes loading...\n");

// ================================================
// ADMIN ROUTES - GET ALL USERS' CARTS
// ================================================

// ✅ FIXED: GET /admin/all-carts - Handle null products
router.get("/admin/all-carts", auth, isAdmin, async (req, res) => {
  try {
    console.log("🔍 [GET /admin/all-carts] Fetching all users' carts");

    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

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

    // ✅ FIXED: Safe mapping with null checks
    const safeCarts = carts.map((cart) => {
      // Filter out null products
      const validItems = cart.items.filter((item) => item.productId !== null);
      const deletedCount = cart.items.length - validItems.length;

      if (deletedCount > 0) {
        console.warn(
          `⚠️ Cart ${cart._id} has ${deletedCount} deleted product references`
        );
      }

      return {
        cartId: cart._id,
        userId: cart.userId?._id || "Unknown",
        userName: cart.userId?.name || "Unknown",
        userEmail: cart.userId?.email || "Unknown",
        userPhone: cart.userId?.phone || "Unknown",
        itemCount: validItems.length,
        deletedItemsCount: deletedCount,
        cartSummary: {
          itemCount: validItems.length,
          subtotal: validItems.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
          ),
          shipping: validItems.length > 0 ? 10 : 0,
          tax:
            validItems.length > 0
              ? validItems.reduce(
                  (sum, item) => sum + item.price * item.quantity,
                  0
                ) * 0.1
              : 0,
          total:
            validItems.length > 0
              ? validItems.reduce(
                  (sum, item) => sum + item.price * item.quantity,
                  0
                ) +
                10 +
                validItems.reduce(
                  (sum, item) => sum + item.price * item.quantity,
                  0
                ) *
                  0.1
              : 0,
        },
        lastUpdated: cart.updatedAt,
      };
    });

    return res.json({
      success: true,
      message: "All users' carts retrieved successfully",
      data: safeCarts,
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

// ✅ FIXED: GET /admin/cart/:userId - Handle null products
router.get("/admin/cart/:userId", auth, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    console.log(
      `🔍 [GET /admin/cart/:userId] Fetching cart for user: ${userId}`
    );

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let cart = await Cart.findOne({ userId }).populate(
      "items.productId",
      "name price images description stock vendor vendorId category"
    );

    if (!cart) {
      return res.json({
        success: true,
        message: "User has no cart",
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

    // ✅ FIXED: Filter out null products safely
    const validItems = cart.items.filter((item) => item.productId !== null);
    const deletedItemsCount = cart.items.length - validItems.length;

    if (deletedItemsCount > 0) {
      console.warn(
        `⚠️ Removing ${deletedItemsCount} deleted products from cart`
      );
      // Clean up cart if there are deleted products
      cart.items = validItems;
      await cart.save();
    }

    const enrichedItems = validItems.map((item) => ({
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

    // Calculate summary manually
    const subtotal = enrichedItems.reduce(
      (sum, item) => sum + item.itemTotal,
      0
    );
    const shipping = subtotal > 0 ? 10 : 0;
    const tax = subtotal * 0.1;
    const total = subtotal + shipping + tax;

    console.log(
      `✅ Found cart for user ${userId} with ${validItems.length} items`
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
        cartSummary: {
          itemCount: validItems.length,
          subtotal,
          shipping,
          tax,
          total,
        },
        deletedItemsRemoved: deletedItemsCount,
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

// ✅ FIXED: GET /admin/carts-summary - Handle null products
router.get("/admin/carts-summary", auth, isAdmin, async (req, res) => {
  try {
    console.log("🔍 [GET /admin/carts-summary] Fetching cart summary");

    const carts = await Cart.find().populate("items.productId");

    let cartsWithItems = 0;
    let totalItems = 0;
    let totalValue = 0;
    let totalDeletedProducts = 0;

    for (const cart of carts) {
      const validItems = cart.items.filter((item) => item.productId !== null);
      const deletedCount = cart.items.length - validItems.length;

      if (validItems.length > 0) {
        cartsWithItems++;
      }

      totalItems += validItems.length;
      totalValue += validItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
      totalDeletedProducts += deletedCount;
    }

    const totalCarts = carts.length;
    const emptyCarts = totalCarts - cartsWithItems;

    console.log("✅ Cart summary retrieved");

    return res.json({
      success: true,
      message: "Cart summary retrieved successfully",
      data: {
        totalUsers: totalCarts,
        usersWithItems: cartsWithItems,
        usersWithoutItems: emptyCarts,
        totalItemsInCarts: totalItems,
        estimatedCartValue: parseFloat(totalValue.toFixed(2)),
        deletedProductReferences: totalDeletedProducts,
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

// ✅ DELETE /admin/cart/:userId - Clear user's cart
router.delete("/admin/cart/:userId", auth, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    console.log(
      `🗑️ [DELETE /admin/cart/:userId] Clearing cart for user: ${userId}`
    );

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    const itemsCleared = cart.items.length;
    cart.items = [];
    cart.totalItems = 0;
    cart.totalPrice = 0;
    await cart.save();

    console.log(
      `✅ Cart cleared for user ${userId}. Items removed: ${itemsCleared}`
    );

    return res.json({
      success: true,
      message: "User cart cleared successfully",
      data: {
        cartId: cart._id,
        userId,
        itemsCleared,
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
// USER ROUTES - GET OWN CART
// ================================================

// ✅ FIXED: GET / - Handle null products in user cart
router.get("/", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`🔍 [GET /] Fetching cart for user: ${userId}`);

    let cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!cart) {
      console.log(`📦 Creating new cart for user: ${userId}`);
      cart = await Cart.create({ userId, items: [] });
    }

    // ✅ FIXED: Filter null products
    const validItems = cart.items.filter((item) => item.productId !== null);
    const deletedCount = cart.items.length - validItems.length;

    if (deletedCount > 0) {
      console.warn(
        `⚠️ Removing ${deletedCount} deleted products from user cart`
      );
      cart.items = validItems;
      await cart.save();
    }

    // ✅ FIXED: Format items with images
    const formattedItems = validItems.map((item) => ({
      _id: item._id,
      productId: item.productId._id,
      name: item.productId.name,
      price: item.productId.price,
      quantity: item.quantity,
      image: item.productId.images?.[0] || "/placeholder.png",
      images: item.productId.images || [],
      category: item.productId.category,
      stock: item.productId.stock,
    }));

    // Calculate summary manually
    const subtotal = formattedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const shipping = subtotal > 100 ? 0 : 10;
    const tax = subtotal * 0.1;
    const total = subtotal + shipping + tax;

    res.json({
      success: true,
      message: "Cart retrieved successfully",
      data: {
        _id: cart._id,
        userId: cart.userId,
        items: formattedItems,
        itemCount: formattedItems.length,
        subtotal,
        shipping,
        tax,
        total,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching cart:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching cart",
      error: error.message,
    });
  }
});

// ✅ POST /add - Add item to cart WITH IMAGES
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

    const product = await Product.findById(productId);
    if (!product) {
      console.error(`❌ Product not found: ${productId}`);
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    console.log(`✅ Product found: ${product.name}`);

    if (quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be greater than 0",
      });
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      console.log(`📦 Creating new cart for user: ${userId}`);
      cart = await Cart.create({ userId, items: [] });
    }

    console.log(`🔄 Adding item to cart...`);

    // Check if item exists
    const existingItem = cart.items.find(
      (item) =>
        item.productId?.toString() === productId ||
        item.productId?._id?.toString() === productId
    );

    if (existingItem) {
      existingItem.quantity += quantity;
      console.log(
        `✅ Updated existing item. New quantity: ${existingItem.quantity}`
      );
    } else {
      cart.items.push({
        productId,
        quantity,
        name: product.name,
        price: product.price,
      });
      console.log(`✅ Added new item to cart`);
    }

    // Recalculate totals
    const validItems = cart.items.filter((item) => item.productId !== null);
    cart.totalItems = validItems.reduce((sum, item) => sum + item.quantity, 0);
    cart.totalPrice = validItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    await cart.save();
    cart = await cart.populate("items.productId");

    // ✅ FIXED: Format items with images
    const formattedItems = cart.items
      .filter((item) => item.productId !== null)
      .map((item) => ({
        _id: item._id,
        productId: item.productId._id,
        name: item.productId.name,
        price: item.productId.price,
        quantity: item.quantity,
        image: item.productId.images?.[0] || "/placeholder.png",
        images: item.productId.images || [],
        category: item.productId.category,
        stock: item.productId.stock,
      }));

    const subtotal = formattedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const shipping = subtotal > 100 ? 0 : 10;
    const tax = subtotal * 0.1;
    const total = subtotal + shipping + tax;

    console.log(
      `✅ Cart updated successfully. Total items: ${formattedItems.length}`
    );

    res.status(200).json({
      success: true,
      message: "Item added to cart successfully",
      data: {
        _id: cart._id,
        items: formattedItems,
        itemCount: formattedItems.length,
        subtotal,
        shipping,
        tax,
        total,
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

// ✅ DELETE /remove/:productId - Remove item from cart WITH PROPER IMAGE HANDLING
router.delete("/remove/:productId", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;

    console.log(
      `🗑️ [DELETE /remove] Removing item. User: ${userId}, Product: ${productId}`
    );

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    cart.items = cart.items.filter(
      (item) =>
        item.productId?.toString() !== productId &&
        item.productId?._id?.toString() !== productId
    );

    cart.totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    cart.totalPrice = cart.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    await cart.save();

    // ✅ FIXED: Format items with images
    const validItems = cart.items.filter((item) => item.productId !== null);
    const formattedItems = validItems.map((item) => ({
      _id: item._id,
      productId: item.productId._id,
      name: item.productId.name,
      price: item.productId.price,
      quantity: item.quantity,
      image: item.productId.images?.[0] || "/placeholder.png",
      images: item.productId.images || [],
      category: item.productId.category,
      stock: item.productId.stock,
    }));

    const subtotal = formattedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const shipping = subtotal > 100 ? 0 : 10;
    const tax = subtotal * 0.1;
    const total = subtotal + shipping + tax;

    console.log(`✅ Item removed successfully`);

    res.json({
      success: true,
      message: "Item removed from cart",
      data: {
        _id: cart._id,
        items: formattedItems,
        itemCount: formattedItems.length,
        subtotal,
        shipping,
        tax,
        total,
      },
    });
  } catch (error) {
    console.error("❌ Error removing from cart:", error);
    res.status(500).json({
      success: false,
      message: "Error removing item from cart",
      error: error.message,
    });
  }
});

// ✅ PATCH /update/:productId - Update item quantity WITH PROPER IMAGE HANDLING
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

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    const item = cart.items.find(
      (item) =>
        item.productId?.toString() === productId ||
        item.productId?._id?.toString() === productId
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found in cart",
      });
    }

    item.quantity = quantity;

    cart.totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    cart.totalPrice = cart.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    await cart.save();

    // ✅ FIXED: Format items with images
    const validItems = cart.items.filter((item) => item.productId !== null);
    const formattedItems = validItems.map((item) => ({
      _id: item._id,
      productId: item.productId._id,
      name: item.productId.name,
      price: item.productId.price,
      quantity: item.quantity,
      image: item.productId.images?.[0] || "/placeholder.png",
      images: item.productId.images || [],
      category: item.productId.category,
      stock: item.productId.stock,
    }));

    const subtotal = formattedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const shipping = subtotal > 100 ? 0 : 10;
    const tax = subtotal * 0.1;
    const total = subtotal + shipping + tax;

    console.log(`✅ Quantity updated successfully`);

    res.json({
      success: true,
      message: "Cart updated successfully",
      data: {
        _id: cart._id,
        items: formattedItems,
        itemCount: formattedItems.length,
        subtotal,
        shipping,
        tax,
        total,
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

// ✅ DELETE /clear - Clear entire cart
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

    cart.items = [];
    cart.totalItems = 0;
    cart.totalPrice = 0;
    await cart.save();

    console.log(`✅ Cart cleared successfully`);

    res.json({
      success: true,
      message: "Cart cleared successfully",
      data: {
        _id: cart._id,
        items: [],
        itemCount: 0,
        subtotal: 0,
        shipping: 0,
        tax: 0,
        total: 0,
      },
    });
  } catch (error) {
    console.error("❌ Error clearing cart:", error);
    res.status(500).json({
      success: false,
      message: "Error clearing cart",
      error: error.message,
    });
  }
});

// ✅ FIXED: GET /summary - Get cart summary WITH IMAGES
router.get("/summary", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`📊 [GET /summary] Fetching cart summary for user: ${userId}`);

    const cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!cart || cart.items.length === 0) {
      return res.json({
        success: true,
        data: {
          items: [],
          itemCount: 0,
          subtotal: 0,
          shipping: 0,
          tax: 0,
          total: 0,
        },
      });
    }

    // ✅ FIXED: Filter and format items with images
    const validItems = cart.items.filter((item) => item.productId !== null);
    const formattedItems = validItems.map((item) => ({
      _id: item._id,
      productId: item.productId._id,
      name: item.productId.name,
      price: item.productId.price,
      quantity: item.quantity,
      image: item.productId.images?.[0] || "/placeholder.png",
      images: item.productId.images || [],
      category: item.productId.category,
      stock: item.productId.stock,
    }));

    const subtotal = formattedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const shipping = subtotal > 100 ? 0 : 10;
    const tax = subtotal * 0.1;
    const total = subtotal + shipping + tax;

    res.json({
      success: true,
      data: {
        items: formattedItems,
        itemCount: formattedItems.length,
        subtotal,
        shipping,
        tax,
        total,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching cart summary:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching cart summary",
      error: error.message,
    });
  }
});

console.log("✅ Carts routes ready\n");

module.exports = router;
