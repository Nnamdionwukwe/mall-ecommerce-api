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
      // ✅ NEW: Bank Transfer specific fields
      bankTransfer: {
        bankName: {
          type: String,
          default: null,
        },
        accountName: {
          type: String,
          default: null,
        },
        accountNumber: {
          type: String,
          default: null,
        },
        amountExpected: {
          type: Number,
          default: null,
        },
        amountReceived: {
          type: Number,
          default: null,
        },
        verifiedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        verifiedAt: {
          type: Date,
          default: null,
        },
        bankStatementProof: {
          type: String,
          default: null, // URL to uploaded proof
        },
      },
    },
    status: {
      type: String,
      enum: [
        "processing",
        "shipped",
        "delivered",
        "cancelled",
        "returned",
        "pending_payment",
      ],
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
orderSchema.index({ "paymentInfo.method": 1, "paymentInfo.status": 1 });

// ================================================
// PRE-SAVE MIDDLEWARE
// ================================================

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

      // Update order status if payment is completed
      if (this.status === "pending_payment") {
        this.status = "processing";
        console.log(`✅ [Order pre-save] Order status changed to processing`);
      }
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

// ✅ NEW: Method to verify bank transfer payment
orderSchema.methods.verifyBankTransfer = async function (
  amountReceived,
  verifiedBy,
  bankStatementProof = null
) {
  try {
    console.log(
      `🏦 [verifyBankTransfer] Verifying bank transfer for order: ${this.orderId}`
    );

    // Check if amount matches
    if (amountReceived < this.pricing.total) {
      throw new Error(
        `Amount received (₦${amountReceived}) is less than required (₦${this.pricing.total})`
      );
    }

    // Update payment info
    this.paymentInfo.status = "paid";
    this.paymentInfo.paidAt = new Date();
    this.paymentInfo.bankTransfer.amountReceived = amountReceived;
    this.paymentInfo.bankTransfer.verifiedBy = verifiedBy;
    this.paymentInfo.bankTransfer.verifiedAt = new Date();
    if (bankStatementProof) {
      this.paymentInfo.bankTransfer.bankStatementProof = bankStatementProof;
    }

    // Update order status
    this.status = "processing";

    const saved = await this.save();
    console.log(`✅ [verifyBankTransfer] Bank transfer verified successfully`);
    return saved;
  } catch (error) {
    console.error(`❌ [verifyBankTransfer] Error: ${error.message}`);
    throw error;
  }
};

// ✅ NEW: Method to check if payment is pending
orderSchema.methods.isPendingPayment = function () {
  return (
    this.paymentInfo.status === "pending" &&
    this.paymentInfo.method === "bank_transfer"
  );
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

// ✅ NEW: Static method to find pending bank transfers
orderSchema.statics.findPendingBankTransfers = async function (userId = null) {
  try {
    const query = {
      "paymentInfo.method": "bank_transfer",
      "paymentInfo.status": "pending",
    };

    if (userId) {
      query.userId = userId;
    }

    return this.find(query)
      .populate("userId", "name email phone")
      .sort({ createdAt: -1 });
  } catch (error) {
    console.error("❌ Error finding pending bank transfers:", error.message);
    return [];
  }
};

// ✅ NEW: Static method to get bank transfer stats
orderSchema.statics.getBankTransferStats = async function (userId = null) {
  try {
    const query = { "paymentInfo.method": "bank_transfer" };

    if (userId) {
      query.userId = userId;
    }

    const stats = await this.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$paymentInfo.status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$pricing.total" },
        },
      },
    ]);

    return stats;
  } catch (error) {
    console.error("❌ Error getting bank transfer stats:", error.message);
    return [];
  }
};

// ================================================
// MODEL
// ================================================

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
