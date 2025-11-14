// middlewares/rateLimiter.js
const rateLimit = require("express-rate-limit");

module.exports.otpLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 3,
  message: "Too many OTP requests. Try again later."
});
