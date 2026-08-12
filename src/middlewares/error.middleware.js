const multer = require("multer");
const logger = require("../config/logger");
const env = require("../config/env");

const errorMiddleware = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";

  if (err instanceof multer.MulterError) {
    statusCode = 400;
    message =
      err.code === "LIMIT_FILE_SIZE"
        ? "File too large. Maximum file size is 10MB."
        : `Upload failed: ${err.message}`;
  }

  if (err.code === "P2002") {
    statusCode = 409;
    message = "This product already exists.";
  }

  if (statusCode === 500) {
    message = "Something went wrong. Please try again.";
  }

  logger.error(`${statusCode} - ${err.message || "Internal Server Error"}`, {
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });

  const response = {
    success: false,
    message,
  };

  if (env.NODE_ENV === "development") {
    response.stack = err.stack;
  } else {
    delete response.stack;
  }

  if (err.isValidationError) {
    response.errors = err.errors;
  }

  res.status(statusCode).json(response);
};

module.exports = errorMiddleware;
