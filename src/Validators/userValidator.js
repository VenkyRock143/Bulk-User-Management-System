const Joi = require("joi");

// ─── Reusable primitives ──────────────────────────────────────────────────────

const emailSchema = Joi.string()
  .email({ tlds: { allow: false } })
  .lowercase()
  .trim()
  .max(255);

const passwordSchema = Joi.string()
  .min(8)
  .max(72)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "password")
  .message(
    "Password must be at least 8 chars and contain uppercase, lowercase and a number"
  );

const usernameSchema = Joi.string()
  .alphanum()
  .lowercase()
  .trim()
  .min(3)
  .max(30)
  .pattern(/^[a-z0-9_.-]+$/);

const addressSchema = Joi.object({
  street:  Joi.string().trim().max(200),
  city:    Joi.string().trim().max(100),
  state:   Joi.string().trim().max(100),
  zip:     Joi.string().trim().max(20),
  country: Joi.string().trim().max(100).default("India"),
});

// ─── Single user ──────────────────────────────────────────────────────────────

const singleUserSchema = Joi.object({
  firstName:  Joi.string().trim().min(2).max(50).required(),
  lastName:   Joi.string().trim().min(2).max(50).required(),
  email:      emailSchema.required(),
  username:   usernameSchema.required(),
  password:   passwordSchema.required(),
  phone:      Joi.string().trim().max(20).allow(null, ""),
  role:       Joi.string().valid("admin", "manager", "user", "viewer").default("user"),
  status:     Joi.string().valid("active", "inactive", "suspended", "pending").default("active"),
  department: Joi.string().trim().max(100).allow(null, ""),
  jobTitle:   Joi.string().trim().max(100).allow(null, ""),
  age:        Joi.number().integer().min(13).max(120).allow(null),
  gender:     Joi.string().valid("male", "female", "other", "prefer_not_to_say").allow(null),
  address:    addressSchema.allow(null),
  tags:       Joi.array().items(Joi.string().trim().max(50)).max(20).default([]),
  metadata:   Joi.object().default({}),
  isVerified: Joi.boolean().default(false),
});

// ─── Bulk create ─────────────────────────────────────────────────────────────

const bulkCreateSchema = Joi.object({
  users: Joi.array()
    .items(singleUserSchema)
    .min(1)
    .max(Number(process.env.MAX_BULK_INSERT) || 10000)
    .required(),
  batchSize: Joi.number().integer().min(100).max(2000).default(500),
});

// ─── Bulk update ─────────────────────────────────────────────────────────────

const bulkUpdateItemSchema = Joi.object({
  filter: Joi.object()
    .min(1)
    .required()
    .messages({ "object.min": "Each update operation must have at least one filter field" }),
  update: Joi.object({
    firstName:  Joi.string().trim().min(2).max(50),
    lastName:   Joi.string().trim().min(2).max(50),
    phone:      Joi.string().trim().max(20).allow(null, ""),
    role:       Joi.string().valid("admin", "manager", "user", "viewer"),
    status:     Joi.string().valid("active", "inactive", "suspended", "pending"),
    department: Joi.string().trim().max(100).allow(null, ""),
    jobTitle:   Joi.string().trim().max(100).allow(null, ""),
    age:        Joi.number().integer().min(13).max(120).allow(null),
    gender:     Joi.string().valid("male", "female", "other", "prefer_not_to_say").allow(null),
    address:    addressSchema.allow(null),
    tags:       Joi.array().items(Joi.string().trim().max(50)).max(20),
    metadata:   Joi.object(),
    isVerified: Joi.boolean(),
  })
    .min(1)
    .required()
    .messages({ "object.min": "Each update operation must have at least one field to update" }),
  upsert: Joi.boolean().default(false),
});

const bulkUpdateSchema = Joi.object({
  operations: Joi.array()
    .items(bulkUpdateItemSchema)
    .min(1)
    .max(Number(process.env.MAX_BULK_INSERT) || 10000)
    .required(),
});

// ─── Query / list params ─────────────────────────────────────────────────────

const listQuerySchema = Joi.object({
  page:       Joi.number().integer().min(1).default(1),
  limit:      Joi.number().integer().min(1).max(500).default(20),
  sort:       Joi.string().trim().default("-createdAt"),
  status:     Joi.string().valid("active", "inactive", "suspended", "pending"),
  role:       Joi.string().valid("admin", "manager", "user", "viewer"),
  department: Joi.string().trim(),
  search:     Joi.string().trim().max(100),
  isDeleted:  Joi.boolean().default(false),
});

// ─── Update single user ───────────────────────────────────────────────────────

const updateUserSchema = Joi.object({
  firstName:  Joi.string().trim().min(2).max(50),
  lastName:   Joi.string().trim().min(2).max(50),
  phone:      Joi.string().trim().max(20).allow(null, ""),
  role:       Joi.string().valid("admin", "manager", "user", "viewer"),
  status:     Joi.string().valid("active", "inactive", "suspended", "pending"),
  department: Joi.string().trim().max(100).allow(null, ""),
  jobTitle:   Joi.string().trim().max(100).allow(null, ""),
  age:        Joi.number().integer().min(13).max(120).allow(null),
  gender:     Joi.string().valid("male", "female", "other", "prefer_not_to_say").allow(null),
  address:    addressSchema.allow(null),
  tags:       Joi.array().items(Joi.string().trim().max(50)).max(20),
  metadata:   Joi.object(),
  isVerified: Joi.boolean(),
})
  .min(1)
  .messages({ "object.min": "At least one field must be provided to update" });

module.exports = {
  singleUserSchema,
  bulkCreateSchema,
  bulkUpdateSchema,
  listQuerySchema,
  updateUserSchema,
};