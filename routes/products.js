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
      limit = 1000000,
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

// router.post("/", auth, isVendor, validateProduct, async (req, res) => {
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

//     // Verify vendor is creating their own product (admins can create for any vendor)
//     if (vendorId !== req.user.id && req.user.role !== "admin") {
//       return res.status(403).json({
//         error: "Not authorized to create product for this vendor",
//       });
//     }

//     const product = new Product({
//       name,
//       description,
//       price,
//       stock,
//       category,
//       vendorId,
//       vendorName: vendorName || req.user.name,
//       images: images || [],
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

// POST /api/products - Create new product (both vendor and admin)
router.post("/", auth, isVendor, validateProduct, async (req, res) => {
  try {
    console.log("➕ CREATE PRODUCT - User:", req.user.role);

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

    // ✅ Both admin and vendor can create products
    // Vendors can only create for themselves, admins can create for anyone
    if (req.user.role === "vendor" && vendorId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: "Vendors can only create products for themselves",
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

    console.log("✅ Product created:", product._id);

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  } catch (error) {
    console.error("❌ Error creating product:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: error.errors,
      });
    }
    res.status(500).json({
      success: false,
      error: "Server error",
      message: error.message,
    });
  }
});

// PUT /api/products/:id - Update product (vendor and admin have full control)
router.put("/:id", auth, isVendor, validateProduct, async (req, res) => {
  try {
    const { name, description, price, stock, category, images, isActive } =
      req.body;

    // Get product to check if it exists
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // ✅ UPDATED: Both admin and vendor can edit any product
    // No ownership check needed - isVendor middleware ensures user is vendor or admin

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

// DELETE /api/products/:id - Delete product (both admin and vendor have full control)
// router.delete("/:id", auth, isVendor, async (req, res) => {
//   try {
//     const { permanent } = req.query;

//     // Get product to check if it exists
//     const product = await Product.findById(req.params.id);
//     if (!product) {
//       return res.status(404).json({ error: "Product not found" });
//     }

//     // ✅ UPDATED: Both admin and vendor can delete any product
//     // No ownership check needed - isVendor middleware ensures user is vendor or admin

//     let deletedProduct;
//     if (permanent === "true") {
//       // Hard delete - both admins and vendors can do this
//       deletedProduct = await Product.findByIdAndDelete(req.params.id);
//     } else {
//       // Soft delete - deactivate (vendors and admins)
//       await product.deactivate();
//       deletedProduct = product;
//     }

//     res.json({
//       success: true,
//       message:
//         permanent === "true"
//           ? "Product permanently deleted"
//           : "Product deactivated",
//       data: deletedProduct,
//     });
//   } catch (error) {
//     if (error.kind === "ObjectId") {
//       return res.status(400).json({ error: "Invalid product ID" });
//     }
//     console.error("Error deleting product:", error);
//     res.status(500).json({ error: "Server error", message: error.message });
//   }
// });

// DELETE /api/products/:id - Delete product (HARD DELETE BY DEFAULT)
router.delete("/:id", auth, isVendor, async (req, res) => {
  try {
    console.log("🗑️ DELETE - Product ID:", req.params.id);

    const { soft } = req.query; // ?soft=true for soft delete

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: "Product not found",
      });
    }

    let deletedProduct;

    if (soft === "true") {
      // Soft delete - deactivate
      product.isActive = false;
      await product.save();
      deletedProduct = product;
      console.log("✅ Product deactivated");
    } else {
      // HARD DELETE - Actually remove from MongoDB (DEFAULT)
      deletedProduct = await Product.findByIdAndDelete(req.params.id);
      console.log("✅ Product DELETED from database");
    }

    res.json({
      success: true,
      message:
        soft === "true" ? "Product deactivated" : "Product permanently deleted",
      data: deletedProduct,
    });
  } catch (error) {
    console.error("❌ Delete error:", error);
    if (error.kind === "ObjectId") {
      return res.status(400).json({
        success: false,
        error: "Invalid product ID",
      });
    }
    res.status(500).json({
      success: false,
      error: "Server error",
      message: error.message,
    });
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

// const express = require("express");
// const router = express.Router();
// const Product = require("../models/Product");
// const { auth, isVendor, isAdmin } = require("../middleware/auth");

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
//       Product.find(query).sort(sortObj).skip(skip).limit(limitNum).lean(),
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

// // POST /api/products - Create new product (vendor/admin only)
// router.post("/", auth, isVendor, validateProduct, async (req, res) => {
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

//     // Verify vendor is creating their own product
//     if (vendorId !== req.user.id && req.user.role !== "admin") {
//       return res.status(403).json({
//         error: "Not authorized to create product for this vendor",
//       });
//     }

//     const product = new Product({
//       name,
//       description,
//       price,
//       stock,
//       category,
//       vendorId,
//       vendorName: vendorName || req.user.name,
//       images: images || [],
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

// // PUT /api/products/:id - Update product (vendor/admin only)
// router.put("/:id", auth, isVendor, validateProduct, async (req, res) => {
//   try {
//     const { name, description, price, stock, category, images, isActive } =
//       req.body;

//     // Get product to check ownership
//     const product = await Product.findById(req.params.id);
//     if (!product) {
//       return res.status(404).json({ error: "Product not found" });
//     }

//     // Verify vendor owns the product or is admin
//     if (product.vendorId !== req.user.id && req.user.role !== "admin") {
//       return res
//         .status(403)
//         .json({ error: "Not authorized to update this product" });
//     }

//     // Update product
//     const updatedProduct = await Product.findByIdAndUpdate(
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

//     res.json({
//       success: true,
//       message: "Product updated successfully",
//       data: updatedProduct,
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

// // DELETE /api/products/:id - Delete product (soft delete by default)
// router.delete("/:id", auth, isAdmin, async (req, res) => {
//   try {
//     const { permanent } = req.query;

//     let product;
//     if (permanent === "true") {
//       // Hard delete - only admins
//       product = await Product.findByIdAndDelete(req.params.id);
//     } else {
//       // Soft delete - deactivate
//       product = await Product.findById(req.params.id);
//       if (!product) {
//         return res.status(404).json({ error: "Product not found" });
//       }
//       await product.deactivate();
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
//     const products = await Product.findByVendor(req.params.vendorId);

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

// // GET /api/products/search - Search products by name/description
// router.get("/search/:searchTerm", async (req, res) => {
//   try {
//     const products = await Product.searchProducts(req.params.searchTerm);

//     res.json({
//       success: true,
//       data: products,
//       count: products.length,
//     });
//   } catch (error) {
//     console.error("Error searching products:", error);
//     res.status(500).json({ error: "Server error", message: error.message });
//   }
// });

// // GET /api/products/category/:category - Get products by category
// router.get("/category/:category", async (req, res) => {
//   try {
//     const products = await Product.findByCategory(req.params.category);

//     res.json({
//       success: true,
//       data: products,
//       count: products.length,
//     });
//   } catch (error) {
//     console.error("Error fetching category products:", error);
//     res.status(500).json({ error: "Server error", message: error.message });
//   }
// });

// // GET /api/products/price-range - Get products by price range
// router.get("/price/:minPrice/:maxPrice", async (req, res) => {
//   try {
//     const { minPrice, maxPrice } = req.params;

//     if (isNaN(minPrice) || isNaN(maxPrice) || minPrice < 0 || maxPrice < 0) {
//       return res.status(400).json({ error: "Invalid price range" });
//     }

//     const products = await Product.findByPriceRange(
//       parseFloat(minPrice),
//       parseFloat(maxPrice)
//     );

//     res.json({
//       success: true,
//       data: products,
//       count: products.length,
//     });
//   } catch (error) {
//     console.error("Error fetching products by price range:", error);
//     res.status(500).json({ error: "Server error", message: error.message });
//   }
// });

// // ========================================
// // EXPORT
// // ========================================

// module.exports = router;
