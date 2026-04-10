const mongoose = require("mongoose");
const BSON     = require("bson");
const User     = require("../models/User");
const {
  bulkCreateSchema,
  bulkUpdateSchema,
  listQuerySchema,
  singleUserSchema,
  updateUserSchema,
} = require("../validators/userValidator");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sendSuccess = (res, data, message = "Success", statusCode = 200) =>
  res.status(statusCode).json({ success: true, message, ...data });

const sendError = (res, message, statusCode = 400, details = null) => {
  const payload = { success: false, message };
  if (details) payload.details = details;
  return res.status(statusCode).json(payload);
};

// ─── User Controllers ─────────────────────────────────────────────────────────

/**
 * POST /api/users
 * Create a single user
 */
exports.createUser = async (req, res, next) => {
  try {
    const { error, value } = singleUserSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return sendError(res, "Validation failed", 422, error.details.map((d) => d.message));

    const user = await User.create(value);
    const userData = user.toObject();
    delete userData.password;

    return sendSuccess(res, { data: userData }, "User created successfully", 201);
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return sendError(res, `Duplicate value: ${field} already exists`, 409);
    }
    next(err);
  }
};

/**
 * POST /api/users/bulk
 * Bulk create users — supports 5,000–10,000+ records
 */
exports.bulkCreateUsers = async (req, res, next) => {
  try {
    const { error, value } = bulkCreateSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return sendError(res, "Validation failed", 422, error.details.map((d) => d.message));

    const { users, batchSize } = value;
    const startTime = Date.now();

    const result = await User.bulkInsertUsers(users, batchSize);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    return sendSuccess(
      res,
      {
        data: {
          ...result,
          durationSeconds: parseFloat(duration),
          insertRate: `${Math.round(result.inserted / parseFloat(duration)) || 0} users/sec`,
        },
      },
      `Bulk insert completed: ${result.inserted} inserted, ${result.duplicates} duplicates`,
      result.inserted > 0 ? 201 : 422
    );
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/users/bulk
 * Bulk update users via flexible filter+update pairs
 */
exports.bulkUpdateUsers = async (req, res, next) => {
  try {
    const { error, value } = bulkUpdateSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return sendError(res, "Validation failed", 422, error.details.map((d) => d.message));

    const { operations } = value;
    const startTime = Date.now();

    const result = await User.bulkUpdateUsers(operations);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    return sendSuccess(res, {
      data: {
        matchedCount:  result.matchedCount,
        modifiedCount: result.modifiedCount,
        upsertedCount: result.upsertedCount,
        totalOps:      operations.length,
        durationSeconds: parseFloat(duration),
      },
    }, `Bulk update completed: ${result.modifiedCount} documents modified`);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/users
 * List users with pagination, filtering, sorting and text search
 */
exports.getUsers = async (req, res, next) => {
  try {
    const { error, value } = listQuerySchema.validate(req.query, { abortEarly: false, stripUnknown: true });
    if (error) return sendError(res, "Invalid query parameters", 422, error.details.map((d) => d.message));

    const { page, limit, sort, status, role, department, search, isDeleted } = value;

    // Build filter
    const filter = { isDeleted };
    if (status)     filter.status     = status;
    if (role)       filter.role       = role;
    if (department) filter.department = new RegExp(department, "i");
    if (search)     filter.$text      = { $search: search };

    const skip  = (page - 1) * limit;
    const total = await User.countDocuments(filter);

    const users = await User.find(filter)
      .select("-password")
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    return sendSuccess(res, {
      data:  users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/users/:id
 * Get a single user by MongoDB _id
 */
exports.getUserById = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return sendError(res, "Invalid user ID format", 400);

    const user = await User.findOne({ _id: req.params.id, isDeleted: false }).select("-password").lean();
    if (!user) return sendError(res, "User not found", 404);

    return sendSuccess(res, { data: user });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/users/:id
 * Update a single user
 */
exports.updateUser = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return sendError(res, "Invalid user ID format", 400);

    const { error, value } = updateUserSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return sendError(res, "Validation failed", 422, error.details.map((d) => d.message));

    const user = await User.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { $set: value },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) return sendError(res, "User not found", 404);

    return sendSuccess(res, { data: user }, "User updated successfully");
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return sendError(res, `Duplicate value: ${field} already exists`, 409);
    }
    next(err);
  }
};

/**
 * DELETE /api/users/:id
 * Soft delete a user (sets isDeleted = true)
 */
exports.deleteUser = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return sendError(res, "Invalid user ID format", 400);

    const user = await User.findOne({ _id: req.params.id, isDeleted: false });
    if (!user) return sendError(res, "User not found", 404);

    await user.softDelete();

    return sendSuccess(res, { data: { id: user._id } }, "User deleted successfully");
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/users/bulk
 * Bulk soft-delete by filter (e.g. all users in a department)
 */
exports.bulkDeleteUsers = async (req, res, next) => {
  try {
    const { filter } = req.body;
    if (!filter || typeof filter !== "object" || Object.keys(filter).length === 0)
      return sendError(res, "A non-empty filter object is required for bulk delete", 400);

    // Safety: never allow deleting without a real filter
    filter.isDeleted = false;

    const result = await User.updateMany(filter, {
      $set: { isDeleted: true, deletedAt: new Date(), status: "inactive" },
    });

    return sendSuccess(res, {
      data: {
        matchedCount:  result.matchedCount,
        modifiedCount: result.modifiedCount,
      },
    }, `${result.modifiedCount} users soft-deleted`);
  } catch (err) {
    next(err);
  }
};

// ─── Stats ────────────────────────────────────────────────────────────────────

/**
 * GET /api/users/stats
 * Aggregation pipeline — counts by role, status, department
 */
exports.getUserStats = async (req, res, next) => {
  try {
    const [byRole, byStatus, byDept, total] = await Promise.all([
      User.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: "$role", count: { $sum: 1 } } },
        { $sort:  { count: -1 } },
      ]),
      User.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort:  { count: -1 } },
      ]),
      User.aggregate([
        { $match: { isDeleted: false, department: { $ne: null } } },
        { $group: { _id: "$department", count: { $sum: 1 } } },
        { $sort:  { count: -1 } },
        { $limit: 10 },
      ]),
      User.countDocuments({ isDeleted: false }),
    ]);

    return sendSuccess(res, {
      data: { total, byRole, byStatus, topDepartments: byDept },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Export ───────────────────────────────────────────────────────────────────

/**
 * GET /api/users/export?format=json|bson
 * Streams large datasets to avoid memory overflow
 */
exports.exportUsers = async (req, res, next) => {
  try {
    const format = (req.query.format || "json").toLowerCase();
    if (!["json", "bson"].includes(format))
      return sendError(res, "Format must be 'json' or 'bson'", 400);

    // Build export filter
    const filter = { isDeleted: false };
    if (req.query.status)     filter.status     = req.query.status;
    if (req.query.role)       filter.role       = req.query.role;
    if (req.query.department) filter.department = req.query.department;

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename  = `users_export_${timestamp}.${format}`;

    if (format === "json") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

      // Stream JSON array
      res.write("[\n");
      let first  = true;
      let count  = 0;
      const cursor = User.find(filter).select("-password").lean().cursor();

      for await (const doc of cursor) {
        if (!first) res.write(",\n");
        res.write(JSON.stringify(doc, null, 2));
        first = false;
        count++;
      }

      res.write("\n]");
      res.end();

      console.log(`📤  Exported ${count} users as JSON`);

    } else {
      // BSON export — write each document as a length-prefixed BSON document
      // (compatible with mongorestore)
      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

      let count  = 0;
      const cursor = User.find(filter).select("-password").lean().cursor();

      for await (const doc of cursor) {
        const bsonDoc = BSON.serialize(doc);
        res.write(bsonDoc);
        count++;
      }

      res.end();
      console.log(`📤  Exported ${count} users as BSON`);
    }
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/users/export/stats
 * Returns export metadata without downloading the file
 */
exports.exportStats = async (req, res, next) => {
  try {
    const filter = { isDeleted: false };
    if (req.query.status)     filter.status     = req.query.status;
    if (req.query.role)       filter.role       = req.query.role;
    if (req.query.department) filter.department = req.query.department;

    const count = await User.countDocuments(filter);
    const estimatedJsonBytes = count * 450; // ~450 bytes per user JSON

    return sendSuccess(res, {
      data: {
        recordCount:        count,
        filter,
        estimatedJsonSize:  `${(estimatedJsonBytes / 1024 / 1024).toFixed(2)} MB`,
        estimatedBsonSize:  `${(estimatedJsonBytes * 0.8 / 1024 / 1024).toFixed(2)} MB`,
        availableFormats:   ["json", "bson"],
        exportEndpoint:     "/api/users/export?format=json|bson",
      },
    });
  } catch (err) {
    next(err);
  }
};