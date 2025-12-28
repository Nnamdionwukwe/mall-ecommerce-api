const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userName: {
      type: String,
      required: true,
    },
    userEmail: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "waiting", "closed"],
      default: "waiting",
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    messages: [
      {
        senderId: {
          type: String,
          required: true,
        },
        senderName: {
          type: String,
          required: true,
        },
        senderRole: {
          type: String,
          enum: ["user", "admin", "vendor"],
          required: true,
        },
        message: {
          type: String,
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        read: {
          type: Boolean,
          default: false,
        },
      },
    ],
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    unreadCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
chatSchema.index({ userId: 1, status: 1 });
chatSchema.index({ assignedTo: 1, status: 1 });
chatSchema.index({ lastMessageAt: -1 });

// Methods
chatSchema.methods.addMessage = function (
  senderId,
  senderName,
  senderRole,
  message
) {
  this.messages.push({
    senderId,
    senderName,
    senderRole,
    message,
    timestamp: new Date(),
    read: false,
  });
  this.lastMessageAt = new Date();

  // Increment unread count if message is not from the user
  if (senderRole !== "user") {
    this.unreadCount += 1;
  }

  return this.save();
};

chatSchema.methods.markAsRead = function (userId) {
  this.messages.forEach((msg) => {
    if (msg.senderId !== userId && !msg.read) {
      msg.read = true;
    }
  });
  this.unreadCount = 0;
  return this.save();
};

chatSchema.methods.assignToAdmin = function (adminId) {
  this.assignedTo = adminId;
  this.status = "active";
  return this.save();
};

chatSchema.methods.closeChat = function () {
  this.status = "closed";
  return this.save();
};

module.exports = mongoose.model("Chat", chatSchema);
