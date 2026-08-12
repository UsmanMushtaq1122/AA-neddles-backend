const notificationService = require("../services/notification.service");

exports.list = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const type = req.query.type || undefined;
    const isRead = req.query.isRead === "true" ? true : req.query.isRead === "false" ? false : undefined;

    const data = await notificationService.list({ page, limit, type, isRead });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.unreadCount = async (req, res, next) => {
  try {
    const count = await notificationService.unreadCount();
    res.json({ success: true, data: { count } });
  } catch (error) {
    next(error);
  }
};

exports.markRead = async (req, res, next) => {
  try {
    const notification = await notificationService.markRead(req.params.id);
    res.json({ success: true, data: notification });
  } catch (error) {
    next(error);
  }
};

exports.markAllRead = async (req, res, next) => {
  try {
    const count = await notificationService.markAllRead();
    res.json({ success: true, data: { count } });
  } catch (error) {
    next(error);
  }
};
