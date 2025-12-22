// import mongoose from "mongoose";
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

// Index for faster queries
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ "paymentInfo.reference": 1 });

// Pre-save middleware to update timestamps
orderSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  if (this.paymentInfo.status === "paid" && !this.paymentInfo.paidAt) {
    this.paymentInfo.paidAt = new Date();
  }
  next();
});

// Method to calculate days until delivery
orderSchema.methods.daysUntilDelivery = function () {
  if (!this.estimatedDelivery) return null;
  const now = new Date();
  const daysLeft = Math.ceil(
    (this.estimatedDelivery - now) / (1000 * 60 * 60 * 24)
  );
  return daysLeft > 0 ? daysLeft : 0;
};

// Method to add order note
orderSchema.methods.addNote = function (message, userId) {
  this.notes.push({
    message,
    createdBy: userId,
    createdAt: new Date(),
  });
  return this.save();
};

// Method to check if order can be cancelled
orderSchema.methods.canBeCancelled = function () {
  return this.status === "processing" && this.paymentInfo.status === "paid";
};

// Static method to get order stats for admin
orderSchema.statics.getOrderStats = async function (userId = null) {
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
};

// Static method to find orders by status
orderSchema.statics.findByStatus = function (status, userId = null) {
  const query = { status };
  if (userId) {
    query.userId = userId;
  }
  return this.find(query).sort({ createdAt: -1 });
};

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
