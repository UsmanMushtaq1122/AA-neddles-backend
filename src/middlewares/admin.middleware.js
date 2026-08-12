const adminMiddleware = (req, res, next) => {
  if (!req.user || !req.user.role) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }
  if (req.user.role !== "ADMIN" && req.user.role !== "SUPER_ADMIN") {
    return res.status(403).json({ success: false, message: "Access denied. Admin only." });
  }
  next();
};

module.exports = adminMiddleware;
