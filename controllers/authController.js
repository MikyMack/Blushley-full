// controllers/authController.js
const { body, validationResult } = require('express-validator');
const Otp = require('../models/Otp');
const User = require('../models/User');
const Salon = require('../models/Salon');

const {
  genOtp,
  sendOtpSms,
  verifyOtpHash,
  sendOtpEmail 
} = require('../services/otpService');

const bcrypt = require('bcryptjs');

// === ENV Admin Login ===
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ;

const OTP_TTL_MINUTES = 5;
const MAX_OTP_ATTEMPTS = 5;

/* ============================================================
   SEND OTP (PHONE → SMS, EMAIL → EMAIL OTP)
   POST /auth/send-otp
   POST /auth/send-email-otp
============================================================ */
exports.sendOtp = async (req, res) => {
  const { phone, email, purpose = "login" } = req.body;

  if (!phone && !email) {
    return res.status(400).json({ error: "Phone or email is required" });
  }

  try {
    const { otp, storedHash } = genOtp();

    await Otp.create({
      phone: phone || email,
      otpHash: storedHash,
      purpose,
      expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60000)
    });

    if (phone) {
      await sendOtpSms(phone, otp);
    } else {
      await sendOtpEmail(email, otp);
    }

    return res.json({ ok: true, msg: "OTP sent successfully" });
  } catch (err) {
    console.error("sendOtp error:", err);
    return res.status(500).json({ error: "Failed to send OTP" });
  }
};

/* ============================================================
   VERIFY OTP (PHONE OR EMAIL)
   POST /auth/verify-otp
============================================================ */
exports.verifyOtp = async (req, res) => {
  const { phone, email, otp, purpose = "login" } = req.body;

  const identifier = phone || email;
  if (!identifier) {
    return res.status(400).json({ error: "Phone or email required" });
  }

  try {
    const otpDoc = await Otp.findOne({ phone: identifier, purpose })
      .sort({ createdAt: -1 });

    if (!otpDoc) {
      return res.status(400).json({ error: "OTP expired or invalid" });
    }

    if (otpDoc.attempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({ error: "Too many attempts" });
    }

    const valid = verifyOtpHash(otp, otpDoc.otpHash);
    if (!valid) {
      otpDoc.attempts += 1;
      await otpDoc.save();
      return res.status(400).json({ error: "Invalid OTP" });
    }

    // Delete OTP after success
    await Otp.deleteMany({ phone: identifier, purpose });

    let user = await User.findOne({ email });

    /* ---------- ROLE LOGIC ----------- */
    if (purpose === "freelancer_verify") {

      user = await User.findOneAndUpdate(
        { email },
        { isVerified: true, role: "freelancer" },
        { new: true }
      );

      return res.status(200).json({
        success: true,
        role: "freelancer",
        status: "pending",
        message: "OTP verified. Your freelancer profile is under admin review."
      });
    }

    if (purpose === "reseller_verify") {

      user = await User.findOneAndUpdate(
        { email },
        { isVerified: true, role: "reseller" },
        { new: true }
      );

      return res.status(200).json({
        success: true,
        role: "reseller",
        status: "pending",
        message: "OTP verified. Your reseller account is under admin review."
      });
    }

    /* ---------- NORMAL USER LOGIN ----------- */
    if (phone && purpose === "login") {
      user = await User.findOneAndUpdate(
        { phone },
        { isVerified: true },
        { new: true, upsert: true }
      );

      req.session.user = {
        _id: user._id,
        name: user.name || "",
        phone: user.phone,
        email: user.email,
        role: user.role || "user"
      };

      return res.redirect("/user/dashboard");
    }

    /* ---------- SALON LOGIN ----------- */
    if (user && user.role === "salon") {
      return res.redirect("/salon/dashboard");
    }

    return res.redirect("/user/dashboard");

  } catch (err) {
    console.error("verifyOtp error:", err);
    return res.status(500).json({ error: "OTP verification failed" });
  }
};


/* ============================================================
   LOGOUT
============================================================ */
exports.logout = async (req, res) => {
  req.session.destroy(err => {
    if (err) console.error("Session destroy error:", err);
    res.clearCookie("blushley.sid");
    return res.redirect("/");
  });
};

/* ============================================================
   ADMIN LOGIN (ENV based)
   POST /auth/admin-login
============================================================ */
exports.adminLogin = async (req, res) => {
  const { email, password } = req.body;

  // Using ENV instead of DB
  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    return res.status(400).render("admin/adminLogin", { error: "Invalid admin credentials" });
  }

  // Create ADMIN session
  req.session.user = {
    _id: "admin",
    name: "Super Admin",
    email: ADMIN_EMAIL,
    role: "admin"
  };

  return res.redirect("/admin/dashboard");
};

/* ============================================================
   SALON LOGIN (username + password)
============================================================ */
exports.salonLogin = async (req, res) => {
  const { username, password } = req.body;

  const salon = await Salon.findOne({ username });
  if (!salon) return res.status(400).render("salon/login", { error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, salon.passwordHash || "");
  if (!ok) return res.status(400).render("salon/login", { error: "Invalid credentials" });

  req.session.user = {
    _id: salon._id,
    name: salon.name,
    role: "salon"
  };

  return res.redirect("/salon/dashboard");
};
