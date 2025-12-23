const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      maxlength: [200, "Name cannot exceed 200 characters"],
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    stock: {
      type: Number,
      required: [true, "Stock quantity is required"],
      min: [0, "Stock cannot be negative"],
      default: 0,
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
    },
    vendorId: {
      type: String,
      required: [true, "Vendor ID is required"],
      index: true,
    },
    vendorName: {
      type: String,
      default: "Unknown Vendor",
    },
    images: [
      {
        type: String,
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

// Create indexes for better query performance
productSchema.index({ category: 1, price: 1 });
productSchema.index({ name: "text", description: "text" }); // For text search

// Pre-save hook for validation
productSchema.pre("save", function (next) {
  // Trim whitespace from name and description
  if (this.name) this.name = this.name.trim();
  if (this.description) this.description = this.description.trim();
  next();
});

// Instance methods
productSchema.methods.decreaseStock = function (quantity) {
  if (this.stock < quantity) {
    throw new Error("Insufficient stock");
  }
  this.stock -= quantity;
  return this.save();
};

productSchema.methods.increaseStock = function (quantity) {
  this.stock += quantity;
  return this.save();
};

productSchema.methods.isInStock = function (quantity = 1) {
  return this.stock >= quantity;
};

productSchema.methods.deactivate = function () {
  this.isActive = false;
  return this.save();
};

productSchema.methods.activate = function () {
  this.isActive = true;
  return this.save();
};

// Static methods
productSchema.statics.findByVendor = function (vendorId) {
  return this.find({ vendorId, isActive: true }).sort({ createdAt: -1 });
};

productSchema.statics.findByCategory = function (category) {
  return this.find({
    category: new RegExp(category, "i"),
    isActive: true,
  }).sort({ createdAt: -1 });
};

productSchema.statics.searchProducts = function (searchTerm) {
  return this.find(
    { $text: { $search: searchTerm }, isActive: true },
    { score: { $meta: "textScore" } }
  ).sort({ score: { $meta: "textScore" } });
};

productSchema.statics.findByPriceRange = function (minPrice, maxPrice) {
  return this.find({
    price: { $gte: minPrice, $lte: maxPrice },
    isActive: true,
  }).sort({ price: 1 });
};

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
