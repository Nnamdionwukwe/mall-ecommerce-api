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

// ================================================
// PRE-SAVE HOOK - SIMPLE AND CLEAN
// ================================================

productSchema.pre("save", function (next) {
  // Trim whitespace from name and description
  if (this.name) {
    this.name = this.name.trim();
  }
  if (this.description) {
    this.description = this.description.trim();
  }

  // Call next() to continue
  next();
});

// ================================================
// INSTANCE METHODS
// ================================================

// Decrease stock (used when order is created)
productSchema.methods.decreaseStock = async function (quantity) {
  try {
    console.log(
      `\n📦 [decreaseStock] Decreasing stock for ${this.name} by ${quantity}`
    );
    console.log(`   Current stock: ${this.stock}`);

    if (this.stock < quantity) {
      const error = new Error(
        `Insufficient stock for ${this.name}. Available: ${this.stock}, Requested: ${quantity}`
      );
      console.error(`❌ [decreaseStock] ${error.message}`);
      throw error;
    }

    this.stock -= quantity;
    console.log(`   New stock: ${this.stock}`);

    // ✅ Save and await
    console.log(`   Saving product...`);
    const savedProduct = await this.save();
    console.log(
      `✅ [decreaseStock] Stock decreased successfully for ${savedProduct.name}`
    );

    return savedProduct;
  } catch (error) {
    console.error(
      `❌ [decreaseStock] Error for ${this.name}: ${error.message}`
    );
    throw error;
  }
};

// Increase stock (used when order is cancelled)
productSchema.methods.increaseStock = async function (quantity) {
  try {
    console.log(
      `\n📦 [increaseStock] Increasing stock for ${this.name} by ${quantity}`
    );
    console.log(`   Current stock: ${this.stock}`);

    this.stock += quantity;
    console.log(`   New stock: ${this.stock}`);

    // ✅ Save and await
    console.log(`   Saving product...`);
    const savedProduct = await this.save();
    console.log(
      `✅ [increaseStock] Stock increased successfully for ${savedProduct.name}`
    );

    return savedProduct;
  } catch (error) {
    console.error(
      `❌ [increaseStock] Error for ${this.name}: ${error.message}`
    );
    throw error;
  }
};

// Check if product has enough stock
productSchema.methods.isInStock = function (quantity = 1) {
  const hasStock = this.stock >= quantity;
  console.log(
    `🔍 [isInStock] ${this.name}: ${this.stock} >= ${quantity} = ${hasStock}`
  );
  return hasStock;
};

// Deactivate product
productSchema.methods.deactivate = async function () {
  try {
    console.log(`🔄 [deactivate] Deactivating ${this.name}`);
    this.isActive = false;
    const saved = await this.save();
    console.log(`✅ [deactivate] Product deactivated: ${saved.name}`);
    return saved;
  } catch (error) {
    console.error(`❌ [deactivate] Error: ${error.message}`);
    throw error;
  }
};

// Activate product
productSchema.methods.activate = async function () {
  try {
    console.log(`🔄 [activate] Activating ${this.name}`);
    this.isActive = true;
    const saved = await this.save();
    console.log(`✅ [activate] Product activated: ${saved.name}`);
    return saved;
  } catch (error) {
    console.error(`❌ [activate] Error: ${error.message}`);
    throw error;
  }
};

// ================================================
// STATIC METHODS
// ================================================

// Find products by vendor
productSchema.statics.findByVendor = function (vendorId) {
  console.log(`🔍 [findByVendor] Finding products for vendor: ${vendorId}`);
  return this.find({ vendorId, isActive: true }).sort({ createdAt: -1 });
};

// Find products by category
productSchema.statics.findByCategory = function (category) {
  console.log(`🔍 [findByCategory] Finding products in category: ${category}`);
  return this.find({
    category: new RegExp(category, "i"),
    isActive: true,
  }).sort({ createdAt: -1 });
};

// Search products by text
productSchema.statics.searchProducts = function (searchTerm) {
  console.log(`🔍 [searchProducts] Searching for: ${searchTerm}`);
  return this.find(
    { $text: { $search: searchTerm }, isActive: true },
    { score: { $meta: "textScore" } }
  ).sort({ score: { $meta: "textScore" } });
};

// Find products by price range
productSchema.statics.findByPriceRange = function (minPrice, maxPrice) {
  console.log(
    `🔍 [findByPriceRange] Finding products between $${minPrice} and $${maxPrice}`
  );
  return this.find({
    price: { $gte: minPrice, $lte: maxPrice },
    isActive: true,
  }).sort({ price: 1 });
};

// ================================================
// CREATE AND EXPORT MODEL
// ================================================

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
