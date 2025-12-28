const mongoose = require("mongoose");

const supportSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: ["general", "order", "payment", "product", "technical", "vendor"],
    },
    subject: {
      type: String,
      required: [true, "Subject is required"],
      trim: true,
    },
    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
    },
    // 🆕 Media attachments (images/videos)
    attachments: [
      {
        type: {
          type: String,
          enum: ["image", "video"],
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
        filename: {
          type: String,
          required: true,
        },
        size: {
          type: Number, // Size in bytes
        },
        mimeType: {
          type: String,
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    status: {
      type: String,
      enum: ["open", "in-progress", "resolved", "closed"],
      default: "open",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    adminNotes: {
      type: String,
      default: "",
    },
    responses: [
      {
        adminId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        message: String,
        attachments: [
          {
            type: {
              type: String,
              enum: ["image", "video"],
            },
            url: String,
            filename: String,
          },
        ],
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes
supportSchema.index({ email: 1, createdAt: -1 });
supportSchema.index({ status: 1 });
supportSchema.index({ userId: 1 });

// Virtual for attachment count
supportSchema.virtual("attachmentCount").get(function () {
  return this.attachments ? this.attachments.length : 0;
});

module.exports = mongoose.model("Support", supportSchema);
