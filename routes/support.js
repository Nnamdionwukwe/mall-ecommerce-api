const express = require("express");
const router = express.Router();
const multer = require("multer");
const { body, validationResult } = require("express-validator");
const cloudinary = require("cloudinary").v2;
const Support = require("../models/Support");
const { auth, isAdmin } = require("../middleware/auth");

// ================================================
// CLOUDINARY CONFIGURATION
// ================================================

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ================================================
// MULTER CONFIGURATION FOR FILE UPLOADS
// ================================================

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedImageTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ];
  const allowedVideoTypes = ["video/mp4", "video/quicktime", "video/x-msvideo"];

  const allowedTypes = [...allowedImageTypes, ...allowedVideoTypes];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(`Invalid file type. Allowed types: ${allowedTypes.join(", ")}`),
      false
    );
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 5,
  },
});

// ================================================
// HELPER FUNCTION - UPLOAD TO CLOUDINARY
// ================================================

const uploadToCloudinary = async (file) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "auto", // Auto-detect image or video
        folder: "support-tickets", // Organize in Cloudinary
        quality: "auto", // Auto-optimize quality
      },
      (error, result) => {
        if (error) {
          console.error("❌ Cloudinary upload error:", error);
          reject(error);
        } else {
          console.log(`✅ Uploaded to Cloudinary: ${result.secure_url}`);
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
          });
        }
      }
    );

    uploadStream.end(file.buffer);
  });
};

// ================================================
// ROUTES
// ================================================

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

      const { name, email, category, subject, message, attachments } = req.body;

      const ticket = new Support({
        name,
        email,
        category,
        subject,
        message,
        attachments: attachments || [],
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

// UPLOAD MEDIA FOR SUPPORT TICKET - POST /api/support/upload
router.post("/upload", upload.array("files", 5), async (req, res) => {
  try {
    console.log("📤 Upload request received");
    console.log("Files:", req.files?.length || 0);

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No files uploaded",
      });
    }

    const uploadedFiles = [];

    for (const file of req.files) {
      console.log(`📁 Processing file: ${file.originalname}`);

      const mediaType = file.mimetype.startsWith("image/") ? "image" : "video";

      try {
        const uploadResult = await uploadToCloudinary(file);

        uploadedFiles.push({
          type: mediaType,
          url: uploadResult.url,
          filename: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
          uploadedAt: new Date(),
        });
      } catch (uploadError) {
        console.error(`Failed to upload ${file.originalname}:`, uploadError);
        return res.status(500).json({
          success: false,
          error: `Failed to upload ${file.originalname}`,
          message: uploadError.message,
        });
      }
    }

    console.log(`✅ ${uploadedFiles.length} files uploaded successfully`);

    res.json({
      success: true,
      message: "Files uploaded successfully",
      data: uploadedFiles,
    });
  } catch (error) {
    console.error("❌ Upload error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to upload files",
      message: error.message,
    });
  }
});

// CREATE SUPPORT TICKET WITH MEDIA - POST /api/support/with-media
router.post(
  "/with-media",
  upload.array("files", 5),
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

      console.log("📝 Creating support ticket with media");
      console.log("Files:", req.files?.length || 0);

      const { name, email, category, subject, message } = req.body;

      const attachments = [];

      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          const mediaType = file.mimetype.startsWith("image/")
            ? "image"
            : "video";

          try {
            const uploadResult = await uploadToCloudinary(file);

            attachments.push({
              type: mediaType,
              url: uploadResult.url,
              filename: file.originalname,
              size: file.size,
              mimeType: file.mimetype,
              uploadedAt: new Date(),
            });
          } catch (uploadError) {
            console.error(
              `Failed to upload ${file.originalname}:`,
              uploadError
            );
            return res.status(500).json({
              success: false,
              error: `Failed to upload ${file.originalname}`,
              message: uploadError.message,
            });
          }
        }
      }

      const ticket = new Support({
        name,
        email,
        category,
        subject,
        message,
        attachments,
      });

      await ticket.save();

      console.log(
        `✅ Ticket created: ${ticket._id} with ${attachments.length} attachments`
      );

      res.status(201).json({
        success: true,
        message: "Support ticket created successfully",
        data: {
          ticketId: ticket._id,
          status: ticket.status,
          attachmentCount: attachments.length,
          attachments: attachments, // Return Cloudinary URLs to frontend
        },
      });
    } catch (error) {
      console.error("❌ Create ticket with media error:", error);
      res.status(500).json({
        success: false,
        error: "Server error",
        message: error.message,
      });
    }
  }
);

// GET USER'S TICKETS - GET /api/support/my-tickets
router.get("/my-tickets", auth, async (req, res) => {
  try {
    const tickets = await Support.find({
      $or: [{ userId: req.user.id }, { email: req.user.email }],
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

// GET SINGLE TICKET - GET /api/support/:ticketId
router.get("/:ticketId", auth, async (req, res) => {
  try {
    const ticket = await Support.findById(req.params.ticketId);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: "Ticket not found",
      });
    }

    const isOwner =
      ticket.userId?.toString() === req.user.id ||
      ticket.email === req.user.email;

    const isAdminUser = req.user.role === "admin";

    if (!isOwner && !isAdminUser) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to view this ticket",
      });
    }

    res.json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    console.error("Get ticket error:", error);
    res.status(500).json({
      success: false,
      error: "Server error",
      message: error.message,
    });
  }
});

// ================================================
// ADMIN ROUTES
// ================================================

// GET ALL TICKETS (ADMIN) - GET /api/support/admin/all
router.get("/admin/all", auth, isAdmin, async (req, res) => {
  try {
    const { status, category, page = 1, limit = 50 } = req.query;

    const query = {};
    if (status) query.status = status;
    if (category) query.category = category;

    const tickets = await Support.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Support.countDocuments(query);

    res.json({
      success: true,
      data: tickets,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get all tickets error:", error);
    res.status(500).json({
      success: false,
      error: "Server error",
      message: error.message,
    });
  }
});

// UPDATE TICKET STATUS (ADMIN) - PATCH /api/support/admin/:ticketId/status
router.patch("/admin/:ticketId/status", auth, isAdmin, async (req, res) => {
  try {
    const { status, priority, adminNotes } = req.body;

    const validStatuses = ["open", "in-progress", "resolved", "closed"];
    const validPriorities = ["low", "medium", "high", "urgent"];

    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be: ${validStatuses.join(", ")}`,
      });
    }

    if (priority && !validPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        error: `Invalid priority. Must be: ${validPriorities.join(", ")}`,
      });
    }

    const updateData = {};
    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (adminNotes) updateData.adminNotes = adminNotes;

    const ticket = await Support.findByIdAndUpdate(
      req.params.ticketId,
      updateData,
      { new: true }
    );

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: "Ticket not found",
      });
    }

    res.json({
      success: true,
      message: "Ticket updated successfully",
      data: ticket,
    });
  } catch (error) {
    console.error("Update ticket error:", error);
    res.status(500).json({
      success: false,
      error: "Server error",
      message: error.message,
    });
  }
});

// ADD RESPONSE TO TICKET (ADMIN) - POST /api/support/admin/:ticketId/response
router.post(
  "/admin/:ticketId/response",
  auth,
  isAdmin,
  upload.array("files", 5),
  async (req, res) => {
    try {
      const { message } = req.body;

      if (!message || message.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: "Response message is required",
        });
      }

      const attachments = [];

      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          const mediaType = file.mimetype.startsWith("image/")
            ? "image"
            : "video";

          try {
            const uploadResult = await uploadToCloudinary(file);

            attachments.push({
              type: mediaType,
              url: uploadResult.url,
              filename: file.originalname,
            });
          } catch (uploadError) {
            console.error(
              `Failed to upload ${file.originalname}:`,
              uploadError
            );
            return res.status(500).json({
              success: false,
              error: `Failed to upload ${file.originalname}`,
              message: uploadError.message,
            });
          }
        }
      }

      const ticket = await Support.findById(req.params.ticketId);

      if (!ticket) {
        return res.status(404).json({
          success: false,
          error: "Ticket not found",
        });
      }

      ticket.responses.push({
        adminId: req.user.id,
        message,
        attachments,
        createdAt: new Date(),
      });

      if (ticket.status === "open") {
        ticket.status = "in-progress";
      }

      await ticket.save();

      res.json({
        success: true,
        message: "Response added successfully",
        data: ticket,
      });
    } catch (error) {
      console.error("Add response error:", error);
      res.status(500).json({
        success: false,
        error: "Server error",
        message: error.message,
      });
    }
  }
);

module.exports = router;
