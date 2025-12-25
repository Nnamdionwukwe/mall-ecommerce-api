const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  name: String,
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  image: String,
  images: [String],
});

const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    items: [cartItemSchema],
    totalPrice: { type: Number, default: 0 },
    totalItems: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// ✅ FIXED: Use proper function syntax (not arrow) with error handling
cartSchema.pre("save", function (next) {
  try {
    this.totalItems = this.items.reduce(
      (sum, item) => sum + (item.quantity || 0),
      0
    );
    this.totalPrice = this.items.reduce(
      (sum, item) => sum + (item.price || 0) * (item.quantity || 0),
      0
    );
    next();
  } catch (error) {
    console.error("❌ Error in pre-save hook:", error);
    next(error);
  }
});

// Method to add item to cart
cartSchema.methods.addItem = function (product, quantity = 1) {
  const existingItem = this.items.find(
    (item) => item.productId.toString() === product._id.toString()
  );

  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    this.items.push({
      productId: product._id,
      name: product.name,
      price: product.price,
      quantity,
      image: product.images?.[0] || null,
      images: product.images || [],
    });
  }

  return this;
};

// Method to remove item from cart
cartSchema.methods.removeItem = function (productId) {
  this.items = this.items.filter(
    (item) => item.productId.toString() !== productId.toString()
  );

  return this;
};

// Method to update item quantity
cartSchema.methods.updateQuantity = function (productId, quantity) {
  if (quantity <= 0) {
    return this.removeItem(productId);
  }

  const item = this.items.find(
    (item) => item.productId.toString() === productId.toString()
  );

  if (item) {
    item.quantity = quantity;
  }

  return this;
};

// Method to clear cart
cartSchema.methods.clearCart = function () {
  this.items = [];
  return this;
};

// Method to get cart summary
cartSchema.methods.getCartSummary = function () {
  const subtotal = this.totalPrice || 0;
  const shipping = subtotal > 100 ? 0 : 10;
  const tax = subtotal * 0.1;
  const total = subtotal + shipping + tax;

  return {
    items: this.items,
    subtotal: parseFloat(subtotal.toFixed(2)),
    shipping,
    tax: parseFloat(tax.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
    itemCount: this.totalItems || 0,
  };
};

module.exports = mongoose.model("Cart", cartSchema);
