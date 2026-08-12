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
const faqRoutes = require("./routes/faq.routes");
const faqCategoryRoutes = require("./routes/faqCategory.routes");
const locationRoutes = require("./routes/location.routes");
const careerRoutes = require("./routes/career.routes");
const contactRoutes = require("./routes/contact.routes");
const newsletterRoutes = require("./routes/newsletter.routes");
const settingsRoutes = require("./routes/settings.routes");
const wishlistRoutes = require("./routes/wishlist.routes");
const editorialRoutes = require("./routes/editorial.routes");
const pagesRoutes = require("./routes/pages.routes");
const userRoutes = require("./routes/user.routes");
const notificationRoutes = require("./routes/notification.routes");

const app = express();

app.set("etag", false);

app.use(helmet({
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://apis.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com", "https://*.googleusercontent.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "https://res.cloudinary.com"],
      frameSrc: ["'self'", "https://accounts.google.com"],
      objectSrc: ["'none'"],
    },
  },
}));
app.use(cors({ origin: [env.FRONTEND_URL, env.ADMIN_URL], credentials: true }));
app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(morgan("combined", { stream: { write: (msg) => { const level = env.NODE_ENV === "production" ? "info" : "debug"; logger.log(level, msg.trim()); } } }));
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
app.use("/api/v1/faqs", faqRoutes);
app.use("/api/v1/faq-categories", faqCategoryRoutes);
app.use("/api/v1/locations", locationRoutes);
app.use("/api/v1/careers", careerRoutes);
app.use("/api/v1/contact", contactRoutes);
app.use("/api/v1/newsletter", newsletterRoutes);
app.use("/api/v1/settings", settingsRoutes);
app.use("/api/v1/wishlist", wishlistRoutes);
app.use("/api/v1/editorial", editorialRoutes);
app.use("/api/v1/pages", pagesRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/notifications", notificationRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.use(errorMiddleware);

module.exports = app;
