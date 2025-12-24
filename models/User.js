const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [50, "Name cannot exceed 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // Don't return password by default in queries
    },
    role: {
      type: String,
      enum: ["user", "vendor", "admin"],
      default: "user",
      index: true,
    },
    vendorId: {
      type: String,
      sparse: true, // Only vendors have this
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    profileImage: {
      type: String,
      default: null,
    },
    phone: {
      type: String,
      default: null,
    },
    address: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

// ========================================
// MIDDLEWARE - Hash password before saving
// ========================================
userSchema.pre("save", async function (next) {
  try {
    // Only hash if password is new or modified
    if (!this.isModified("password")) {
      console.log("⏭️  Password not modified, skipping hash");
      return next();
    }

    console.log("🔒 Hashing password...");
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    console.log("✅ Password hashed successfully");
    next();
  } catch (error) {
    console.error("❌ Error hashing password:", error.message);
    next(error);
  }
});

// ========================================
// INSTANCE METHODS
// ========================================

// Compare entered password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Return user object without password
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  return user;
};

// ========================================
// STATIC METHODS
// ========================================

// Find user by email
userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email });
};

// Find active users only
userSchema.statics.findActive = function () {
  return this.find({ isActive: true });
};

// Find vendors
userSchema.statics.findVendors = function () {
  return this.find({ role: "vendor", isActive: true });
};

// ========================================
// CREATE AND EXPORT MODEL
// ========================================
const User = mongoose.model("User", userSchema);

module.exports = User;
