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
    timestamps: true,
  }
);

// Create indexes for better query performance
productSchema.index({ category: 1, price: 1 });
productSchema.index({ name: "text", description: "text" });

// ✅ FIXED: Pre-save hook with proper next() handling
productSchema.pre("save", function (next) {
  try {
    // Trim whitespace from name and description
    if (this.name) this.name = this.name.trim();
    if (this.description) this.description = this.description.trim();

    // ✅ CRITICAL: Always call next() at the end
    next();
  } catch (error) {
    // ✅ Pass errors to next()
    next(error);
  }
});

// ✅ FIXED: Instance methods with proper error handling
productSchema.methods.decreaseStock = async function (quantity) {
  try {
    console.log(`📦 Decreasing stock for ${this.name} by ${quantity}`);

    if (this.stock < quantity) {
      throw new Error(`Insufficient stock for ${this.name}`);
    }

    this.stock -= quantity;
    console.log(`✅ Stock decreased. New stock: ${this.stock}`);

    // ✅ Properly await the save
    const savedProduct = await this.save();
    console.log(`✅ Product saved: ${savedProduct.name}`);

    return savedProduct;
  } catch (error) {
    console.error(`❌ Error decreasing stock: ${error.message}`);
    throw error;
  }
};

productSchema.methods.increaseStock = async function (quantity) {
  try {
    console.log(`📦 Increasing stock for ${this.name} by ${quantity}`);

    this.stock += quantity;
    console.log(`✅ Stock increased. New stock: ${this.stock}`);

    // ✅ Properly await the save
    const savedProduct = await this.save();
    console.log(`✅ Product saved: ${savedProduct.name}`);

    return savedProduct;
  } catch (error) {
    console.error(`❌ Error increasing stock: ${error.message}`);
    throw error;
  }
};

productSchema.methods.isInStock = function (quantity = 1) {
  const hasStock = this.stock >= quantity;
  console.log(
    `🔍 Checking stock for ${this.name}: ${this.stock} >= ${quantity} = ${hasStock}`
  );
  return hasStock;
};

productSchema.methods.deactivate = async function () {
  try {
    this.isActive = false;
    return await this.save();
  } catch (error) {
    console.error(`❌ Error deactivating product: ${error.message}`);
    throw error;
  }
};

productSchema.methods.activate = async function () {
  try {
    this.isActive = true;
    return await this.save();
  } catch (error) {
    console.error(`❌ Error activating product: ${error.message}`);
    throw error;
  }
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
