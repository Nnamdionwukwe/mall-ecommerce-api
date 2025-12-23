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

// Calculate totals before saving
cartSchema.pre("save", function (next) {
  this.totalItems = this.items.reduce((sum, item) => sum + item.quantity, 0);
  this.totalPrice = this.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  next();
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
  return this.save();
};

// Method to remove item from cart
cartSchema.methods.removeItem = function (productId) {
  this.items = this.items.filter(
    (item) => item.productId.toString() !== productId.toString()
  );
  return this.save();
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
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to clear cart
cartSchema.methods.clearCart = function () {
  this.items = [];
  return this.save();
};

// Method to get cart summary
cartSchema.methods.getCartSummary = function () {
  const subtotal = this.totalPrice;
  const shipping = subtotal > 100 ? 0 : 10;
  const tax = subtotal * 0.1;
  const total = subtotal + shipping + tax;

  return {
    items: this.items,
    subtotal,
    shipping,
    tax,
    total,
    itemCount: this.totalItems,
  };
};

module.exports = mongoose.model("Cart", cartSchema);
