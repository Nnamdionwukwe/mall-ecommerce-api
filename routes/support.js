const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const Support = require("../models/Support");
const { auth, isAdmin } = require("../middleware/auth");

// CREATE SUPPORT TICKET - POST /api/support
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
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, email, category, subject, message } = req.body;

      const ticket = new Support({
        name,
        email,
        category,
        subject,
        message,
      });

      await ticket.save();

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

// GET USER'S TICKETS - GET /api/support/my-tickets
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

module.exports = router;
