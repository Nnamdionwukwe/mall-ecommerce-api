const express = require("express");
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const { auth } = require("../middleware/auth");

const router = express.Router();

// Get user's cart
router.get("/", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    let cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!cart) {
      // Create new cart if doesn't exist
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

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    // Validate product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

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
      cart = await Cart.create({ userId, items: [] });
    }

    // Add item to cart
    await cart.addItem(product, quantity);

    // Repopulate and get updated cart
    cart = await cart.populate("items.productId");

    const cartSummary = cart.getCartSummary();

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
    console.error("Error adding to cart:", error);
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

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    await cart.removeItem(productId);

    const cartSummary = cart.getCartSummary();

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

    await cart.updateQuantity(productId, quantity);

    const cartSummary = cart.getCartSummary();

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

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    await cart.clearCart();

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
