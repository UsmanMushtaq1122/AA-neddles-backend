const jwt = require("jsonwebtoken");
const env = require("../config/env");

exports.generateToken = (payload) => {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
};

exports.generateRefreshToken = (payload) => {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN });
};

exports.verifyToken = (token) => {
  return jwt.verify(token, env.JWT_SECRET);
};

exports.verifyRefreshToken = (token) => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
};

exports.decodeToken = (token) => {
  return jwt.decode(token);
};
