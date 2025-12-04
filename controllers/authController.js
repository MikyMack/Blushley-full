// controllers/authController.js
const { body, validationResult } = require('express-validator');
const Otp = require('../models/Otp');
const User = require('../models/User');
const Salon = require('../models/Salon');
const mongoose = require("mongoose");
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



exports.logout = async (req, res) => {
  req.session.destroy(err => {
    if (err) console.error("Session destroy error:", err);
    res.clearCookie("blushley.sid");
    return res.redirect("/");
  });
};


exports.adminLogin = async (req, res) => {
  const { email, password } = req.body;

  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    return res.status(400).render("admin/adminLogin", { error: "Invalid admin credentials" });
  }

 
  const fixedAdminId = new mongoose.Types.ObjectId('000000000000000000000001');

  req.session.user = {
    _id: fixedAdminId.toString(), 
    name: "Super Admin",
    email: ADMIN_EMAIL,
    role: "admin"
  };

  return res.redirect("/admin/dashboard");
};


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


exports.makeUserStaff = async (req, res) => {
  try {
    const userId = req.params.userId;

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Prevent changing roles of admin/superadmin
    if (["admin", "superadmin"].includes(user.role)) {
      return res.status(400).json({
        success: false,
        message: "Cannot change role of admin or superadmin"
      });
    }

    // Update the role
    user.role = "staff";
    await user.save();

    return res.json({
      success: true,
      message: `User promoted to staff successfully`,
      user
    });

  } catch (err) {
    console.error("MAKE STAFF ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message
    });
  }
};

exports.removeStaffRole = async (req, res) => {
  try {
    const userId = req.params.userId;

    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    if (user.role !== "staff") {
      return res.status(400).json({
        success: false,
        message: "User is not a staff member"
      });
    }

    user.role = "user";
    await user.save();

    return res.json({
      success: true,
      message: "Staff role removed successfully",
      user
    });

  } catch (err) {
    console.error("REMOVE STAFF ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.blockUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    // Prevent blocking superadmin or admin
    if (["admin", "superadmin"].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: "Cannot block admin or superadmin"
      });
    }

    user.isBlocked = true;
    await user.save();

    res.json({
      success: true,
      message: "User blocked successfully",
      user
    });

  } catch (err) {
    console.error("BLOCK USER ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.unblockUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    user.isBlocked = false;
    await user.save();

    res.json({
      success: true,
      message: "User unblocked successfully",
      user
    });

  } catch (err) {
    console.error("UNBLOCK USER ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

