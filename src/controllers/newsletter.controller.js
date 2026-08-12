const prisma = require("../config/db");
const AppError = require("../utils/AppError");
const crypto = require("crypto");
const newsletterService = require("../services/newsletter.service");

exports.getAll = async (req, res, next) => {
  try {
    const subscribers = await prisma.newsletterSubscriber.findMany({ orderBy: { createdAt: "desc" } });
    res.json({ success: true, data: subscribers });
  } catch (error) { next(error); }
};

exports.subscribe = async (req, res, next) => {
  try {
    const { email, name } = req.body;
    if (!email) throw new AppError("Email is required", 400);
    const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } });
    if (existing) {
      if (!existing.isActive) {
        const updated = await prisma.newsletterSubscriber.update({
          where: { email },
          data: { isActive: true, unsubscribedAt: null },
        });
        return res.json({ success: true, data: updated });
      }
      return res.json({ success: true, data: existing, message: "Already subscribed" });
    }
    const subscriber = await prisma.newsletterSubscriber.create({
      data: { email, name, unsubscribeToken: crypto.randomBytes(24).toString("hex") },
    });
    res.status(201).json({ success: true, data: subscriber });
  } catch (error) { next(error); }
};

exports.update = async (req, res, next) => {
  try {
    const { isActive } = req.body;
    const updated = await prisma.newsletterSubscriber.update({
      where: { id: req.params.id },
      data: { isActive: isActive === undefined ? undefined : Boolean(isActive) },
    });
    res.json({ success: true, data: updated });
  } catch (error) { next(error); }
};

exports.remove = async (req, res, next) => {
  try {
    await prisma.newsletterSubscriber.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { message: "Subscriber deleted" } });
  } catch (error) { next(error); }
};

// ---------------------------------------------------------------------------
// Campaigns (admin)
// ---------------------------------------------------------------------------

exports.createCampaign = async (req, res, next) => {
  try {
    const campaign = await newsletterService.createCampaign(req.body);
    res.status(201).json({ success: true, data: campaign });
  } catch (error) { next(error); }
};

exports.listCampaigns = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const status = req.query.status || undefined;
    const data = await newsletterService.listCampaigns({ page, limit, status });
    res.json({ success: true, data });
  } catch (error) { next(error); }
};

exports.getCampaign = async (req, res, next) => {
  try {
    const campaign = await newsletterService.getCampaign(req.params.id);
    res.json({ success: true, data: campaign });
  } catch (error) { next(error); }
};

exports.updateCampaign = async (req, res, next) => {
  try {
    const campaign = await newsletterService.updateCampaign(req.params.id, req.body);
    res.json({ success: true, data: campaign });
  } catch (error) { next(error); }
};

exports.scheduleCampaign = async (req, res, next) => {
  try {
    const campaign = await newsletterService.scheduleCampaign(req.params.id, req.body.scheduledAt);
    res.json({ success: true, data: campaign });
  } catch (error) { next(error); }
};

exports.retryCampaign = async (req, res, next) => {
  try {
    const campaign = await newsletterService.retryFailedCampaign(req.params.id);
    res.json({ success: true, data: campaign });
  } catch (error) { next(error); }
};

// ---------------------------------------------------------------------------
// Public unsubscribe
// ---------------------------------------------------------------------------

exports.unsubscribe = async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) throw new AppError("Missing unsubscribe token", 400);
    const subscriber = await newsletterService.unsubscribeByToken(token);
    if (!subscriber) throw new AppError("Invalid or expired unsubscribe link", 400);
    res
      .status(200)
      .type("html")
      .send(`<!DOCTYPE html>
<html><body style="font-family: Arial, sans-serif; background: #f3f4f6; padding: 48px 16px; text-align: center;">
  <div style="max-width: 420px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 32px;">
    <h2 style="color: #111827; margin: 0 0 8px;">You have been unsubscribed</h2>
    <p style="color: #6b7280; font-size: 14px;">${subscriber.email} will no longer receive AA NEEDLES newsletters.</p>
    <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">Changed your mind? Visit the website and subscribe again anytime.</p>
  </div>
</body></html>`);
  } catch (error) { next(error); }
};
