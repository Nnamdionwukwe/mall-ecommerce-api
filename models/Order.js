const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      description: "Unique order reference (e.g., ORD-1234567890-1234)",
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        price: {
          type: Number,
          required: true,
          min: 0,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        image: {
          type: String,
          default: null,
        },
      },
    ],
    shippingInfo: {
      fullName: {
        type: String,
        required: true,
      },
      email: {
        type: String,
        required: true,
        lowercase: true,
      },
      phone: {
        type: String,
        required: true,
      },
      address: {
        type: String,
        required: true,
      },
      city: {
        type: String,
        required: true,
      },
      state: {
        type: String,
        required: true,
      },
      zipCode: {
        type: String,
        required: true,
      },
    },
    orderNote: {
      type: String,
      default: "",
      maxlength: 500,
    },
    pricing: {
      subtotal: {
        type: Number,
        required: true,
        min: 0,
      },
      shipping: {
        type: Number,
        required: true,
        min: 0,
      },
      tax: {
        type: Number,
        required: true,
        min: 0,
      },
      total: {
        type: Number,
        required: true,
        min: 0,
      },
    },
    paymentInfo: {
      method: {
        type: String,
        enum: ["paystack", "stripe", "card", "bank_transfer"],
        default: "paystack",
      },
      reference: {
        type: String,
        required: true,
        index: true,
      },
      transactionId: {
        type: String,
        default: null,
      },
      status: {
        type: String,
        enum: ["pending", "paid", "failed", "cancelled"],
        default: "pending",
      },
      paidAt: {
        type: Date,
        default: null,
      },
    },
    status: {
      type: String,
      enum: ["processing", "shipped", "delivered", "cancelled", "returned"],
      default: "processing",
      index: true,
    },
    trackingNumber: {
      type: String,
      default: null,
    },
    estimatedDelivery: {
      type: Date,
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    cancellationReason: {
      type: String,
      default: null,
    },
    notes: [
      {
        message: String,
        createdBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// ================================================
// INDEXES
// ================================================

orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });

// ================================================
// PRE-SAVE MIDDLEWARE - FIXED WITH ASYNC/AWAIT
// ================================================

// ✅ FIXED: Using async/await (no next parameter needed)
orderSchema.pre("save", async function () {
  try {
    console.log(
      `🔄 [Order pre-save] Updating timestamps for order: ${this.orderId}`
    );

    // Update the updatedAt timestamp
    this.updatedAt = new Date();

    // Check if paymentInfo exists before accessing it
    if (
      this.paymentInfo &&
      this.paymentInfo.status === "paid" &&
      !this.paymentInfo.paidAt
    ) {
      console.log(`✅ [Order pre-save] Setting paidAt timestamp`);
      this.paymentInfo.paidAt = new Date();
    }

    console.log(`✅ [Order pre-save] Pre-save complete`);
  } catch (error) {
    console.error(`❌ [Order pre-save] Error: ${error.message}`);
    throw error;
  }
});

// ================================================
// INSTANCE METHODS
// ================================================

// Method to calculate days until delivery
orderSchema.methods.daysUntilDelivery = function () {
  try {
    if (!this.estimatedDelivery) {
      return null;
    }
    const now = new Date();
    const daysLeft = Math.ceil(
      (this.estimatedDelivery - now) / (1000 * 60 * 60 * 24)
    );
    return daysLeft > 0 ? daysLeft : 0;
  } catch (error) {
    console.error("❌ Error calculating days until delivery:", error.message);
    return null;
  }
};

// Method to add order note
orderSchema.methods.addNote = async function (message, userId) {
  try {
    console.log(`📝 [addNote] Adding note to order: ${this.orderId}`);

    this.notes.push({
      message,
      createdBy: userId,
      createdAt: new Date(),
    });

    const saved = await this.save();
    console.log(`✅ [addNote] Note added successfully`);
    return saved;
  } catch (error) {
    console.error(`❌ [addNote] Error: ${error.message}`);
    throw error;
  }
};

// Method to check if order can be cancelled
orderSchema.methods.canBeCancelled = function () {
  try {
    const canCancel =
      this.status === "processing" &&
      this.paymentInfo &&
      this.paymentInfo.status === "paid";
    console.log(
      `🔍 [canBeCancelled] Order ${this.orderId} can be cancelled: ${canCancel}`
    );
    return canCancel;
  } catch (error) {
    console.error(`❌ [canBeCancelled] Error: ${error.message}`);
    return false;
  }
};

// ================================================
// STATIC METHODS
// ================================================

// Static method to get order stats
orderSchema.statics.getOrderStats = async function (userId = null) {
  try {
    const query = userId ? { userId } : {};

    const stats = await this.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalRevenue: { $sum: "$pricing.total" },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    return stats;
  } catch (error) {
    console.error("❌ Error getting order stats:", error.message);
    return [];
  }
};

// Static method to find orders by status
orderSchema.statics.findByStatus = function (status, userId = null) {
  try {
    const query = { status };
    if (userId) {
      query.userId = userId;
    }
    return this.find(query).sort({ createdAt: -1 });
  } catch (error) {
    console.error("❌ Error finding orders by status:", error.message);
    return [];
  }
};

// Static method to find order by payment reference
orderSchema.statics.findByPaymentReference = function (reference) {
  try {
    return this.findOne({ "paymentInfo.reference": reference });
  } catch (error) {
    console.error(
      "❌ Error finding order by payment reference:",
      error.message
    );
    return null;
  }
};

// ================================================
// MODEL
// ================================================

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
