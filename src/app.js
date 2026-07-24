const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const env = require("./config/env");
const logger = require("./config/logger");
const cloudinary = require("cloudinary").v2;
const errorMiddleware = require("./middlewares/error.middleware");
const { limiter } = require("./middlewares/rateLimit.middleware");

const authRoutes = require("./routes/auth.routes");
const productRoutes = require("./routes/product.routes");
const categoryRoutes = require("./routes/category.routes");
const orderRoutes = require("./routes/order.routes");
const customerRoutes = require("./routes/customer.routes");
const reviewRoutes = require("./routes/review.routes");
const couponRoutes = require("./routes/coupon.routes");
const bannerRoutes = require("./routes/banner.routes");
const testimonialRoutes = require("./routes/testimonial.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const cartRoutes = require("./routes/cart.routes");
const paymentRoutes = require("./routes/payment.routes");

const app = express();

app.use(helmet({
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  contentSecurityPolicy: false,
}));
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(morgan("combined", { stream: { write: (msg) => logger.info(msg.trim()) } }));
app.use(limiter);

app.get("/api/health", async (req, res) => {
  let cloudinaryStatus = "unchecked";
  try {
    const ping = await cloudinary.api.ping();
    cloudinaryStatus = ping.status === "ok" ? "connected" : ping.status;
  } catch {
    cloudinaryStatus = "disconnected";
  }
  res.status(200).json({ success: true, message: "Server is running", timestamp: new Date().toISOString(), services: { cloudinary: cloudinaryStatus } });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/customers", customerRoutes);
app.use("/api/v1/reviews", reviewRoutes);
app.use("/api/v1/coupons", couponRoutes);
app.use("/api/v1/banners", bannerRoutes);
app.use("/api/v1/testimonials", testimonialRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/cart", cartRoutes);
app.use("/api/v1/payments", paymentRoutes);

app.use(errorMiddleware);

module.exports = app;
