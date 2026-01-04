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

// Create indexes
productSchema.index({ category: 1, price: 1 });
productSchema.index({ name: "text", description: "text" });

// ================================================
// INSTANCE METHODS
// ================================================

productSchema.methods.decreaseStock = async function (quantity) {
  try {
    console.log(`📦 [decreaseStock] Decreasing ${this.name} by ${quantity}`);
    console.log(`   Current stock: ${this.stock}`);

    if (this.stock < quantity) {
      throw new Error(
        `Insufficient stock for ${this.name}. Available: ${this.stock}, Requested: ${quantity}`
      );
    }

    this.stock -= quantity;
    console.log(`   New stock: ${this.stock}`);

    const saved = await this.save();
    console.log(`✅ [decreaseStock] Saved successfully`);
    return saved;
  } catch (error) {
    console.error(`❌ [decreaseStock] Error: ${error.message}`);
    throw error;
  }
};

productSchema.methods.increaseStock = async function (quantity) {
  try {
    console.log(`📦 [increaseStock] Increasing ${this.name} by ${quantity}`);
    console.log(`   Current stock: ${this.stock}`);

    this.stock += quantity;
    console.log(`   New stock: ${this.stock}`);

    const saved = await this.save();
    console.log(`✅ [increaseStock] Saved successfully`);
    return saved;
  } catch (error) {
    console.error(`❌ [increaseStock] Error: ${error.message}`);
    throw error;
  }
};

productSchema.methods.isInStock = function (quantity = 1) {
  const inStock = this.stock >= quantity;
  console.log(
    `🔍 [isInStock] ${this.name}: ${this.stock} >= ${quantity} = ${inStock}`
  );
  return inStock;
};

productSchema.methods.deactivate = async function () {
  try {
    this.isActive = false;
    return await this.save();
  } catch (error) {
    console.error(`❌ [deactivate] Error: ${error.message}`);
    throw error;
  }
};

productSchema.methods.activate = async function () {
  try {
    this.isActive = true;
    return await this.save();
  } catch (error) {
    console.error(`❌ [activate] Error: ${error.message}`);
    throw error;
  }
};

// ================================================
// STATIC METHODS
// ================================================

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

// ================================================
// INSTANCE METHODS - FIXED
// ================================================

productSchema.methods.decreaseStock = async function (quantity) {
  try {
    console.log(`📦 [decreaseStock] Decreasing ${this.name} by ${quantity}`);
    console.log(`   Current stock: ${this.stock}`);

    if (this.stock < quantity) {
      throw new Error(
        `Insufficient stock for ${this.name}. Available: ${this.stock}, Requested: ${quantity}`
      );
    }

    // ✅ FIXED: Use updateOne instead of this.save()
    const result = await mongoose
      .model("Product")
      .updateOne(
        { _id: this._id },
        { $inc: { stock: -quantity }, updatedAt: new Date() }
      );

    console.log(`   New stock: ${this.stock - quantity}`);
    console.log(`✅ [decreaseStock] Updated successfully`);
    return result;
  } catch (error) {
    console.error(`❌ [decreaseStock] Error: ${error.message}`);
    throw error;
  }
};

productSchema.methods.increaseStock = async function (quantity) {
  try {
    console.log(`📦 [increaseStock] Increasing ${this.name} by ${quantity}`);
    console.log(`   Current stock: ${this.stock}`);

    // ✅ FIXED: Use updateOne instead of this.save()
    const result = await mongoose
      .model("Product")
      .updateOne(
        { _id: this._id },
        { $inc: { stock: quantity }, updatedAt: new Date() }
      );

    console.log(`   New stock: ${this.stock + quantity}`);
    console.log(`✅ [increaseStock] Updated successfully`);
    return result;
  } catch (error) {
    console.error(`❌ [increaseStock] Error: ${error.message}`);
    throw error;
  }
};

productSchema.methods.isInStock = function (quantity = 1) {
  const inStock = this.stock >= quantity;
  console.log(
    `🔍 [isInStock] ${this.name}: ${this.stock} >= ${quantity} = ${inStock}`
  );
  return inStock;
};

productSchema.methods.deactivate = async function () {
  try {
    return await mongoose
      .model("Product")
      .updateOne({ _id: this._id }, { isActive: false, updatedAt: new Date() });
  } catch (error) {
    console.error(`❌ [deactivate] Error: ${error.message}`);
    throw error;
  }
};

productSchema.methods.activate = async function () {
  try {
    return await mongoose
      .model("Product")
      .updateOne({ _id: this._id }, { isActive: true, updatedAt: new Date() });
  } catch (error) {
    console.error(`❌ [activate] Error: ${error.message}`);
    throw error;
  }
};

// ================================================
// CREATE MODEL
// ================================================

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
