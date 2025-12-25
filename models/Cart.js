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

// Calculate totals manually
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

// Add item to cart - ONLY adds if not exists, updates quantity if exists
cartSchema.methods.addItem = function (product, quantity = 1) {
  const productIdStr = product._id.toString();
  console.log(
    `[addItem] Adding product ID: ${productIdStr}, Name: ${product.name}, Qty: ${quantity}`
  );

  // Search for existing item
  let found = false;
  for (let i = 0; i < this.items.length; i++) {
    const itemProductIdStr = this.items[i].productId.toString();
    console.log(`[addItem] Comparing: ${itemProductIdStr} vs ${productIdStr}`);

    if (itemProductIdStr === productIdStr) {
      console.log(
        `[addItem] ✅ FOUND! Updating quantity from ${
          this.items[i].quantity
        } to ${this.items[i].quantity + quantity}`
      );
      this.items[i].quantity += quantity;
      found = true;
      break;
    }
  }

  // Only add new item if NOT found
  if (!found) {
    console.log(`[addItem] ➕ Not found, adding new item`);
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

// Remove item from cart
cartSchema.methods.removeItem = function (productId) {
  const productIdStr = productId.toString();
  console.log(`[removeItem] Removing product ID: ${productIdStr}`);

  const initialLength = this.items.length;
  this.items = this.items.filter((item) => {
    const itemProductIdStr = item.productId.toString();
    return itemProductIdStr !== productIdStr;
  });

  console.log(
    `[removeItem] Items before: ${initialLength}, Items after: ${this.items.length}`
  );
  return this;
};

// Update item quantity - ONLY updates existing items
cartSchema.methods.updateQuantity = function (productId, newQuantity) {
  const productIdStr = productId.toString();
  console.log(
    `[updateQuantity] Updating product ID: ${productIdStr}, New quantity: ${newQuantity}`
  );

  if (newQuantity <= 0) {
    console.log(`[updateQuantity] Quantity <= 0, removing item`);
    return this.removeItem(productId);
  }

  let found = false;
  for (let i = 0; i < this.items.length; i++) {
    const itemProductIdStr = this.items[i].productId.toString();
    console.log(
      `[updateQuantity] Comparing: ${itemProductIdStr} vs ${productIdStr}`
    );

    if (itemProductIdStr === productIdStr) {
      console.log(
        `[updateQuantity] ✅ FOUND! Updating quantity from ${this.items[i].quantity} to ${newQuantity}`
      );
      this.items[i].quantity = newQuantity;
      found = true;
      break;
    }
  }

  if (!found) {
    console.warn(
      `[updateQuantity] ⚠️ Product not found in cart: ${productIdStr}`
    );
  }

  return this;
};

// Clear cart
cartSchema.methods.clearCart = function () {
  console.log(`[clearCart] Clearing all ${this.items.length} items`);
  this.items = [];
  return this;
};

// Get cart summary
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
