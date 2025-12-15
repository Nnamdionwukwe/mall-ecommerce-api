const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const Support = require("../models/Support");
const { auth, isAdmin } = require("../middleware/auth");

// ========================================
// CREATE SUPPORT TICKET - POST /api/support
// ========================================
router.post(
  "/",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Valid email is required"),
    body("category")
      .isIn(["general", "order", "payment", "product", "technical", "vendor"])
      .withMessage("Invalid category"),
    body("subject").trim().notEmpty().withMessage("Subject is required"),
    body("message")
      .trim()
      .isLength({ min: 10 })
      .withMessage("Message must be at least 10 characters"),
  ],
  async (req, res) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, email, category, subject, message } = req.body;

      // Create support ticket
      const ticket = new Support({
        userId: req.user?._id, // Optional if user is logged in
        name,
        email,
        category,
        subject,
        message,
      });

      await ticket.save();

      // TODO: Send email notification to support team
      // await sendEmailNotification(ticket);

      res.status(201).json({
        success: true,
        message: "Support ticket created successfully",
        data: {
          ticketId: ticket._id,
          status: ticket.status,
        },
      });
    } catch (error) {
      console.error("Create support ticket error:", error);
      res.status(500).json({ error: "Server error", message: error.message });
    }
  }
);

// ========================================
// GET USER'S TICKETS - GET /api/support/my-tickets
// ========================================
router.get("/my-tickets", auth, async (req, res) => {
  try {
    const tickets = await Support.find({
      $or: [{ userId: req.user._id }, { email: req.user.email }],
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: tickets,
      count: tickets.length,
    });
  } catch (error) {
    console.error("Get tickets error:", error);
    res.status(500).json({ error: "Server error", message: error.message });
  }
});

// ========================================
// GET SINGLE TICKET - GET /api/support/:id
// ========================================
router.get("/:id", auth, async (req, res) => {
  try {
    const ticket = await Support.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    // Check if user owns this ticket or is admin
    if (
      ticket.userId?.toString() !== req.user._id.toString() &&
      ticket.email !== req.user.email &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    if (error.kind === "ObjectId") {
      return res.status(400).json({ error: "Invalid ticket ID" });
    }
    console.error("Get ticket error:", error);
    res.status(500).json({ error: "Server error", message: error.message });
  }
});

// ========================================
// GET ALL TICKETS (ADMIN) - GET /api/support/admin/all
// ========================================
router.get("/admin/all", auth, isAdmin, async (req, res) => {
  try {
    const { status, category, priority, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status) query.status = status;
    if (category) query.category = category;
    if (priority) query.priority = priority;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const [tickets, total] = await Promise.all([
      Support.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("userId", "name email"),
      Support.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: tickets,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Get all tickets error:", error);
    res.status(500).json({ error: "Server error", message: error.message });
  }
});

// ========================================
// UPDATE TICKET STATUS (ADMIN) - PUT /api/support/:id/status
// ========================================
router.put("/:id/status", auth, isAdmin, async (req, res) => {
  try {
    const { status, priority, adminNotes } = req.body;

    const updateData = {};
    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes;

    const ticket = await Support.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    res.json({
      success: true,
      message: "Ticket updated successfully",
      data: ticket,
    });
  } catch (error) {
    console.error("Update ticket error:", error);
    res.status(500).json({ error: "Server error", message: error.message });
  }
});

// ========================================
// ADD RESPONSE TO TICKET (ADMIN) - POST /api/support/:id/response
// ========================================
router.post(
  "/:id/response",
  auth,
  isAdmin,
  [
    body("message")
      .trim()
      .notEmpty()
      .withMessage("Response message is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { message } = req.body;

      const ticket = await Support.findByIdAndUpdate(
        req.params.id,
        {
          $push: {
            responses: {
              adminId: req.user._id,
              message,
            },
          },
          status: "in-progress",
        },
        { new: true }
      );

      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      // TODO: Send email notification to user
      // await sendEmailToUser(ticket);

      res.json({
        success: true,
        message: "Response added successfully",
        data: ticket,
      });
    } catch (error) {
      console.error("Add response error:", error);
      res.status(500).json({ error: "Server error", message: error.message });
    }
  }
);

// ========================================
// DELETE TICKET (ADMIN) - DELETE /api/support/:id
// ========================================
router.delete("/:id", auth, isAdmin, async (req, res) => {
  try {
    const ticket = await Support.findByIdAndDelete(req.params.id);

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    res.json({
      success: true,
      message: "Ticket deleted successfully",
    });
  } catch (error) {
    console.error("Delete ticket error:", error);
    res.status(500).json({ error: "Server error", message: error.message });
  }
});

module.exports = router;
