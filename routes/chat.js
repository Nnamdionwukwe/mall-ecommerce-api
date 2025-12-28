const express = require("express");
const router = express.Router();
const Chat = require("../models/Chat");
const { auth, isAdmin, isVendor } = require("../middleware/auth");

// ========================================
// USER ROUTES
// ========================================

// GET or CREATE user's active chat
router.get("/my-chat", auth, async (req, res) => {
  try {
    console.log("📱 Getting chat for user:", req.user.id);

    // Find existing active or waiting chat
    let chat = await Chat.findOne({
      userId: req.user.id,
      status: { $in: ["active", "waiting"] },
    }).sort({ createdAt: -1 });

    // If no active chat exists, create a new one
    if (!chat) {
      console.log("🆕 Creating new chat for user");
      chat = new Chat({
        userId: req.user.id,
        userName: req.user.name,
        userEmail: req.user.email,
        status: "waiting",
        messages: [],
        unreadCount: 0,
      });
      await chat.save();

      // Notify admins/vendors via Socket.IO
      if (global.io) {
        global.io.to("admin-room").emit("new-chat", {
          chat: chat,
        });
      }
    }

    res.json({
      success: true,
      data: chat,
    });
  } catch (error) {
    console.error("❌ Get chat error:", error);
    res.status(500).json({
      success: false,
      error: "Server error",
      message: error.message,
    });
  }
});

// POST send message
router.post("/send-message", auth, async (req, res) => {
  try {
    const { chatId, message } = req.body;

    console.log("📨 Send message request:", {
      chatId,
      userId: req.user.id,
      role: req.user.role,
      messageLength: message?.length,
    });

    // Validate message
    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Message is required",
      });
    }

    if (message.length > 1000) {
      return res.status(400).json({
        success: false,
        error: "Message is too long (max 1000 characters)",
      });
    }

    // Find chat
    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({
        success: false,
        error: "Chat not found",
      });
    }

    // Authorization check
    const isOwner = chat.userId.toString() === req.user.id;
    const isAdminOrVendor =
      req.user.role === "admin" || req.user.role === "vendor";

    if (!isOwner && !isAdminOrVendor) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to send messages in this chat",
      });
    }

    // Add message to chat
    await chat.addMessage(req.user.id, req.user.name, req.user.role, message);

    console.log("✅ Message added to chat");

    // Emit via Socket.IO (will be handled in socket handler)
    // The socket handler will broadcast to relevant users

    res.json({
      success: true,
      data: chat,
      message: "Message sent successfully",
    });
  } catch (error) {
    console.error("❌ Send message error:", error);
    res.status(500).json({
      success: false,
      error: "Server error",
      message: error.message,
    });
  }
});

// PATCH mark messages as read
router.patch("/:chatId/read", auth, async (req, res) => {
  try {
    console.log("👁️ Mark as read:", req.params.chatId);

    const chat = await Chat.findById(req.params.chatId);

    if (!chat) {
      return res.status(404).json({
        success: false,
        error: "Chat not found",
      });
    }

    // Only owner, admin, or vendor can mark as read
    const isOwner = chat.userId.toString() === req.user.id;
    const isAdminOrVendor =
      req.user.role === "admin" || req.user.role === "vendor";

    if (!isOwner && !isAdminOrVendor) {
      return res.status(403).json({
        success: false,
        error: "Not authorized",
      });
    }

    await chat.markAsRead(req.user.id);

    console.log("✅ Messages marked as read");

    res.json({
      success: true,
      data: chat,
    });
  } catch (error) {
    console.error("❌ Mark read error:", error);
    res.status(500).json({
      success: false,
      error: "Server error",
      message: error.message,
    });
  }
});

// PATCH close chat
router.patch("/:chatId/close", auth, async (req, res) => {
  try {
    console.log("🔒 Close chat:", req.params.chatId);

    const chat = await Chat.findById(req.params.chatId);

    if (!chat) {
      return res.status(404).json({
        success: false,
        error: "Chat not found",
      });
    }

    // Only owner, admin, or vendor can close
    const isOwner = chat.userId.toString() === req.user.id;
    const isAdminOrVendor =
      req.user.role === "admin" || req.user.role === "vendor";

    if (!isOwner && !isAdminOrVendor) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to close this chat",
      });
    }

    await chat.closeChat();

    console.log("✅ Chat closed");

    // Notify via Socket.IO
    if (global.io) {
      global.io.to(`user:${chat.userId}`).emit("chat-closed", {
        chatId: chat._id,
      });
      global.io.to("admin-room").emit("chat-closed", {
        chatId: chat._id,
      });
    }

    res.json({
      success: true,
      message: "Chat closed successfully",
      data: chat,
    });
  } catch (error) {
    console.error("❌ Close chat error:", error);
    res.status(500).json({
      success: false,
      error: "Server error",
      message: error.message,
    });
  }
});

// GET user's chat history
router.get("/my-chats/history", auth, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const chats = await Chat.find({
      userId: req.user.id,
    })
      .sort({ lastMessageAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Chat.countDocuments({ userId: req.user.id });

    res.json({
      success: true,
      data: chats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("❌ Get history error:", error);
    res.status(500).json({
      success: false,
      error: "Server error",
      message: error.message,
    });
  }
});

// ========================================
// ADMIN/VENDOR ROUTES
// ========================================

// GET all chats (admin/vendor)
router.get("/admin/all", auth, isVendor, async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;

    console.log("👨‍💼 Admin getting all chats:", {
      status,
      page,
      limit,
      search,
    });

    // Build query
    const query = {};

    if (status && status !== "all") {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { userName: { $regex: search, $options: "i" } },
        { userEmail: { $regex: search, $options: "i" } },
      ];
    }

    // Get chats with pagination
    const chats = await Chat.find(query)
      .populate("userId", "name email")
      .populate("assignedTo", "name email role")
      .sort({ lastMessageAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Chat.countDocuments(query);

    // Get counts for each status
    const statusCounts = await Chat.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const counts = {
      waiting: 0,
      active: 0,
      closed: 0,
      total: total,
    };

    statusCounts.forEach((item) => {
      counts[item._id] = item.count;
    });

    console.log("✅ Found", chats.length, "chats");

    res.json({
      success: true,
      data: chats,
      counts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("❌ Get all chats error:", error);
    res.status(500).json({
      success: false,
      error: "Server error",
      message: error.message,
    });
  }
});

// GET single chat (admin/vendor or owner)
router.get("/:chatId", auth, async (req, res) => {
  try {
    console.log("🔍 Get chat:", req.params.chatId);

    const chat = await Chat.findById(req.params.chatId)
      .populate("userId", "name email")
      .populate("assignedTo", "name email role");

    if (!chat) {
      return res.status(404).json({
        success: false,
        error: "Chat not found",
      });
    }

    // Authorization check
    const isOwner = chat.userId._id.toString() === req.user.id;
    const isAdminOrVendor =
      req.user.role === "admin" || req.user.role === "vendor";

    if (!isOwner && !isAdminOrVendor) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to view this chat",
      });
    }

    res.json({
      success: true,
      data: chat,
    });
  } catch (error) {
    console.error("❌ Get chat error:", error);
    res.status(500).json({
      success: false,
      error: "Server error",
      message: error.message,
    });
  }
});

// PATCH assign chat to admin/vendor
router.patch("/:chatId/assign", auth, isVendor, async (req, res) => {
  try {
    console.log("👨‍💼 Assigning chat:", req.params.chatId, "to", req.user.id);

    const chat = await Chat.findById(req.params.chatId);

    if (!chat) {
      return res.status(404).json({
        success: false,
        error: "Chat not found",
      });
    }

    // Assign chat to current admin/vendor
    await chat.assignToAdmin(req.user.id);

    console.log("✅ Chat assigned");

    // Notify via Socket.IO
    if (global.io) {
      global.io.to(`user:${chat.userId}`).emit("chat-assigned", {
        chatId: chat._id,
        assignedTo: {
          id: req.user.id,
          name: req.user.name,
        },
      });
    }

    res.json({
      success: true,
      message: "Chat assigned successfully",
      data: chat,
    });
  } catch (error) {
    console.error("❌ Assign chat error:", error);
    res.status(500).json({
      success: false,
      error: "Server error",
      message: error.message,
    });
  }
});

// DELETE chat (admin only)
router.delete("/:chatId", auth, isAdmin, async (req, res) => {
  try {
    console.log("🗑️ Deleting chat:", req.params.chatId);

    const chat = await Chat.findByIdAndDelete(req.params.chatId);

    if (!chat) {
      return res.status(404).json({
        success: false,
        error: "Chat not found",
      });
    }

    console.log("✅ Chat deleted");

    res.json({
      success: true,
      message: "Chat deleted successfully",
    });
  } catch (error) {
    console.error("❌ Delete chat error:", error);
    res.status(500).json({
      success: false,
      error: "Server error",
      message: error.message,
    });
  }
});

// GET chat statistics (admin)
router.get("/admin/stats", auth, isVendor, async (req, res) => {
  try {
    const stats = await Chat.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const totalChats = await Chat.countDocuments();
    const avgResponseTime = await Chat.aggregate([
      { $match: { messages: { $exists: true, $ne: [] } } },
      {
        $project: {
          responseTime: {
            $subtract: [
              { $arrayElemAt: ["$messages.timestamp", 1] },
              { $arrayElemAt: ["$messages.timestamp", 0] },
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgTime: { $avg: "$responseTime" },
        },
      },
    ]);

    const statusBreakdown = {};
    stats.forEach((item) => {
      statusBreakdown[item._id] = item.count;
    });

    res.json({
      success: true,
      data: {
        total: totalChats,
        byStatus: statusBreakdown,
        avgResponseTime:
          avgResponseTime.length > 0
            ? Math.round(avgResponseTime[0].avgTime / 1000 / 60)
            : 0,
      },
    });
  } catch (error) {
    console.error("❌ Get stats error:", error);
    res.status(500).json({
      success: false,
      error: "Server error",
      message: error.message,
    });
  }
});

// ========================================
// EXPORT
// ========================================

module.exports = router;
