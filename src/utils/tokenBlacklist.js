const prisma = require("../config/db");

const BLACKLISTED_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

exports.blacklistToken = async (token) => {
  const decoded = require("../utils/jwt").decodeToken(token);
  const expiresAt = decoded?.exp
    ? new Date(Math.min(decoded.exp * 1000, Date.now() + BLACKLISTED_TOKEN_TTL_MS))
    : new Date(Date.now() + BLACKLISTED_TOKEN_TTL_MS);

  await prisma.blacklistedToken.upsert({
    where: { token },
    create: { token, expiresAt },
    update: { expiresAt },
  });
};

exports.isBlacklisted = async (token) => {
  const record = await prisma.blacklistedToken.findUnique({ where: { token } });
  if (!record) return false;
  if (record.expiresAt < new Date()) {
    await prisma.blacklistedToken.delete({ where: { token } }).catch(() => {});
    return false;
  }
  return true;
};

exports.cleanExpired = async () => {
  await prisma.blacklistedToken.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
};

setInterval(exports.cleanExpired, 60 * 60 * 1000);
