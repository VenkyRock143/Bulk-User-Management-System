/**
 * Global error handler — must have 4 parameters for Express to recognise it
 * as an error-handling middleware.
 */
const errorHandler = (err, req, res, next) => {
  console.error(`❌  [${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  console.error(err.stack || err.message);

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(422).json({
      success: false,
      message: "Schema validation failed",
      details: messages,
    });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    return res.status(409).json({
      success: false,
      message: `Duplicate value for '${field}'.`,
    });
  }

  // Mongoose cast error (invalid ObjectId etc.)
  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: `Invalid value for field '${err.path}': ${err.value}`,
    });
  }

  // Mongoose disconnect / connection error
  if (err.name === "MongoNetworkError" || err.name === "MongoServerSelectionError") {
    return res.status(503).json({
      success: false,
      message: "Database connection error. Please try again later.",
    });
  }

  // JSON parse error (malformed request body)
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON in request body.",
    });
  }

  // Payload too large
  if (err.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      message: "Request payload is too large.",
    });
  }

  // Fallback — 500
  const isDev = process.env.NODE_ENV === "development";
  return res.status(err.statusCode || 500).json({
    success: false,
    message: isDev ? err.message : "Internal server error",
    ...(isDev && { stack: err.stack }),
  });
};

module.exports = errorHandler;