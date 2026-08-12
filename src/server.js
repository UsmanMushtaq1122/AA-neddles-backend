const http = require("http");
const app = require("./app");
const env = require("./config/env");
const logger = require("./config/logger");
const prisma = require("./config/db");
const { initSocket } = require("./socket/socket");
const { ensureDefaultFaqCategories } = require("./utils/faqCategoryDefaults");
const { startJobs, stopJobs } = require("./jobs");

const server = http.createServer(app);

initSocket(server);

prisma.$connect()
  .then(async () => {
    logger.info("Database connected successfully");
    try {
      await ensureDefaultFaqCategories();
      logger.info("Default FAQ categories ensured");
    } catch (err) {
      logger.error("Failed to seed default FAQ categories:", err);
    }
    startJobs();
    server.listen(env.PORT, () => {
      logger.info(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
    });
    server.on("error", (err) => {
      if (err && err.code === "EADDRINUSE") {
        logger.error(`Port ${env.PORT} is already in use. Close the process using that port or set a different PORT environment variable.`);
        process.exit(1);
      }
      logger.error("Server error:", err);
      process.exit(1);
    });
  })
  .catch((err) => {
    logger.error("Failed to connect to database:", err);
    process.exit(1);
  });

const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Shutting down gracefully...`);
  stopJobs();
  server.close(async () => {
    await prisma.$disconnect();
    logger.info("Server shut down complete");
    process.exit(0);
  });

  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
