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

// ✅ NO PRE-SAVE HOOK - Calculate totals manually with a method
cartSchema.methods.calculateTotals = function () {
  this.totalItems = this.items.reduce(
    (sum, item) => sum + (item.quantity || 0),
    0
  );
  this.totalPrice = this.items.reduce(
    (sum, item) => sum + (item.price || 0) * (item.quantity || 0),
    0
  );
  return this;
};

// Method to add item to cart - ONLY add if not exists, otherwise increase quantity
cartSchema.methods.addItem = function (product, quantity = 1) {
  console.log(
    `[addItem] Adding product: ${product.name} (ID: ${product._id}), Quantity: ${quantity}`
  );

  let existingItem = null;

  // Find existing item by comparing string IDs
  this.items.forEach((item) => {
    const itemProductId = item.productId.toString();
    const compareProductId = product._id.toString();

    if (itemProductId === compareProductId) {
      existingItem = item;
    }
  });

  if (existingItem) {
    console.log(
      `[addItem] ✅ Item already exists. Old quantity: ${existingItem.quantity}, Adding: ${quantity}`
    );
    existingItem.quantity += quantity;
  } else {
    console.log(`[addItem] ➕ Item doesn't exist, creating new entry`);
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

// Method to update item quantity - ONLY update, never add new items
cartSchema.methods.updateQuantity = function (productId, quantity) {
  console.log(
    `[updateQuantity] Looking for product: ${productId}, Setting quantity to: ${quantity}`
  );

  if (quantity <= 0) {
    return this.removeItem(productId);
  }

  // Find the item by comparing string versions of IDs
  let found = false;
  this.items.forEach((item) => {
    const itemProductId = item.productId.toString();
    const compareProductId = productId.toString();

    console.log(
      `[updateQuantity] Comparing: ${itemProductId} === ${compareProductId}`
    );

    if (itemProductId === compareProductId) {
      console.log(
        `[updateQuantity] ✅ Found item! Old quantity: ${item.quantity}, New quantity: ${quantity}`
      );
      item.quantity = quantity;
      found = true;
    }
  });

  if (!found) {
    console.warn(`[updateQuantity] ⚠️ Product not found in cart: ${productId}`);
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
