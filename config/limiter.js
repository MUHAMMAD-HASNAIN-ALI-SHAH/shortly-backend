const rateLimit = require("express-rate-limit");

const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: "Too many requests, please try again later."
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const shortUrlLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 1,
  keyGenerator: (req) => {
    return req.user?._id ? req.user._id.toString() : req.ip;
  },
  message: {
    success: false,
    message: "You can only create 1 short URL per minute."
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const qrCodeLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 1,
  keyGenerator: (req) => {
    return req.user?._id ? req.user._id.toString() : req.ip;
  },
  message: {
    success: false,
    message: "You can only create 1 QR code per minute."
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { globalLimiter, shortUrlLimiter, qrCodeLimiter };
