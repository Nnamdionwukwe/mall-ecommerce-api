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
      select: false,
    },
    role: {
      type: String,
      enum: ["user", "vendor", "admin"],
      default: "user",
      index: true,
    },
    vendorId: {
      type: String,
      sparse: true,
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
    timestamps: true,
  }
);

// ========================================
// MIDDLEWARE - Hash password before saving
// ========================================
userSchema.pre("save", async function () {
  try {
    // Only hash if password is new or modified
    if (!this.isModified("password")) {
      console.log("⏭️  Password not modified, skipping hash");
      return; // Just return, don't call next()
    }

    console.log("🔒 Hashing password...");
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    console.log("✅ Password hashed successfully");
    // No next() call needed - promise will resolve automatically
  } catch (error) {
    console.error("❌ Error hashing password:", error.message);
    throw error; // Throw the error instead of calling next(error)
  }
});

// ========================================
// INSTANCE METHODS
// ========================================
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  return user;
};

// ========================================
// STATIC METHODS
// ========================================
userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email });
};

userSchema.statics.findActive = function () {
  return this.find({ isActive: true });
};

userSchema.statics.findVendors = function () {
  return this.find({ role: "vendor", isActive: true });
};

// ========================================
// CREATE AND EXPORT MODEL
// ========================================
const User = mongoose.model("User", userSchema);
module.exports = User;
