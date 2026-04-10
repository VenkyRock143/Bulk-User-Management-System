const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// ─── Sub-schemas ────────────────────────────────────────────────────────────

const addressSchema = new mongoose.Schema(
  {
    street: { type: String, trim: true, maxlength: 200 },
    city:   { type: String, trim: true, maxlength: 100 },
    state:  { type: String, trim: true, maxlength: 100 },
    zip:    { type: String, trim: true, maxlength: 20 },
    country: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "India",
    },
  },
  { _id: false }
);

// ─── Main User Schema ────────────────────────────────────────────────────────

const userSchema = new mongoose.Schema(
  {
    // Identity
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      minlength: [2, "First name must be at least 2 characters"],
      maxlength: [50, "First name must not exceed 50 characters"],
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
      minlength: [2, "Last name must be at least 2 characters"],
      maxlength: [50, "Last name must not exceed 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please provide a valid email address",
      ],
      maxlength: [255, "Email must not exceed 255 characters"],
    },
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, "Username must be at least 3 characters"],
      maxlength: [30, "Username must not exceed 30 characters"],
      match: [
        /^[a-z0-9_.-]+$/,
        "Username can only contain letters, numbers, underscores, dots and hyphens",
      ],
    },
    phone: {
      type: String,
      trim: true,
      match: [/^\+?[\d\s\-().]{7,20}$/, "Please provide a valid phone number"],
      default: null,
    },

    // Auth
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false, // Never returned in queries by default
    },

    // Profile
    role: {
      type: String,
      enum: {
        values: ["admin", "manager", "user", "viewer"],
        message: "{VALUE} is not a valid role",
      },
      default: "user",
    },
    status: {
      type: String,
      enum: {
        values: ["active", "inactive", "suspended", "pending"],
        message: "{VALUE} is not a valid status",
      },
      default: "active",
    },
    department: {
      type: String,
      trim: true,
      maxlength: [100, "Department must not exceed 100 characters"],
      default: null,
    },
    jobTitle: {
      type: String,
      trim: true,
      maxlength: [100, "Job title must not exceed 100 characters"],
      default: null,
    },
    age: {
      type: Number,
      min: [13, "Age must be at least 13"],
      max: [120, "Age must not exceed 120"],
      default: null,
    },
    gender: {
      type: String,
      enum: { values: ["male", "female", "other", "prefer_not_to_say"], message: "{VALUE} is not a valid gender" },
      default: null,
    },
    address: { type: addressSchema, default: null },

    // Metadata
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 20,
        message: "A user cannot have more than 20 tags",
      },
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isVerified: { type: Boolean, default: false },
    lastLoginAt: { type: Date, default: null },
    passwordChangedAt: { type: Date, default: null },

    // Soft delete
    deletedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true, // createdAt, updatedAt
    versionKey: "__v",
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Virtuals ────────────────────────────────────────────────────────────────

userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// ─── Indexes ─────────────────────────────────────────────────────────────────
//
// These are declared explicitly rather than relying on the `index: true`
// shorthand so we can add compound indexes and fine-grained options.

// Unique single-field indexes (also enforced via schema)
userSchema.index({ email:    1 }, { unique: true, name: "idx_email_unique" });
userSchema.index({ username: 1 }, { unique: true, name: "idx_username_unique" });

// Common query patterns
userSchema.index({ role:   1 }, { name: "idx_role" });
userSchema.index({ status: 1 }, { name: "idx_status" });
userSchema.index({ department: 1 }, { name: "idx_department" });
userSchema.index({ isDeleted: 1 }, { name: "idx_isDeleted" });

// Compound indexes — optimise multi-field filters
userSchema.index({ status: 1, role: 1 }, { name: "idx_status_role" });
userSchema.index({ department: 1, status: 1 }, { name: "idx_dept_status" });
userSchema.index({ isDeleted: 1, status: 1, createdAt: -1 }, { name: "idx_active_users_sorted" });

// Text search index (firstName, lastName, email, department)
userSchema.index(
  { firstName: "text", lastName: "text", email: "text", department: "text" },
  { name: "idx_text_search", weights: { email: 10, firstName: 5, lastName: 5, department: 2 } }
);

// ─── Middleware (Hooks) ───────────────────────────────────────────────────────

// Hash password before saving a single document
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    this.passwordChangedAt = new Date();
    next();
  } catch (err) {
    next(err);
  }
});

// ─── Instance Methods ─────────────────────────────────────────────────────────

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.softDelete = async function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.status    = "inactive";
  return this.save();
};

// ─── Static Methods ───────────────────────────────────────────────────────────

/**
 * Bulk insert with ordered:false (continues on duplicate errors)
 * and returns a detailed summary.
 */
userSchema.statics.bulkInsertUsers = async function (usersArray, batchSize = 500) {
  const results = {
    requested:  usersArray.length,
    inserted:   0,
    duplicates: 0,
    errors:     [],
    batches:    0,
  };

  // Hash all passwords in parallel batches
  const usersWithHashedPasswords = await Promise.all(
    usersArray.map(async (u) => {
      const salt = await bcrypt.genSalt(10); // Lower cost for bulk speed
      return { ...u, password: await bcrypt.hash(u.password || "Default@123", salt) };
    })
  );

  // Process in batches to avoid memory/socket overload
  for (let i = 0; i < usersWithHashedPasswords.length; i += batchSize) {
    const batch = usersWithHashedPasswords.slice(i, i + batchSize);
    try {
      const res = await this.insertMany(batch, {
        ordered: false, // Don't stop on first error
        rawResult: true,
      });
      results.inserted += res.insertedCount;
    } catch (err) {
      // BulkWriteError — some inserted, some didn't
      if (err.name === "BulkWriteError" || err.code === 11000) {
        results.inserted  += err.result?.nInserted || 0;
        results.duplicates += err.writeErrors?.filter((e) => e.code === 11000).length || 0;
        const otherErrors   = err.writeErrors?.filter((e) => e.code !== 11000) || [];
        if (otherErrors.length > 0) {
          results.errors.push({
            batch: results.batches + 1,
            errors: otherErrors.map((e) => ({
              index: e.index,
              message: e.errmsg,
            })),
          });
        }
      } else {
        results.errors.push({ batch: results.batches + 1, message: err.message });
      }
    }
    results.batches++;
  }

  return results;
};

/**
 * Bulk update using bulkWrite for maximum performance.
 * Each item must have a filter + update.
 */
userSchema.statics.bulkUpdateUsers = async function (operations) {
  const bulkOps = operations.map((op) => ({
    updateOne: {
      filter: op.filter,
      update: { $set: { ...op.update, updatedAt: new Date() } },
      upsert: op.upsert || false,
    },
  }));

  return this.bulkWrite(bulkOps, { ordered: false });
};

module.exports = mongoose.model("User", userSchema);