const rateLimit = require("express-rate-limit");

/**
 * Standard rate limiter for normal routes
 */
const standardLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 min
  max:      Number(process.env.RATE_LIMIT_MAX)        || 100,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

/**
 * More lenient limiter specifically for bulk operations
 * (they are expensive but legitimate)
 */
const bulkLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max:      10,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    message: "Bulk operation rate limit exceeded. Max 10 bulk requests per minute.",
  },
});

/**
 * Validate that the request Content-Type is application/json
 * (only for routes that expect a JSON body)
 */
const requireJson = (req, res, next) => {
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    if (!req.is("application/json")) {
      return res.status(415).json({
        success: false,
        message: "Content-Type must be application/json",
      });
    }
  }
  next();
};

/**
 * Adds a request start timestamp for latency logging
 */
const requestTimer = (req, res, next) => {
  req.startTime = Date.now();
  next();
};

module.exports = { standardLimiter, bulkLimiter, requireJson, requestTimer };