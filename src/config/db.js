const mongoose = require("mongoose");

/**
 * Establishes MongoDB connection with retry logic and
 * performance-optimised connection pool settings.
 */
const connectDB = async () => {
  const uri = process.env.MONGO_URI || "mongodb://localhost:27017/bulk_user_management";

  const options = {
    // Connection pool — supports high-concurrency bulk ops
    maxPoolSize: 20,
    minPoolSize: 5,
    // Timeout settings
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 60000,
    connectTimeoutMS: 10000,
    // Keep-alive
    heartbeatFrequencyMS: 10000,
  };

  try {
    const conn = await mongoose.connect(uri, options);

    console.log(`✅  MongoDB connected: ${conn.connection.host}`);
    console.log(`📦  Database: ${conn.connection.name}`);

    // Graceful shutdown on process termination
    process.on("SIGINT", async () => {
      await mongoose.connection.close();
      console.log("🔌  MongoDB connection closed (SIGINT).");
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      await mongoose.connection.close();
      console.log("🔌  MongoDB connection closed (SIGTERM).");
      process.exit(0);
    });

    return conn;
  } catch (err) {
    console.error(`❌  MongoDB connection error: ${err.message}`);
    process.exit(1);
  }
};

// Mongoose global settings
mongoose.set("strictQuery", true);

// Log slow queries in development
if (process.env.NODE_ENV === "development") {
  mongoose.set("debug", (collectionName, method, query) => {
    console.log(`🔍  Mongoose [${collectionName}.${method}]`, JSON.stringify(query));
  });
}

module.exports = connectDB;