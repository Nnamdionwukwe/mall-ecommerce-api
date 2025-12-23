// // ========================================
// // PRODUCT API - EXPRESS + MONGODB BACKEND
// // ========================================

// const express = require("express");
// const router = express.Router();
// const mongoose = require("mongoose");

// // ========================================
// // DATABASE SCHEMA
// // ========================================

// const productSchema = new mongoose.Schema(
//   {
//     name: {
//       type: String,
//       required: [true, "Product name is required"],
//       trim: true,
//       maxlength: [200, "Name cannot exceed 200 characters"],
//     },
//     description: {
//       type: String,
//       trim: true,
//       default: "",
//     },
//     price: {
//       type: Number,
//       required: [true, "Price is required"],
//       min: [0, "Price cannot be negative"],
//     },
//     stock: {
//       type: Number,
//       required: [true, "Stock quantity is required"],
//       min: [0, "Stock cannot be negative"],
//       default: 0,
//     },
//     category: {
//       type: String,
//       required: [true, "Category is required"],
//       trim: true,
//     },
//     vendorId: {
//       type: String,
//       required: [true, "Vendor ID is required"],
//       index: true,
//     },
//     vendorName: {
//       type: String,
//       default: "Unknown Vendor",
//     },
//     images: [
//       {
//         type: String,
//       },
//     ],
//     isActive: {
//       type: Boolean,
//       default: true,
//     },
//   },
//   {
//     timestamps: true, // Automatically adds createdAt and updatedAt
//   }
// );

// // Create indexes for better query performance
// productSchema.index({ category: 1, price: 1 });
// productSchema.index({ name: "text", description: "text" }); // For text search

// const Product = mongoose.model("Product", productSchema);

// // ========================================
// // MIDDLEWARE
// // ========================================

// // Validate product data
// const validateProduct = (req, res, next) => {
//   const { name, price, stock, category, vendorId } = req.body;

//   if (!name || name.trim().length === 0) {
//     return res.status(400).json({ error: "Product name is required" });
//   }

//   if (price === undefined || price < 0) {
//     return res.status(400).json({ error: "Valid price is required" });
//   }

//   if (stock !== undefined && stock < 0) {
//     return res.status(400).json({ error: "Stock cannot be negative" });
//   }

//   if (!category || category.trim().length === 0) {
//     return res.status(400).json({ error: "Category is required" });
//   }

//   if (!vendorId) {
//     return res.status(400).json({ error: "Vendor ID is required" });
//   }

//   next();
// };

// // ========================================
// // ROUTES
// // ========================================

// // const { auth, isVendor } = require("../middleware/auth");

// // Only vendors can create products
// // ========================================
// // 5. PROTECT PRODUCT ROUTES (routes/products.js - UPDATE)
// // ========================================
// // Add these imports to your existing products.js file:
// const { auth, isVendor, isAdmin } = require("../middleware/auth");

// // Then protect routes like this:
// // router.post('/', auth, isVendor, validateProduct, async (req, res) => { ... }
// // router.put('/:id', auth, isVendor, validateProduct, async (req, res) => { ... }
// // router.delete('/:id', auth, isAdmin, async (req, res) => { ... }

// // GET /api/products - Get all products with filtering and pagination
// // router.get("/", async (req, res) => {
// //   try {
// //     const {
// //       category,
// //       vendorId,
// //       minPrice,
// //       maxPrice,
// //       search,
// //       isActive,
// //       page = 1,
// //       limit = 10,
// //       sortBy = "createdAt",
// //       order = "desc",
// //     } = req.query;

// //     // Build query
// //     const query = {};

// //     if (category) {
// //       query.category = new RegExp(category, "i");
// //     }

// //     if (vendorId) {
// //       query.vendorId = vendorId;
// //     }

// //     if (minPrice || maxPrice) {
// //       query.price = {};
// //       if (minPrice) query.price.$gte = parseFloat(minPrice);
// //       if (maxPrice) query.price.$lte = parseFloat(maxPrice);
// //     }

// //     if (search) {
// //       query.$text = { $search: search };
// //     }

// //     if (isActive !== undefined) {
// //       query.isActive = isActive === "true";
// //     }

// //     // Pagination
// //     const pageNum = parseInt(page);
// //     const limitNum = parseInt(limit);
// //     const skip = (pageNum - 1) * limitNum;

// //     // Sort
// //     const sortOrder = order === "asc" ? 1 : -1;
// //     const sortObj = { [sortBy]: sortOrder };

// //     // Execute query
// //     const [products, total] = await Promise.all([
// //       Product.find(query).sort(sortObj).skip(skip).lean(),
// //       Product.countDocuments(query),
// //     ]);

// //     res.json({
// //       success: true,
// //       data: products,
// //       pagination: {
// //         page: pageNum,
// //         limit: limitNum,
// //         total,
// //         totalPages: Math.ceil(total / limitNum),
// //       },
// //     });
// //   } catch (error) {
// //     console.error("Error fetching products:", error);
// //     res.status(500).json({ error: "Server error", message: error.message });
// //   }
// // });

// // GET /api/products - Get all products with filtering and pagination
// router.get("/", async (req, res) => {
//   try {
//     const {
//       category,
//       vendorId,
//       minPrice,
//       maxPrice,
//       search,
//       isActive,
//       page = 1,
//       limit = 1000000,
//       sortBy = "createdAt",
//       order = "desc",
//     } = req.query;

//     // Build query
//     const query = {};
//     if (category) {
//       query.category = new RegExp(category, "i");
//     }
//     if (vendorId) {
//       query.vendorId = vendorId;
//     }
//     if (minPrice || maxPrice) {
//       query.price = {};
//       if (minPrice) query.price.$gte = parseFloat(minPrice);
//       if (maxPrice) query.price.$lte = parseFloat(maxPrice);
//     }
//     if (search) {
//       query.$text = { $search: search };
//     }
//     if (isActive !== undefined) {
//       query.isActive = isActive === "true";
//     }

//     // Pagination
//     const pageNum = parseInt(page);
//     const limitNum = parseInt(limit);
//     const skip = (pageNum - 1) * limitNum;

//     // Sort
//     const sortOrder = order === "asc" ? 1 : -1;
//     const sortObj = { [sortBy]: sortOrder };

//     // Execute query with limit and skip
//     const [products, total] = await Promise.all([
//       Product.find(query)
//         .sort(sortObj)
//         .skip(skip)
//         .limit(limitNum) // ADD THIS LINE
//         .lean(),
//       Product.countDocuments(query),
//     ]);

//     res.json({
//       success: true,
//       data: products,
//       pagination: {
//         page: pageNum,
//         limit: limitNum,
//         total,
//         totalPages: Math.ceil(total / limitNum),
//       },
//     });
//   } catch (error) {
//     console.error("Error fetching products:", error);
//     res.status(500).json({ error: "Server error", message: error.message });
//   }
// });

// // GET /api/products/:id - Get single product
// router.get("/:id", async (req, res) => {
//   try {
//     const product = await Product.findById(req.params.id);

//     if (!product) {
//       return res.status(404).json({ error: "Product not found" });
//     }

//     res.json({
//       success: true,
//       data: product,
//     });
//   } catch (error) {
//     if (error.kind === "ObjectId") {
//       return res.status(400).json({ error: "Invalid product ID" });
//     }
//     console.error("Error fetching product:", error);
//     res.status(500).json({ error: "Server error", message: error.message });
//   }
// });

// // POST /api/products - Create new product
// router.post("/", validateProduct, async (req, res) => {
//   try {
//     const {
//       name,
//       description,
//       price,
//       stock,
//       category,
//       vendorId,
//       vendorName,
//       images,
//     } = req.body;

//     const product = new Product({
//       name,
//       description,
//       price,
//       stock,
//       category,
//       vendorId,
//       vendorName,
//       images,
//     });

//     await product.save();

//     res.status(201).json({
//       success: true,
//       message: "Product created successfully",
//       data: product,
//     });
//   } catch (error) {
//     if (error.name === "ValidationError") {
//       return res.status(400).json({
//         error: "Validation error",
//         details: error.errors,
//       });
//     }
//     console.error("Error creating product:", error);
//     res.status(500).json({ error: "Server error", message: error.message });
//   }
// });

// // PUT /api/products/:id - Update product
// router.put("/:id", validateProduct, async (req, res) => {
//   try {
//     const { name, description, price, stock, category, images, isActive } =
//       req.body;

//     const product = await Product.findByIdAndUpdate(
//       req.params.id,
//       {
//         name,
//         description,
//         price,
//         stock,
//         category,
//         images,
//         isActive,
//       },
//       {
//         new: true, // Return updated document
//         runValidators: true, // Run schema validators
//       }
//     );

//     if (!product) {
//       return res.status(404).json({ error: "Product not found" });
//     }

//     res.json({
//       success: true,
//       message: "Product updated successfully",
//       data: product,
//     });
//   } catch (error) {
//     if (error.kind === "ObjectId") {
//       return res.status(400).json({ error: "Invalid product ID" });
//     }
//     if (error.name === "ValidationError") {
//       return res.status(400).json({
//         error: "Validation error",
//         details: error.errors,
//       });
//     }
//     console.error("Error updating product:", error);
//     res.status(500).json({ error: "Server error", message: error.message });
//   }
// });

// // PATCH /api/products/:id/stock - Update stock only
// router.patch("/:id/stock", async (req, res) => {
//   try {
//     const { stock, operation } = req.body;

//     if (stock === undefined || stock < 0) {
//       return res
//         .status(400)
//         .json({ error: "Valid stock quantity is required" });
//     }

//     let updateQuery;
//     if (operation === "increment") {
//       updateQuery = { $inc: { stock: parseInt(stock) } };
//     } else if (operation === "decrement") {
//       updateQuery = { $inc: { stock: -parseInt(stock) } };
//     } else {
//       updateQuery = { stock: parseInt(stock) };
//     }

//     const product = await Product.findByIdAndUpdate(
//       req.params.id,
//       updateQuery,
//       { new: true, runValidators: true }
//     );

//     if (!product) {
//       return res.status(404).json({ error: "Product not found" });
//     }

//     res.json({
//       success: true,
//       message: "Stock updated successfully",
//       data: product,
//     });
//   } catch (error) {
//     if (error.kind === "ObjectId") {
//       return res.status(400).json({ error: "Invalid product ID" });
//     }
//     console.error("Error updating stock:", error);
//     res.status(500).json({ error: "Server error", message: error.message });
//   }
// });

// // DELETE /api/products/:id - Delete product (soft delete)
// router.delete("/:id", async (req, res) => {
//   try {
//     const { permanent } = req.query;

//     let product;
//     if (permanent === "true") {
//       // Hard delete
//       product = await Product.findByIdAndDelete(req.params.id);
//     } else {
//       // Soft delete
//       product = await Product.findByIdAndUpdate(
//         req.params.id,
//         { isActive: false },
//         { new: true }
//       );
//     }

//     if (!product) {
//       return res.status(404).json({ error: "Product not found" });
//     }

//     res.json({
//       success: true,
//       message:
//         permanent === "true"
//           ? "Product permanently deleted"
//           : "Product deactivated",
//       data: product,
//     });
//   } catch (error) {
//     if (error.kind === "ObjectId") {
//       return res.status(400).json({ error: "Invalid product ID" });
//     }
//     console.error("Error deleting product:", error);
//     res.status(500).json({ error: "Server error", message: error.message });
//   }
// });

// // GET /api/products/vendor/:vendorId - Get all products by vendor
// router.get("/vendor/:vendorId", async (req, res) => {
//   try {
//     const products = await Product.find({
//       vendorId: req.params.vendorId,
//       isActive: true,
//     }).sort({ createdAt: -1 });

//     res.json({
//       success: true,
//       data: products,
//       count: products.length,
//     });
//   } catch (error) {
//     console.error("Error fetching vendor products:", error);
//     res.status(500).json({ error: "Server error", message: error.message });
//   }
// });

// // ========================================
// // EXPORT
// // ========================================

// module.exports = router;

const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const { auth, isVendor, isAdmin } = require("../middleware/auth");

// ========================================
// MIDDLEWARE
// ========================================

// Validate product data
const validateProduct = (req, res, next) => {
  const { name, price, stock, category, vendorId } = req.body;

  if (!name || name.trim().length === 0) {
    return res.status(400).json({ error: "Product name is required" });
  }

  if (price === undefined || price < 0) {
    return res.status(400).json({ error: "Valid price is required" });
  }

  if (stock !== undefined && stock < 0) {
    return res.status(400).json({ error: "Stock cannot be negative" });
  }

  if (!category || category.trim().length === 0) {
    return res.status(400).json({ error: "Category is required" });
  }

  if (!vendorId) {
    return res.status(400).json({ error: "Vendor ID is required" });
  }

  next();
};

// ========================================
// ROUTES
// ========================================

// GET /api/products - Get all products with filtering and pagination
router.get("/", async (req, res) => {
  try {
    const {
      category,
      vendorId,
      minPrice,
      maxPrice,
      search,
      isActive,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      order = "desc",
    } = req.query;

    // Build query
    const query = {};

    if (category) {
      query.category = new RegExp(category, "i");
    }

    if (vendorId) {
      query.vendorId = vendorId;
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    if (search) {
      query.$text = { $search: search };
    }

    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Sort
    const sortOrder = order === "asc" ? 1 : -1;
    const sortObj = { [sortBy]: sortOrder };

    // Execute query with limit and skip
    const [products, total] = await Promise.all([
      Product.find(query).sort(sortObj).skip(skip).limit(limitNum).lean(),
      Product.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Server error", message: error.message });
  }
});

// GET /api/products/:id - Get single product
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    if (error.kind === "ObjectId") {
      return res.status(400).json({ error: "Invalid product ID" });
    }
    console.error("Error fetching product:", error);
    res.status(500).json({ error: "Server error", message: error.message });
  }
});

// POST /api/products - Create new product (vendor/admin only)
router.post("/", auth, isVendor, validateProduct, async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      stock,
      category,
      vendorId,
      vendorName,
      images,
    } = req.body;

    // Verify vendor is creating their own product
    if (vendorId !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({
        error: "Not authorized to create product for this vendor",
      });
    }

    const product = new Product({
      name,
      description,
      price,
      stock,
      category,
      vendorId,
      vendorName: vendorName || req.user.name,
      images: images || [],
    });

    await product.save();

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        error: "Validation error",
        details: error.errors,
      });
    }
    console.error("Error creating product:", error);
    res.status(500).json({ error: "Server error", message: error.message });
  }
});

// PUT /api/products/:id - Update product (vendor/admin only)
router.put("/:id", auth, isVendor, validateProduct, async (req, res) => {
  try {
    const { name, description, price, stock, category, images, isActive } =
      req.body;

    // Get product to check ownership
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Verify vendor owns the product or is admin
    if (product.vendorId !== req.user.id && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Not authorized to update this product" });
    }

    // Update product
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      {
        name,
        description,
        price,
        stock,
        category,
        images,
        isActive,
      },
      {
        new: true, // Return updated document
        runValidators: true, // Run schema validators
      }
    );

    res.json({
      success: true,
      message: "Product updated successfully",
      data: updatedProduct,
    });
  } catch (error) {
    if (error.kind === "ObjectId") {
      return res.status(400).json({ error: "Invalid product ID" });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({
        error: "Validation error",
        details: error.errors,
      });
    }
    console.error("Error updating product:", error);
    res.status(500).json({ error: "Server error", message: error.message });
  }
});

// PATCH /api/products/:id/stock - Update stock only
router.patch("/:id/stock", async (req, res) => {
  try {
    const { stock, operation } = req.body;

    if (stock === undefined || stock < 0) {
      return res
        .status(400)
        .json({ error: "Valid stock quantity is required" });
    }

    let updateQuery;
    if (operation === "increment") {
      updateQuery = { $inc: { stock: parseInt(stock) } };
    } else if (operation === "decrement") {
      updateQuery = { $inc: { stock: -parseInt(stock) } };
    } else {
      updateQuery = { stock: parseInt(stock) };
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      updateQuery,
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json({
      success: true,
      message: "Stock updated successfully",
      data: product,
    });
  } catch (error) {
    if (error.kind === "ObjectId") {
      return res.status(400).json({ error: "Invalid product ID" });
    }
    console.error("Error updating stock:", error);
    res.status(500).json({ error: "Server error", message: error.message });
  }
});

// DELETE /api/products/:id - Delete product (soft delete by default)
router.delete("/:id", auth, isAdmin, async (req, res) => {
  try {
    const { permanent } = req.query;

    let product;
    if (permanent === "true") {
      // Hard delete - only admins
      product = await Product.findByIdAndDelete(req.params.id);
    } else {
      // Soft delete - deactivate
      product = await Product.findById(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      await product.deactivate();
    }

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json({
      success: true,
      message:
        permanent === "true"
          ? "Product permanently deleted"
          : "Product deactivated",
      data: product,
    });
  } catch (error) {
    if (error.kind === "ObjectId") {
      return res.status(400).json({ error: "Invalid product ID" });
    }
    console.error("Error deleting product:", error);
    res.status(500).json({ error: "Server error", message: error.message });
  }
});

// GET /api/products/vendor/:vendorId - Get all products by vendor
router.get("/vendor/:vendorId", async (req, res) => {
  try {
    const products = await Product.findByVendor(req.params.vendorId);

    res.json({
      success: true,
      data: products,
      count: products.length,
    });
  } catch (error) {
    console.error("Error fetching vendor products:", error);
    res.status(500).json({ error: "Server error", message: error.message });
  }
});

// GET /api/products/search - Search products by name/description
router.get("/search/:searchTerm", async (req, res) => {
  try {
    const products = await Product.searchProducts(req.params.searchTerm);

    res.json({
      success: true,
      data: products,
      count: products.length,
    });
  } catch (error) {
    console.error("Error searching products:", error);
    res.status(500).json({ error: "Server error", message: error.message });
  }
});

// GET /api/products/category/:category - Get products by category
router.get("/category/:category", async (req, res) => {
  try {
    const products = await Product.findByCategory(req.params.category);

    res.json({
      success: true,
      data: products,
      count: products.length,
    });
  } catch (error) {
    console.error("Error fetching category products:", error);
    res.status(500).json({ error: "Server error", message: error.message });
  }
});

// GET /api/products/price-range - Get products by price range
router.get("/price/:minPrice/:maxPrice", async (req, res) => {
  try {
    const { minPrice, maxPrice } = req.params;

    if (isNaN(minPrice) || isNaN(maxPrice) || minPrice < 0 || maxPrice < 0) {
      return res.status(400).json({ error: "Invalid price range" });
    }

    const products = await Product.findByPriceRange(
      parseFloat(minPrice),
      parseFloat(maxPrice)
    );

    res.json({
      success: true,
      data: products,
      count: products.length,
    });
  } catch (error) {
    console.error("Error fetching products by price range:", error);
    res.status(500).json({ error: "Server error", message: error.message });
  }
});

// ========================================
// EXPORT
// ========================================

module.exports = router;
